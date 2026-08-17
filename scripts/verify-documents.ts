// Verification harness for src/lib/documents-api.ts.
//
// Run: npm run verify:documents
//
// The interesting logic here is entirely about date boundaries, which is where
// expiry tracking gets quietly wrong:
//
//   - a document expiring TODAY is not expired
//   - a null expiry is "not tracked", never "current"
//   - day counts are whole days in the viewer's own calendar, not fractions of
//     a UTC instant, so a certificate valid "through 31 October" is valid all
//     of the 31st where the pilot is standing

import {
  EXPIRY_WARNING_DAYS,
  classifyExpiry,
  AIRCRAFT_DOCUMENT_KINDS,
  AIRCRAFT_DOCUMENT_LABELS,
  CREDENTIAL_KINDS,
  CREDENTIAL_LABELS,
  aircraftDocumentInputSchema,
  pilotCredentialInputSchema,
} from "../src/lib/documents-api";

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

// Fixed "today" so the suite is deterministic. Local midday, deliberately not
// midnight, so a boundary bug cannot hide behind a lucky hour.
const TODAY = new Date(2026, 7, 17, 12, 0, 0); // 17 Aug 2026, local

console.log("\nclassifyExpiry — boundaries");
expect("no date is not-tracked", classifyExpiry(null, TODAY).status, "not-tracked");
expect("undefined is not-tracked", classifyExpiry(undefined, TODAY).status, "not-tracked");
expect("empty string is not-tracked", classifyExpiry("", TODAY).status, "not-tracked");
ok(
  "not-tracked never reports as current",
  classifyExpiry(null, TODAY).status !== "current",
);

// The single most important boundary: expiring today is not expired.
expect("expiring today is expiring", classifyExpiry("2026-08-17", TODAY).status, "expiring");
expect("expiring today reports zero days", classifyExpiry("2026-08-17", TODAY).daysRemaining, 0);
expect(
  "yesterday is expired",
  classifyExpiry("2026-08-16", TODAY).status,
  "expired",
);
expect("tomorrow is expiring", classifyExpiry("2026-08-18", TODAY).status, "expiring");

console.log("classifyExpiry — the warning window");
expect(
  "the last day of the window is expiring",
  classifyExpiry("2026-10-16", TODAY).status, // exactly 60 days out
  "expiring",
);
expect(
  "one day past the window is current",
  classifyExpiry("2026-10-17", TODAY).status, // 61 days out
  "current",
);
ok(
  "the window constant matches the behaviour",
  classifyExpiry("2026-10-16", TODAY).daysRemaining === EXPIRY_WARNING_DAYS,
  `${classifyExpiry("2026-10-16", TODAY).daysRemaining}`,
);

console.log("classifyExpiry — day counts are whole days");
expect("30 days out", classifyExpiry("2026-09-16", TODAY).daysRemaining, 30);
expect("a year out", classifyExpiry("2027-08-17", TODAY).daysRemaining, 365);
expect("expired a week ago", classifyExpiry("2026-08-10", TODAY).daysRemaining, -7);
// Across a month boundary and a leap year, where naive day arithmetic slips.
expect("across a month end", classifyExpiry("2026-09-01", TODAY).daysRemaining, 15);
expect(
  "across a leap day",
  classifyExpiry("2028-03-01", new Date(2028, 1, 28, 12)).daysRemaining,
  2,
);

console.log("classifyExpiry — messages read sensibly");
ok(
  "singular day is not pluralised",
  classifyExpiry("2026-08-18", TODAY).message.includes("1 day."),
  classifyExpiry("2026-08-18", TODAY).message,
);
ok(
  "expired singular is not pluralised",
  classifyExpiry("2026-08-16", TODAY).message.includes("1 day ago"),
  classifyExpiry("2026-08-16", TODAY).message,
);
ok(
  "not-tracked says so plainly rather than implying validity",
  classifyExpiry(null, TODAY).message.toLowerCase().includes("not being tracked"),
);

console.log("classifyExpiry — garbage in");
expect("unparseable date is not-tracked", classifyExpiry("soon", TODAY).status, "not-tracked");
ok(
  "and never claims current",
  classifyExpiry("not-a-date", TODAY).status !== "current",
);

console.log("every kind has a label");
for (const kind of CREDENTIAL_KINDS) {
  ok(`credential '${kind}' has a label`, Boolean(CREDENTIAL_LABELS[kind]));
}
for (const kind of AIRCRAFT_DOCUMENT_KINDS) {
  ok(`aircraft document '${kind}' has a label`, Boolean(AIRCRAFT_DOCUMENT_LABELS[kind]));
}

console.log("input validation");
ok(
  "a bare kind is enough to create a credential",
  pilotCredentialInputSchema.safeParse({ kind: "pilot_certificate" }).success,
);
ok(
  "an unknown kind is rejected",
  !pilotCredentialInputSchema.safeParse({ kind: "drivers_licence" }).success,
);
ok(
  "a malformed date is rejected",
  !pilotCredentialInputSchema.safeParse({
    kind: "medical_certificate",
    expiresOn: "31/10/2026",
  }).success,
);
ok(
  "an impossible date is rejected",
  !pilotCredentialInputSchema.safeParse({
    kind: "medical_certificate",
    expiresOn: "2026-13-45",
  }).success,
);
ok(
  "a valid ISO date is accepted",
  pilotCredentialInputSchema.safeParse({
    kind: "medical_certificate",
    expiresOn: "2026-10-31",
  }).success,
);
ok(
  "aircraft documents require an aircraft",
  !aircraftDocumentInputSchema.safeParse({ kind: "registration_federal" }).success,
);
ok(
  "onBoard defaults to false rather than true",
  aircraftDocumentInputSchema.safeParse({
    aircraftId: "abc",
    kind: "registration_federal",
  }).data?.onBoard === false,
);

console.log("\n" + "=".repeat(60));
if (failures === 0) {
  console.log(`PASS — ${checks} checks.`);
} else {
  console.error(`FAIL — ${failures} of ${checks} checks failed.`);
  process.exit(1);
}
