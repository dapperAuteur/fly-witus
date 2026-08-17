// Verification harness for src/lib/risk-assessment.ts.
//
// Run: npm run verify:risk
//
// The properties worth proving are the ones that make a scored checklist
// trustworthy rather than reassuring:
//
//   - a single serious factor cannot be averaged away by benign ones
//   - unassessed categories are excluded from the maths AND named, so a
//     partial score never reads as a complete one
//   - the daylight margin subtracts the planned flight duration rather than
//     just reporting time-to-sunset
//   - there is always an action, never a bare number

import { assessRisk, type RiskInputs } from "../src/lib/risk-assessment";
import type { MinimumsVerdict } from "../src/lib/personal-minimums";
import { solarTimesForCalendarDate } from "../src/lib/solar";

let failures = 0;
let checks = 0;

function expect(label: string, actual: unknown, want: unknown): void {
  checks += 1;
  if (JSON.stringify(actual) !== JSON.stringify(want)) {
    failures += 1;
    console.error(
      `  FAIL  ${label}\n        want ${JSON.stringify(want)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function ok(label: string, condition: boolean, detail = ""): void {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const minimums = (overall: MinimumsVerdict["overall"], unconfigured = false): MinimumsVerdict => ({
  checks: [],
  overall,
  hasUnknowns: overall === "unknown",
  unconfigured,
});

// Denver in mid-August. Noon local is well clear of sunset; 19:00 local is
// close to it. Times are constructed from the solar engine itself so the
// fixture cannot drift away from the implementation.
const DENVER = { lat: 39.7392, lon: -104.9903 };
const solar = solarTimesForCalendarDate(DENVER.lat, DENVER.lon, 2026, 8, 16);
const sunset = solar.sunset as Date;

const at = (minutesBeforeSunset: number): Date =>
  new Date(sunset.getTime() - minutesBeforeSunset * 60000);

const base = (over: Partial<RiskInputs> = {}): RiskInputs => ({
  minimums: minimums("within"),
  solar,
  now: at(300), // five hours of daylight left
  ...over,
});

console.log("\nbaseline");
const clean = assessRisk(base());
expect("nothing flagged scores zero", clean.score, 0);
expect("and bands low", clean.band, "low");
ok("still returns an action", clean.actions.length > 0);

console.log("weather factor");
expect(
  "exceeded minimums drives the band up",
  assessRisk(base({ minimums: minimums("exceeded") })).band,
  "elevated",
);
expect(
  "at-limit is a caution, not an elevation",
  assessRisk(base({ minimums: minimums("at-limit") })).factors[0].status,
  "caution",
);
expect(
  "unknown minimums still score — uncertainty is risk",
  assessRisk(base({ minimums: minimums("unknown") })).score > 0,
  true,
);
expect(
  "having set no minimums at all scores",
  assessRisk(base({ minimums: minimums("within", true) })).score > 0,
  true,
);

console.log("daylight margin subtracts planned duration");
// Sixty minutes of daylight left, but a 45-minute flight planned: only 15
// minutes of margin. Reporting the hour and ignoring the flight would be the
// bug this checks for.
const tight = assessRisk(base({ now: at(60), plannedDurationMinutes: 45 }));
const tightDaylight = tight.factors.find((f) => f.id === "daylight-margin");
expect("a tight margin is elevated", tightDaylight?.status, "elevated");
ok(
  "and says how many minutes are left",
  Boolean(tightDaylight?.detail.includes("15")),
  tightDaylight?.detail,
);

const overrun = assessRisk(base({ now: at(30), plannedDurationMinutes: 60 }));
const overrunDaylight = overrun.factors.find((f) => f.id === "daylight-margin");
expect("running past sunset is elevated", overrunDaylight?.status, "elevated");
ok(
  "and says it runs past sunset",
  Boolean(overrunDaylight?.detail.includes("past sunset")),
  overrunDaylight?.detail,
);

const roomy = assessRisk(base({ now: at(300), plannedDurationMinutes: 30 }));
expect(
  "plenty of daylight is fine",
  roomy.factors.find((f) => f.id === "daylight-margin")?.status,
  "ok",
);

console.log("no location means not-assessed, not zero-risk");
const noLocation = assessRisk(base({ solar: null }));
const noLocationDaylight = noLocation.factors.find((f) => f.id === "daylight-margin");
expect("daylight is not-assessed", noLocationDaylight?.status, "not-assessed");
ok(
  "and is excluded from the denominator",
  noLocation.assessedMax < clean.assessedMax,
  `${noLocation.assessedMax} vs ${clean.assessedMax}`,
);

console.log("a single serious factor is not averaged away");
// Everything else clean, one elevated factor. A mean would bury this.
const onePressure = assessRisk(base({ externalPressure: true }));
expect("external pressure alone floors the band at elevated", onePressure.band, "elevated");
ok(
  "and the driver appears in the actions",
  onePressure.actions.some((a) => a.includes("pressure")),
);

console.log("unassessed categories are named, not silently zeroed");
ok(
  "pilot and aircraft are reported unassessed",
  clean.unassessedCategories.includes("pilot") &&
    clean.unassessedCategories.includes("aircraft"),
  JSON.stringify(clean.unassessedCategories),
);
ok(
  "and the actions say the score is partial",
  clean.actions.some((a) => a.includes("does not include")),
);
// Their zero-point placeholders must not inflate the denominator either.
const assessedIds = clean.factors.filter((f) => f.status !== "not-assessed").map((f) => f.id);
ok(
  "unassessed factors are excluded from scoring",
  !assessedIds.includes("pilot-fitness") && !assessedIds.includes("aircraft-condition"),
);

console.log("stacking");
const stacked = assessRisk(
  base({
    minimums: minimums("exceeded"),
    externalPressure: true,
    unfamiliarSite: true,
    now: at(20),
    plannedDurationMinutes: 40,
  }),
);
expect("everything at once bands high", stacked.band, "high");
ok("and lists several actions", stacked.actions.length >= 3, `${stacked.actions.length}`);
ok(
  "leading with the delay suggestion",
  stacked.actions[0].includes("delay"),
  stacked.actions[0],
);

console.log("polar cases do not break the assessment");
const polarNight = solarTimesForCalendarDate(71.2906, -156.7886, 2026, 12, 21);
const polar = assessRisk(base({ solar: polarNight }));
expect(
  "polar night is an elevated daylight factor",
  polar.factors.find((f) => f.id === "daylight-margin")?.status,
  "elevated",
);
const polarDay = solarTimesForCalendarDate(71.2906, -156.7886, 2026, 6, 21);
expect(
  "midnight sun is fine",
  assessRisk(base({ solar: polarDay })).factors.find((f) => f.id === "daylight-margin")
    ?.status,
  "ok",
);

console.log("\n" + "=".repeat(60));
if (failures === 0) {
  console.log(`PASS — ${checks} checks.`);
} else {
  console.error(`FAIL — ${failures} of ${checks} checks failed.`);
  process.exit(1);
}
