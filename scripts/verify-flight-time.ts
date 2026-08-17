// Verification harness for src/lib/flight-time.ts.
//
// Run: npm run verify:flight-time
//
// Unlike the solar module there is no external authority to check against —
// this is plain clock arithmetic, so expected values can be stated outright
// without guessing at anything owned by a third party. The cases that matter
// are the midnight crossing and the override rule, because both are places
// where a plausible implementation silently does the wrong thing: negative
// elapsed times, or stomping a pilot's hand-corrected entry.

import {
  computeElapsed,
  formatElapsed,
  parseClockTime,
  parseElapsed,
  shouldReplaceElapsed,
  totalFlightTime,
} from "../src/lib/flight-time";

let failures = 0;
let checks = 0;

function expect(label: string, actual: unknown, want: unknown): void {
  checks += 1;
  const ok = JSON.stringify(actual) === JSON.stringify(want);
  if (!ok) {
    failures += 1;
    console.error(`  FAIL  ${label}\n        want ${JSON.stringify(want)}, got ${JSON.stringify(actual)}`);
  }
}

console.log("\nparseClockTime");
expect("HH:MM", parseClockTime("09:30"), 570);
expect("single-digit hour", parseClockTime("9:30"), 570);
expect("with seconds", parseClockTime("09:30:45"), 570);
expect("midnight", parseClockTime("00:00"), 0);
expect("last minute of the day", parseClockTime("23:59"), 1439);
expect("empty string", parseClockTime(""), null);
expect("whitespace only", parseClockTime("   "), null);
expect("hour out of range", parseClockTime("24:00"), null);
expect("minute out of range", parseClockTime("12:60"), null);
expect("not a time", parseClockTime("noon"), null);
expect("partial", parseClockTime("12:"), null);

console.log("computeElapsed — ordinary flights");
expect("23 minutes", computeElapsed("14:00", "14:23"), "00:23:00");
expect("same minute is zero, not null", computeElapsed("14:00", "14:00"), "00:00:00");
expect("one minute", computeElapsed("14:00", "14:01"), "00:01:00");
expect("crossing an hour", computeElapsed("14:50", "15:10"), "00:20:00");
expect("multi-hour", computeElapsed("08:15", "11:45"), "03:30:00");

console.log("computeElapsed — midnight crossing");
// The case a naive implementation returns negative for.
expect("23:40 to 00:15 is 35 minutes", computeElapsed("23:40", "00:15"), "00:35:00");
expect("23:59 to 00:00 is one minute", computeElapsed("23:59", "00:00"), "00:01:00");
expect("22:00 to 02:00 is four hours", computeElapsed("22:00", "02:00"), "04:00:00");

console.log("computeElapsed — missing input");
expect("no landing time", computeElapsed("14:00", ""), null);
expect("no launch time", computeElapsed("", "14:23"), null);
expect("neither", computeElapsed("", ""), null);
expect("unparseable landing", computeElapsed("14:00", "later"), null);

console.log("formatElapsed / parseElapsed round-trip");
expect("zero", formatElapsed(0), "00:00:00");
expect("under an hour", formatElapsed(23), "00:23:00");
expect("over an hour", formatElapsed(95), "01:35:00");
expect("over a day", formatElapsed(1500), "25:00:00");
expect("parse back", parseElapsed("01:35:00"), 95);
expect("parse with seconds", parseElapsed("00:00:30"), 0.5);
expect("parse rejects clock-only", parseElapsed("01:35"), null);
expect("parse rejects empty", parseElapsed(""), null);
expect("parse rejects prose", parseElapsed("about an hour"), null);

console.log("shouldReplaceElapsed — the override rule");
// Empty field: always fill.
expect("fills an empty field", shouldReplaceElapsed("", null), true);
expect("fills a whitespace field", shouldReplaceElapsed("  ", "00:23:00"), true);
// Field holds our own previous output: safe to update.
expect(
  "updates a value we computed ourselves",
  shouldReplaceElapsed("00:23:00", "00:23:00"),
  true,
);
// Field holds something else: the pilot typed it, leave it.
expect(
  "leaves a hand-typed value alone",
  shouldReplaceElapsed("00:25:00", "00:23:00"),
  false,
);
expect(
  "leaves a hand-typed value alone when nothing was computed before",
  shouldReplaceElapsed("00:25:00", null),
  false,
);

console.log("totalFlightTime");
expect(
  "sums three flights",
  totalFlightTime([
    { elapsedTime: "00:23:00" },
    { elapsedTime: "00:31:00" },
    { elapsedTime: "01:06:00" },
  ]),
  { total: "02:00:00", counted: 3, skipped: 0 },
);
expect(
  "reports unreadable entries rather than dropping them silently",
  totalFlightTime([
    { elapsedTime: "00:23:00" },
    { elapsedTime: "" },
    { elapsedTime: "about 20 min" },
  ]),
  { total: "00:23:00", counted: 1, skipped: 2 },
);
expect("no flights", totalFlightTime([]), { total: "00:00:00", counted: 0, skipped: 0 });

console.log("\n" + "=".repeat(60));
if (failures === 0) {
  console.log(`PASS — ${checks} checks.`);
} else {
  console.error(`FAIL — ${failures} of ${checks} checks failed.`);
  process.exit(1);
}
