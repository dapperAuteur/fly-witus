// Verification harness for src/lib/personal-minimums.ts.
//
// Run: npm run verify:minimums
//
// Two things here are worth proving rather than eyeballing.
//
// 1. The crosswind trigonometry, which has known exact answers at the cardinal
//    angles — a wind straight down the runway is zero crosswind, a wind across
//    it is all of it, and 45 degrees off is the wind times root-two-over-two.
//    Getting sin and cos the wrong way round produces numbers that look
//    entirely reasonable and are exactly wrong.
//
// 2. The rule that an unreported value yields 'unknown' and never 'within'.
//    That is the safety-critical branch: NWS coverage is uneven, and a green
//    check for a value nobody measured is the worst output this module could
//    produce. It is asserted from several directions below.

import {
  crosswindComponent,
  evaluateMinimums,
  headwindComponent,
  isConfigured,
  type PersonalMinimums,
  type StructuredWeather,
} from "../src/lib/personal-minimums";

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

function expectNear(label: string, actual: number, want: number, tol = 0.01): void {
  checks += 1;
  if (Math.abs(actual - want) > tol) {
    failures += 1;
    console.error(`  FAIL  ${label}\n        want ~${want}, got ${actual}`);
  }
}

const uas = (over: Partial<PersonalMinimums> = {}): PersonalMinimums => ({
  platform: "uas",
  ...over,
});

const wx = (over: Partial<StructuredWeather> = {}): StructuredWeather => ({ ...over });

console.log("\ncrosswindComponent — exact answers at known angles");
// Runway 360 (heading 0). Wind from 90 is a pure crosswind.
expectNear("wind across the runway is all crosswind", crosswindComponent(20, 90, 0), 20);
expectNear("wind down the runway is no crosswind", crosswindComponent(20, 0, 0), 0);
expectNear("tailwind straight up the runway is no crosswind", crosswindComponent(20, 180, 0), 0);
expectNear("45 degrees off is wind x sin45", crosswindComponent(20, 45, 0), 20 * Math.SQRT1_2);
expectNear("30 degrees off is half the wind", crosswindComponent(20, 30, 0), 10);
// Direction of the crosswind does not change its magnitude.
expectNear(
  "crosswind from the left matches the right",
  crosswindComponent(18, 270, 0),
  crosswindComponent(18, 90, 0),
);
// A realistic runway: 27 (heading 270) with wind from 300.
expectNear("runway 27 with wind from 300", crosswindComponent(20, 300, 270), 10);

console.log("headwindComponent — sign convention");
expectNear("wind down the runway is a full headwind", headwindComponent(20, 0, 0), 20);
expectNear("wind from behind is negative", headwindComponent(20, 180, 0), -20);
expectNear("pure crosswind has no headwind component", headwindComponent(20, 90, 0), 0);

console.log("classification bands");
expect(
  "well inside the limit reads as within",
  evaluateMinimums(uas({ maxWindKt: 20 }), wx({ windSpeedKt: 5 })).overall,
  "within",
);
expect(
  "over the limit reads as exceeded",
  evaluateMinimums(uas({ maxWindKt: 15 }), wx({ windSpeedKt: 18 })).overall,
  "exceeded",
);
expect(
  "exactly at the limit reads as at-limit, not exceeded",
  evaluateMinimums(uas({ maxWindKt: 15 }), wx({ windSpeedKt: 15 })).overall,
  "at-limit",
);
expect(
  "one knot under a 15 kt limit is at-limit",
  evaluateMinimums(uas({ maxWindKt: 15 }), wx({ windSpeedKt: 14 })).overall,
  "at-limit",
);
// The 2 kt floor: 10% of 5 is 0.5 kt, which would never trigger on its own.
expect(
  "the 2 kt floor keeps low limits meaningful",
  evaluateMinimums(uas({ maxWindKt: 5 }), wx({ windSpeedKt: 3.5 })).overall,
  "at-limit",
);
// And the floor does not swallow a genuinely comfortable margin.
expect(
  "a comfortable margin under a low limit is still within",
  evaluateMinimums(uas({ maxWindKt: 5 }), wx({ windSpeedKt: 1 })).overall,
  "within",
);

console.log("unknown is never within — the safety-critical branch");
const noData = evaluateMinimums(uas({ maxWindKt: 15, maxGustKt: 20 }), wx({}));
expect("a limit with no forecast value is unknown", noData.overall, "unknown");
expect("every check reports unknown", noData.checks.map((c) => c.status), [
  "unknown",
  "unknown",
]);
expect("hasUnknowns is set", noData.hasUnknowns, true);
expect("this is not treated as unconfigured", noData.unconfigured, false);

expect(
  "a null forecast does not read as within",
  evaluateMinimums(uas({ maxWindKt: 15 }), null).overall,
  "unknown",
);

// Mixed: one value present and fine, one absent. The absent one must dominate
// the summary rather than the green one.
const mixed = evaluateMinimums(
  uas({ maxWindKt: 20, maxGustKt: 25 }),
  wx({ windSpeedKt: 4 }),
);
expect("a missing value outranks a passing one", mixed.overall, "unknown");
expect("the passing check still reports within", mixed.checks[0].status, "within");

// But a real exceedance outranks an unknown — the worst news wins.
const exceededAndUnknown = evaluateMinimums(
  uas({ maxWindKt: 10, maxGustKt: 25 }),
  wx({ windSpeedKt: 22 }),
);
expect("an exceedance outranks an unknown", exceededAndUnknown.overall, "exceeded");

console.log("crosswind check plumbing");
const noRunway = evaluateMinimums(
  uas({ maxCrosswindKt: 12 }),
  wx({ windSpeedKt: 20, windDirectionDeg: 90 }),
);
expect("a crosswind limit with no runway heading is unknown", noRunway.overall, "unknown");
expect(
  "and says why",
  noRunway.checks[0].detail.includes("runway heading"),
  true,
);

const noDirection = evaluateMinimums(
  uas({ maxCrosswindKt: 12, runwayHeadingDeg: 0 }),
  wx({ windSpeedKt: 20 }),
);
expect("a crosswind limit with no wind direction is unknown", noDirection.overall, "unknown");

const realCrosswind = evaluateMinimums(
  uas({ maxCrosswindKt: 12, runwayHeadingDeg: 0 }),
  wx({ windSpeedKt: 20, windDirectionDeg: 90 }),
);
expect("a full 20 kt crosswind exceeds a 12 kt limit", realCrosswind.overall, "exceeded");
expect("and reports the computed component", realCrosswind.checks[0].actual, 20);

const alignedWind = evaluateMinimums(
  uas({ maxCrosswindKt: 12, runwayHeadingDeg: 0 }),
  wx({ windSpeedKt: 20, windDirectionDeg: 0 }),
);
expect("a 20 kt headwind is no crosswind at all", alignedWind.checks[0].actual, 0);
expect("and sits within a 12 kt limit", alignedWind.overall, "within");

console.log("configuration state");
expect("no limits set is unconfigured", evaluateMinimums(uas(), wx({})).unconfigured, true);
expect("no limits set reports isConfigured false", isConfigured(uas()), false);
expect("one limit is enough to be configured", isConfigured(uas({ maxWindKt: 10 })), true);
expect(
  "a runway heading alone is not a limit",
  isConfigured(uas({ runwayHeadingDeg: 270 })),
  false,
);
expect(
  "an unset limit produces no check at all",
  evaluateMinimums(uas({ maxWindKt: 15 }), wx({ windSpeedKt: 5, windGustKt: 30 })).checks
    .length,
  1,
);

console.log("\n" + "=".repeat(60));
if (failures === 0) {
  console.log(`PASS — ${checks} checks.`);
} else {
  console.error(`FAIL — ${failures} of ${checks} checks failed.`);
  process.exit(1);
}
