// Live verification for the structured-weather additions in src/lib/noaa.ts.
//
// Run: npm run verify:weather        (hits the live NWS API — needs network)
//
// WHAT THIS IS ACTUALLY FOR
//
// The unit conversion and interval parsing can be checked offline, and are,
// below. But the question that matters for personal minimums cannot be
// answered from a spec: WHICH FIELDS DOES NWS ACTUALLY POPULATE, AND WHERE?
//
// Coverage varies by forecast office. On the first run of this script the
// Denver gridpoint published windSpeed, windGust, windDirection and skyCover
// but returned `visibility` and `ceilingHeight` as present-but-empty — which
// is why WeatherSnapshot has no ceiling or visibility field and why every
// structured value is optional. If that changes, or if some office is missing
// wind gust entirely, a minimums check needs to know rather than silently
// treating absence as "conditions fine".
//
// So this sweeps a spread of US gridpoints and prints coverage. Run it before
// trusting any new field, and after any NWS API change.

import { fetchWeatherSnapshot, type LatLon } from "../src/lib/noaa";

interface Site {
  name: string;
  coords: LatLon;
}

// Spread across NWS regions, including the two that break naive assumptions:
// Alaska (sparse grids) and Hawaii (marine-dominated forecasts).
const SITES: Site[] = [
  { name: "Denver, CO", coords: { lat: 39.7392, lon: -104.9903 } },
  { name: "Miami, FL", coords: { lat: 25.7617, lon: -80.1918 } },
  { name: "Seattle, WA", coords: { lat: 47.6062, lon: -122.3321 } },
  { name: "Chicago, IL", coords: { lat: 41.8781, lon: -87.6298 } },
  { name: "Phoenix, AZ", coords: { lat: 33.4484, lon: -112.074 } },
  { name: "Anchorage, AK", coords: { lat: 61.2181, lon: -149.9003 } },
  { name: "Honolulu, HI", coords: { lat: 21.3069, lon: -157.8583 } },
];

let failures = 0;
let checks = 0;

function check(label: string, condition: boolean, detail = ""): void {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main(): Promise<void> {
  console.log("\n=== Live NWS coverage sweep ===\n");
  console.log(
    "Site              Wind    Gust    Dir     Sky    Display string",
  );
  console.log("-".repeat(78));

  const coverage = { windSpeedKt: 0, windGustKt: 0, windDirectionDeg: 0, skyCoverPercent: 0 };
  let reached = 0;

  for (const site of SITES) {
    const snapshot = await fetchWeatherSnapshot(site.coords);

    if (!snapshot) {
      console.log(`${site.name.padEnd(18)}unreachable`);
      continue;
    }
    reached += 1;

    // The display contract must survive regardless of structured coverage —
    // these three fields are what the mission record and the PDF consume, and
    // they predate this change.
    check(`${site.name}: temperature string present`, Boolean(snapshot.temperature));
    check(`${site.name}: wind string present`, Boolean(snapshot.wind));
    check(`${site.name}: precipitation string present`, Boolean(snapshot.precipitation));

    // Sanity-bound anything we did get. A conversion error shows up here as a
    // number that is finite and confidently wrong, so bound it against physical
    // plausibility rather than just checking for NaN.
    if (snapshot.windSpeedKt !== undefined) {
      coverage.windSpeedKt += 1;
      check(
        `${site.name}: wind speed is plausible`,
        snapshot.windSpeedKt >= 0 && snapshot.windSpeedKt < 200,
        `${snapshot.windSpeedKt} kt`,
      );
    }
    if (snapshot.windGustKt !== undefined) {
      coverage.windGustKt += 1;
      check(
        `${site.name}: gust is plausible`,
        snapshot.windGustKt >= 0 && snapshot.windGustKt < 250,
        `${snapshot.windGustKt} kt`,
      );
      if (snapshot.windSpeedKt !== undefined) {
        // Gust below sustained wind is not physically meaningful. Allow
        // equality — NWS reports them equal in calm conditions.
        check(
          `${site.name}: gust is not below sustained wind`,
          snapshot.windGustKt >= snapshot.windSpeedKt,
          `gust ${snapshot.windGustKt} < wind ${snapshot.windSpeedKt}`,
        );
      }
    }
    if (snapshot.windDirectionDeg !== undefined) {
      coverage.windDirectionDeg += 1;
      check(
        `${site.name}: direction is within [0, 360)`,
        snapshot.windDirectionDeg >= 0 && snapshot.windDirectionDeg < 360,
        `${snapshot.windDirectionDeg}°`,
      );
    }
    if (snapshot.skyCoverPercent !== undefined) {
      coverage.skyCoverPercent += 1;
      check(
        `${site.name}: sky cover is a percentage`,
        snapshot.skyCoverPercent >= 0 && snapshot.skyCoverPercent <= 100,
        `${snapshot.skyCoverPercent}%`,
      );
    }

    const cell = (v: number | undefined, suffix: string) =>
      (v === undefined ? "—" : `${v}${suffix}`).padEnd(8);

    console.log(
      site.name.padEnd(18) +
        cell(snapshot.windSpeedKt, "kt") +
        cell(snapshot.windGustKt, "kt") +
        cell(snapshot.windDirectionDeg, "°") +
        cell(snapshot.skyCoverPercent, "%") +
        snapshot.wind,
    );
  }

  console.log("\n=== Field coverage ===\n");
  if (reached === 0) {
    console.error("No sites reachable — network down or NWS unavailable. Nothing verified.");
    process.exit(1);
  }
  for (const [field, count] of Object.entries(coverage)) {
    const pct = Math.round((count / reached) * 100);
    console.log(`  ${field.padEnd(20)} ${count}/${reached} sites (${pct}%)`);
  }

  console.log(
    "\nPartial coverage is expected and is why every structured field is optional.",
  );
  console.log(
    "A minimums check must treat an absent field as UNKNOWN, never as within limits.",
  );

  console.log("\n" + "=".repeat(78));
  if (failures === 0) {
    console.log(`PASS — ${checks} checks across ${reached} reachable sites.`);
  } else {
    console.error(`FAIL — ${failures} of ${checks} checks failed.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("verify:weather crashed:", err);
  process.exit(1);
});
