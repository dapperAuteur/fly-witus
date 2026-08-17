import { z } from "zod";

// Documents locker — shared validation and expiry logic (plans/08 Phase 2b).
//
// WHAT THIS IS NOT
//
// Not a compliance engine. It stores what the pilot tells us and warns before
// a date they entered. It never decides that a flight is legal, and no copy
// in the UI may imply that a complete locker means a legal operation —
// requirements vary by operation, by aircraft, and by the certificate being
// exercised. Feature-flagged until a qualified human reads the rule logic
// (plans/user-tasks/27).

export const CREDENTIAL_KINDS = [
  "pilot_certificate",
  "government_id",
  "medical_certificate",
  "basicmed_exam",
  "basicmed_course",
  "student_endorsement",
  "flight_review",
  "part_107_certificate",
  "trust_certificate",
  "other",
] as const;

export const AIRCRAFT_DOCUMENT_KINDS = [
  "airworthiness_certificate",
  "registration_federal",
  "registration_state",
  "radio_station_licence",
  "operating_limitations",
  "weight_and_balance",
  "insurance",
  "other",
] as const;

export type CredentialKind = (typeof CREDENTIAL_KINDS)[number];
export type AircraftDocumentKind = (typeof AIRCRAFT_DOCUMENT_KINDS)[number];

export const CREDENTIAL_LABELS: Record<CredentialKind, string> = {
  pilot_certificate: "Pilot certificate",
  government_id: "Government photo ID",
  medical_certificate: "Medical certificate",
  basicmed_exam: "BasicMed physical exam",
  basicmed_course: "BasicMed online course",
  student_endorsement: "Student pilot endorsement",
  flight_review: "Flight review",
  part_107_certificate: "Part 107 remote pilot certificate",
  trust_certificate: "TRUST completion certificate",
  other: "Other",
};

export const AIRCRAFT_DOCUMENT_LABELS: Record<AircraftDocumentKind, string> = {
  airworthiness_certificate: "Airworthiness certificate",
  registration_federal: "Registration (federal)",
  registration_state: "Registration (state)",
  radio_station_licence: "Radio station licence",
  operating_limitations: "Operating limitations (POH/AFM)",
  weight_and_balance: "Weight and balance data",
  insurance: "Insurance",
  other: "Other",
};

/**
 * Notes shown beside particular kinds, so the UI never states a blanket
 * requirement it cannot support.
 *
 * The radio licence note matters: it is conditional, and flagging every
 * domestic pilot for not holding one would be actively wrong. The BasicMed
 * pair matters because they are two independent clocks that pilots routinely
 * conflate.
 */
export const KIND_NOTES: Partial<Record<CredentialKind | AircraftDocumentKind, string>> = {
  radio_station_licence:
    "Only required for some operations, typically international. Skip it if it does not apply to yours.",
  basicmed_exam: "BasicMed runs two separate clocks — the physical exam and the online course.",
  basicmed_course: "The other BasicMed clock. It is not the same date as the exam.",
  medical_certificate:
    "Only one route to medical eligibility applies to you. Track the one you actually use.",
  student_endorsement: "Endorsements are specific to what they authorise. Note which one this is.",
};

// A YYYY-MM-DD calendar date, which is what <input type="date"> emits and what
// the `date` columns store. Deliberately not a datetime: a certificate expires
// at the end of a day where the pilot is, not at an instant in UTC.
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Not a real date");

export const pilotCredentialInputSchema = z.object({
  kind: z.enum(CREDENTIAL_KINDS),
  label: z.string().trim().max(120).nullish(),
  referenceNumber: z.string().trim().max(60).nullish(),
  issuedOn: calendarDate.nullish(),
  expiresOn: calendarDate.nullish(),
  notes: z.string().trim().max(2_000).nullish(),
});

export const aircraftDocumentInputSchema = z.object({
  aircraftId: z.string().trim().min(1),
  kind: z.enum(AIRCRAFT_DOCUMENT_KINDS),
  label: z.string().trim().max(120).nullish(),
  referenceNumber: z.string().trim().max(60).nullish(),
  onBoard: z.boolean().default(false),
  issuedOn: calendarDate.nullish(),
  expiresOn: calendarDate.nullish(),
  notes: z.string().trim().max(2_000).nullish(),
});

export const pilotCredentialUpdateSchema = pilotCredentialInputSchema.partial();
export const aircraftDocumentUpdateSchema = aircraftDocumentInputSchema.partial();

export type PilotCredentialInput = z.infer<typeof pilotCredentialInputSchema>;
export type AircraftDocumentInput = z.infer<typeof aircraftDocumentInputSchema>;

export type ExpiryStatus = "expired" | "expiring" | "current" | "not-tracked";

export interface ExpiryView {
  status: ExpiryStatus;
  daysRemaining: number | null;
  message: string;
}

/** Warn this far ahead of an expiry. */
export const EXPIRY_WARNING_DAYS = 60;

/**
 * Classify an expiry date.
 *
 * A null date is `not-tracked`, never `current`. A pilot who has not entered
 * an expiry has told us nothing, and rendering that as a green "current" would
 * be the same error the minimums check is careful to avoid: silence read as
 * reassurance.
 *
 * Comparison is done on calendar dates in the viewer's own timezone rather
 * than on instants. A medical valid "through 31 October" is valid all of the
 * 31st where the pilot is standing, and an instant comparison would expire it
 * early for anyone west of UTC.
 */
export function classifyExpiry(
  expiresOn: string | null | undefined,
  today: Date = new Date(),
): ExpiryView {
  if (!expiresOn) {
    return {
      status: "not-tracked",
      daysRemaining: null,
      message: "No expiry date recorded — this is not being tracked.",
    };
  }

  const [year, month, day] = expiresOn.split("-").map(Number);
  if (!year || !month || !day) {
    return {
      status: "not-tracked",
      daysRemaining: null,
      message: "Expiry date could not be read.",
    };
  }

  // Both sides reduced to local midnight so the difference is whole days.
  const expiry = new Date(year, month - 1, day);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysRemaining = Math.round((expiry.getTime() - start.getTime()) / 86_400_000);

  if (daysRemaining < 0) {
    const days = Math.abs(daysRemaining);
    return {
      status: "expired",
      daysRemaining,
      message: `Expired ${days} ${days === 1 ? "day" : "days"} ago.`,
    };
  }
  if (daysRemaining === 0) {
    return { status: "expiring", daysRemaining, message: "Expires today." };
  }
  if (daysRemaining <= EXPIRY_WARNING_DAYS) {
    return {
      status: "expiring",
      daysRemaining,
      message: `Expires in ${daysRemaining} ${daysRemaining === 1 ? "day" : "days"}.`,
    };
  }
  return {
    status: "current",
    daysRemaining,
    message: `Current for another ${daysRemaining} days.`,
  };
}
