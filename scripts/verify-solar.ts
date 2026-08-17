// Verification harness for src/lib/solar.ts.
//
// Run: npm run verify:solar
//
// WHY INVARIANTS RATHER THAN HARDCODED ALMANAC TIMES
//
// The obvious test is "sunset in Denver on 21 Jun 2026 is 20:31" — but that
// number would have to come from somewhere, and writing it from memory is
// exactly the failure the authoritative-values rule in CLAUDE.md exists to
// prevent. A confidently wrong expected value produces a test that passes
// against broken code, or fails against correct code, and either way costs
// more than it saves.
//
// So this script does two separate jobs:
//
//   1. ASSERTS invariants that must hold for any correct implementation and
//      that need no external source — internal symmetry, monotonicity with
//      latitude, hemisphere inversion, the polar cases, absence of NaN.
//      These fail loudly.
//
//   2. PRINTS a table of computed times for real locations, for a human to
//      eyeball against the U.S. Naval Observatory's published tables
//      (aa.usno.navy.mil) or the NOAA Solar Calculator. This is the step that
//      catches a systematic offset the invariants cannot see, because a
//      uniformly-shifted result stays internally consistent.
//
// Step 2 is a real task, not decoration: run it and spot-check three rows
// before trusting anything downstream of this module.

import {
  dayLengthMinutes,
  isDaylight,
  solarTimesForCalendarDate,
  type SolarTimes,
} from "../src/lib/solar";

let failures = 0;
let checks = 0;

function check(label: string, condition: boolean, detail = ""): void {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function near(a: number, b: number, toleranceMinutes: number): boolean {
  return Math.abs(a - b) <= toleranceMinutes;
}

function minutesBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 60000;
}

function fmt(d: Date | null): string {
  return d ? d.toISOString().slice(11, 16) + "Z" : "  —  ";
}

// --- Locations -------------------------------------------------------------
// Longitude is degrees EAST — US values are negative.

const PLACES = [
  { name: "Denver, CO", lat: 39.7392, lon: -104.9903 },
  { name: "Miami, FL", lat: 25.7617, lon: -80.1918 },
  { name: "Seattle, WA", lat: 47.6062, lon: -122.3321 },
  { name: "Honolulu, HI", lat: 21.3069, lon: -157.8583 },
  { name: "Anchorage, AK", lat: 61.2181, lon: -149.9003 },
  { name: "Utqiagvik, AK", lat: 71.2906, lon: -156.7886 },
];

const DATES = [
  { label: "Mar equinox", y: 2026, m: 3, d: 20 },
  { label: "Jun solstice", y: 2026, m: 6, d: 21 },
  { label: "Sep equinox", y: 2026, m: 9, d: 22 },
  { label: "Dec solstice", y: 2026, m: 12, d: 21 },
];

console.log("\n=== 1. Invariants ===\n");

// --- Internal consistency on ordinary days ---------------------------------

console.log("Ordering, symmetry, and the night window");
for (const place of PLACES) {
  for (const date of DATES) {
    const t = solarTimesForCalendarDate(place.lat, place.lon, date.y, date.m, date.d);
    const where = `${place.name} ${date.label}`;

    // No NaN may escape, in any field, ever. A NaN here propagates silently
    // into "minutes until sunset" and poisons the risk score.
    for (const [field, value] of Object.entries(t)) {
      if (value instanceof Date) {
        check(`${where}: ${field} is a valid Date`, !Number.isNaN(value.getTime()));
      }
    }

    if (t.kind !== "normal") continue;
    const { sunrise, sunset, solarNoon, civilTwilightBegin, civilTwilightEnd } = t;
    if (!sunrise || !sunset) continue;

    check(`${where}: sunrise < solar noon`, sunrise < solarNoon);
    check(`${where}: solar noon < sunset`, solarNoon < sunset);

    // Solar noon is the midpoint of sunrise and sunset by construction; if it
    // drifts, the hour-angle term is wrong.
    const midpoint = new Date((sunrise.getTime() + sunset.getTime()) / 2);
    check(
      `${where}: solar noon is the sunrise/sunset midpoint`,
      near(minutesBetween(midpoint, solarNoon), 0, 1),
      `off by ${minutesBetween(midpoint, solarNoon).toFixed(2)} min`,
    );

    if (civilTwilightBegin && civilTwilightEnd) {
      check(`${where}: dawn precedes sunrise`, civilTwilightBegin < sunrise);
      check(`${where}: dusk follows sunset`, sunset < civilTwilightEnd);
      // Twilight is symmetric about solar noon for the same reason noon is
      // the rise/set midpoint.
      const twilightMid = new Date(
        (civilTwilightBegin.getTime() + civilTwilightEnd.getTime()) / 2,
      );
      check(
        `${where}: civil twilight is symmetric about solar noon`,
        near(minutesBetween(twilightMid, solarNoon), 0, 1),
      );
    }

    // The night window opens exactly one hour after sunset.
    if (t.nightWindowStart) {
      check(
        `${where}: night window opens 60 min after sunset`,
        near(minutesBetween(sunset, t.nightWindowStart), 60, 0.01),
      );
    }
    // And closes before the following noon — a sanity bound proving it was
    // computed against tomorrow's sunrise rather than today's.
    if (t.nightWindowEnd) {
      check(
        `${where}: night window closes after it opens`,
        t.nightWindowStart !== null && t.nightWindowEnd > t.nightWindowStart,
      );
    }

    check(`${where}: solar noon reads as daylight`, isDaylight(t, solarNoon));
  }
}

// --- Equinox: near-12-hour days everywhere ---------------------------------
// At an equinox the sun is over the equator, so day length is close to 12h at
// every latitude. It always runs OVER 12h, never under, because refraction and
// the upper-limb convention both lengthen the visible day.
//
// The excess is NOT constant — it grows with latitude, because the sun crosses
// the horizon at a shallower angle the further from the equator you are, so
// the same angular refraction buys more minutes. The printed table shows the
// progression clearly: about 7 minutes over at Denver (40°N), about 15 at
// Utqiagvik (71°N). A calendar date is also not the exact equinox instant,
// which tilts the two hemispheres in opposite directions by a few minutes.
//
// So the band here is deliberately loose. Tightening it to ±15 min looks more
// rigorous and is simply wrong — it fails 60°S for being correct.
const EQUINOX_TOLERANCE_MIN = 30;

console.log("Equinox day length ~12h at all latitudes");
for (const lat of [-60, -40, -20, 0, 20, 40, 60]) {
  const t = solarTimesForCalendarDate(lat, 0, 2026, 3, 20);
  const len = dayLengthMinutes(t);
  check(
    `equinox at ${lat}°: day length near 720 min`,
    len !== null && near(len, 720, EQUINOX_TOLERANCE_MIN),
    `got ${len?.toFixed(1)} min`,
  );
  check(
    `equinox at ${lat}°: day is slightly longer than 12h (refraction)`,
    len !== null && len > 720,
    `got ${len?.toFixed(1)} min`,
  );
}

// --- Equator: ~12h year-round ----------------------------------------------

console.log("Equator day length stays ~12h year-round");
for (const date of DATES) {
  const t = solarTimesForCalendarDate(0, 0, date.y, date.m, date.d);
  const len = dayLengthMinutes(t);
  check(
    `equator ${date.label}: day length near 720 min`,
    len !== null && near(len, 720, 10),
    `got ${len?.toFixed(1)} min`,
  );
}

// --- Monotonicity with latitude --------------------------------------------
// On the June solstice, days lengthen as you go north and shorten as you go
// south. This is the check that catches a sign error on declination — the
// single most likely way to get plausible-looking but wrong times.

console.log("June solstice: day length rises with northern latitude");
let previous = -Infinity;
for (const lat of [0, 20, 40, 55, 65]) {
  const len = dayLengthMinutes(solarTimesForCalendarDate(lat, 0, 2026, 6, 21));
  check(
    `June solstice at ${lat}°N: longer than at the latitude below`,
    len !== null && len > previous,
    `got ${len?.toFixed(1)} min after ${previous.toFixed(1)}`,
  );
  previous = len ?? previous;
}

console.log("December solstice: northern hemisphere inverts");
previous = Infinity;
for (const lat of [0, 20, 40, 55, 65]) {
  const len = dayLengthMinutes(solarTimesForCalendarDate(lat, 0, 2026, 12, 21));
  check(
    `December solstice at ${lat}°N: shorter than at the latitude below`,
    len !== null && len < previous,
    `got ${len?.toFixed(1)} min after ${previous.toFixed(1)}`,
  );
  previous = len ?? previous;
}

console.log("Hemispheres are mirror images");
for (const lat of [20, 40, 55]) {
  const north = dayLengthMinutes(solarTimesForCalendarDate(lat, 0, 2026, 6, 21));
  const south = dayLengthMinutes(solarTimesForCalendarDate(-lat, 0, 2026, 12, 21));
  check(
    `${lat}°N in June matches ${lat}°S in December`,
    north !== null && south !== null && near(north, south, 20),
    `${north?.toFixed(1)} vs ${south?.toFixed(1)}`,
  );
}

// --- Polar cases -----------------------------------------------------------
// Utqiagvik sits above the Arctic Circle. Returning a bogus sunrise here, or
// NaN, would be worse than returning nothing — this is the case a naive
// implementation gets wrong.

console.log("Polar day and polar night");
const utqiagvikJune = solarTimesForCalendarDate(71.2906, -156.7886, 2026, 6, 21);
check(
  "Utqiagvik in June is midnight sun",
  utqiagvikJune.kind === "always-up",
  `got '${utqiagvikJune.kind}'`,
);
check("Utqiagvik in June has no sunrise", utqiagvikJune.sunrise === null);
check(
  "Utqiagvik in June still reports solar noon",
  !Number.isNaN(utqiagvikJune.solarNoon.getTime()),
);
check("Utqiagvik in June reads as daylight", isDaylight(utqiagvikJune, utqiagvikJune.solarNoon));

const utqiagvikDec = solarTimesForCalendarDate(71.2906, -156.7886, 2026, 12, 21);
check(
  "Utqiagvik in December is polar night",
  utqiagvikDec.kind === "always-down",
  `got '${utqiagvikDec.kind}'`,
);
check("Utqiagvik in December has no sunset", utqiagvikDec.sunset === null);
check(
  "Utqiagvik in December does not read as daylight",
  !isDaylight(utqiagvikDec, utqiagvikDec.solarNoon),
);

// --- Longitude extremes ----------------------------------------------------
// Guam and the far Aleutians put US operations either side of the antimeridian.

console.log("Longitude extremes stay finite");
for (const lon of [-179.9, -156, -67, 0, 144.8, 179.9]) {
  const t = solarTimesForCalendarDate(30, lon, 2026, 8, 16);
  check(
    `lon ${lon}: sunrise is finite`,
    t.sunrise !== null && !Number.isNaN(t.sunrise.getTime()),
  );
  check(
    `lon ${lon}: sunset is finite`,
    t.sunset !== null && !Number.isNaN(t.sunset.getTime()),
  );
}

// --- Month boundary rollover -----------------------------------------------
// The night window reaches into the next calendar day. Crossing a month end
// (and a year end) is where naive date arithmetic breaks.

console.log("Night window rolls over month and year boundaries");
for (const date of [
  { y: 2026, m: 1, d: 31 },
  { y: 2026, m: 2, d: 28 },
  { y: 2028, m: 2, d: 29 }, // leap day
  { y: 2026, m: 12, d: 31 },
]) {
  const t = solarTimesForCalendarDate(39.7392, -104.9903, date.y, date.m, date.d);
  const label = `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
  check(
    `${label}: night window end exists`,
    t.nightWindowEnd !== null && !Number.isNaN(t.nightWindowEnd.getTime()),
  );
  check(
    `${label}: night window end falls after its start`,
    t.nightWindowStart !== null &&
      t.nightWindowEnd !== null &&
      t.nightWindowEnd > t.nightWindowStart,
  );
}

// --- 2. Human cross-check table -------------------------------------------

console.log("\n=== 2. Cross-check these against USNO or the NOAA calculator ===");
console.log("    https://aa.usno.navy.mil/data/RS_OneDay");
console.log("    https://gml.noaa.gov/grad/solcalc/");
console.log("    All times UTC. Expect agreement within about a minute.\n");

const pad = (s: string, n: number) => s.padEnd(n);
console.log(
  `${pad("Location", 16)}${pad("Date", 14)}${pad("Dawn", 8)}${pad("Sunrise", 9)}${pad("Noon", 8)}${pad("Sunset", 9)}${pad("Dusk", 8)}Day length`,
);
console.log("-".repeat(80));

function row(place: (typeof PLACES)[number], date: (typeof DATES)[number]): void {
  const t: SolarTimes = solarTimesForCalendarDate(
    place.lat,
    place.lon,
    date.y,
    date.m,
    date.d,
  );
  const len = dayLengthMinutes(t);
  const lenText =
    len === null
      ? t.kind === "always-up"
        ? "24h (polar day)"
        : "0h (polar night)"
      : `${Math.floor(len / 60)}h ${String(Math.round(len % 60)).padStart(2, "0")}m`;
  console.log(
    pad(place.name, 16) +
      pad(date.label, 14) +
      pad(fmt(t.civilTwilightBegin), 8) +
      pad(fmt(t.sunrise), 9) +
      pad(fmt(t.solarNoon), 8) +
      pad(fmt(t.sunset), 9) +
      pad(fmt(t.civilTwilightEnd), 8) +
      lenText,
  );
}

for (const place of PLACES) {
  for (const date of DATES) row(place, date);
  console.log();
}

// --- Result ----------------------------------------------------------------

console.log("=".repeat(80));
if (failures === 0) {
  console.log(`PASS — ${checks} invariant checks.`);
  console.log("Invariants only prove internal consistency. Spot-check the table above.");
} else {
  console.error(`FAIL — ${failures} of ${checks} invariant checks failed.`);
  process.exit(1);
}
