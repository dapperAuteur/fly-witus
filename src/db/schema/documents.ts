import { boolean, date, index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { aircraftProfiles } from "./aircraft-profiles";

// Documents locker — plans/08 Phase 2b.
//
// Two tables, because the two things expire differently and belong to
// different owners: credentials belong to a PILOT, documents belong to an
// AIRCRAFT. A pilot who flies three aircraft has one set of credentials and
// three document sets, and modelling them as one table would force a
// nullable owner on every row.
//
// WHAT THIS DELIBERATELY IS NOT
//
// It is not a compliance engine. It stores documents the pilot tells us about
// and reminds them before a date they entered. It does not decide whether a
// given operation is legal, and the UI must not imply that a full locker
// means a legal flight — requirements vary by operation, by aircraft, and by
// the certificate being exercised. See plans/08 §7 and
// plans/user-tasks/27-bam-source-cfi-rule-reviewer.md; this ships behind a
// feature flag until a qualified human has read the rule logic.
//
// Dates are `date`, not `timestamp`. A medical expires at the end of a day in
// the pilot's own locale, not at an instant in UTC, and storing an instant
// would make a certificate appear expired several hours early for anyone west
// of Greenwich.

export const credentialKind = pgEnum("credential_kind", [
  "pilot_certificate",
  "government_id",
  // The three routes to medical eligibility are modelled separately rather
  // than as one "medical" row, because they have genuinely different clocks.
  // Collapsing them would force the UI to guess which rules to apply.
  "medical_certificate",
  "basicmed_exam",
  "basicmed_course",
  "student_endorsement",
  "flight_review",
  "part_107_certificate",
  "trust_certificate",
  "other",
]);

export const pilotCredentials = pgTable(
  "pilot_credentials",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    kind: credentialKind("kind").notNull(),
    // Free-text label so a pilot can distinguish two rows of the same kind
    // ("Third class", "CFI renewal") without us enumerating every variant.
    label: text("label"),
    referenceNumber: text("reference_number"),

    issuedOn: date("issued_on"),
    // Nullable: some credentials do not expire, and a pilot may not know the
    // date yet. Null means "no expiry tracked", never "expired".
    expiresOn: date("expires_on"),

    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("pilot_credentials_user_idx").on(table.userId, table.expiresOn),
  ],
);

// The ARROW set, plus the state registration the CFI review called out
// separately ("Registration (state and federal)").
export const aircraftDocumentKind = pgEnum("aircraft_document_kind", [
  "airworthiness_certificate",
  "registration_federal",
  "registration_state",
  "radio_station_licence",
  "operating_limitations",
  "weight_and_balance",
  "insurance",
  "other",
]);

export const aircraftDocuments = pgTable(
  "aircraft_documents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    aircraftId: text("aircraft_id")
      .notNull()
      .references(() => aircraftProfiles.id, { onDelete: "cascade" }),

    kind: aircraftDocumentKind("kind").notNull(),
    label: text("label"),
    referenceNumber: text("reference_number"),

    // Distinct from "I have one" — several of these must physically be in the
    // aircraft, and a pilot can own a current document that is sitting on a
    // desk at home. Tracking only existence would miss that.
    onBoard: boolean("on_board").notNull().default(false),

    issuedOn: date("issued_on"),
    expiresOn: date("expires_on"),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("aircraft_documents_user_idx").on(table.userId, table.expiresOn),
    index("aircraft_documents_aircraft_idx").on(table.aircraftId),
  ],
);

export type PilotCredential = typeof pilotCredentials.$inferSelect;
export type NewPilotCredential = typeof pilotCredentials.$inferInsert;
export type AircraftDocument = typeof aircraftDocuments.$inferSelect;
export type NewAircraftDocument = typeof aircraftDocuments.$inferInsert;
