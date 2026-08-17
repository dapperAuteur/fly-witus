// Elapsed-time arithmetic for the flight log.
//
// Roadmap item m1. The reason this exists, in a CFI's words: a UAS has no
// hobbs meter and no tachometer, so unlike an aircraft there is nothing on
// board that counts hours for you. The pilot is the meter. Making them do
// clock subtraction by hand, in the field, after a flight, is how logs end up
// with 23-minute flights recorded as 32 minutes.
//
// Times arrive from <input type="time">, which yields "HH:MM" in 24-hour form
// regardless of the user's locale display. The elapsed field stays free text
// and stays editable — see the override rules in `shouldReplaceElapsed`.

/** Elapsed times render as HH:MM:SS to match the existing field placeholder. */
const ELAPSED_PATTERN = /^\d{1,3}:[0-5]\d:[0-5]\d$/;

const MINUTES_PER_DAY = 24 * 60;

/**
 * Parse "HH:MM" or "HH:MM:SS" into minutes after midnight.
 * Returns null for anything unparseable, including the empty string.
 *
 * Seconds are truncated rather than rounded: <input type="time"> without a
 * `step` attribute never emits them, so a seconds component only appears if a
 * user typed one, and silently rounding a typed value up to the next minute
 * would be a surprise.
 */
export function parseClockTime(value: string): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const match = /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/.exec(trimmed);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23) return null;

  return hours * 60 + minutes;
}

/** Render a duration in minutes as HH:MM:SS. */
export function formatElapsed(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
}

/**
 * Elapsed time between a launch and a landing clock time, as HH:MM:SS.
 * Returns null when either side is missing or unparseable.
 *
 * MIDNIGHT CROSSING: a landing time earlier than the launch time is treated as
 * the following day rather than as negative elapsed time. A flight launching
 * 23:40 and landing 00:15 ran 35 minutes, not minus 23 hours.
 *
 * This assumption is only safe because the alternative is worse. We have a
 * clock time and no date, so "landed before it launched" is genuinely
 * ambiguous — it could be a midnight crossing or a typo. A negative or
 * 23-hour result would be visibly absurd and get corrected; a 35-minute
 * result is right in the common case, and the field stays editable for the
 * rest. Flights longer than 24 hours are not representable, which no UAS or
 * light-aircraft leg will hit.
 */
export function computeElapsed(
  launchTime: string,
  landingTime: string,
): string | null {
  const launch = parseClockTime(launchTime);
  const landing = parseClockTime(landingTime);
  if (launch === null || landing === null) return null;

  const spanMinutes =
    landing >= launch ? landing - launch : landing + MINUTES_PER_DAY - launch;

  return formatElapsed(spanMinutes);
}

/** Parse an HH:MM:SS elapsed value back into minutes, for totalling. */
export function parseElapsed(value: string): number | null {
  const trimmed = value?.trim();
  if (!trimmed || !ELAPSED_PATTERN.test(trimmed)) return null;

  const [hours, minutes, seconds] = trimmed.split(":").map(Number);
  return hours * 60 + minutes + seconds / 60;
}

/**
 * Whether an auto-computed elapsed value should overwrite what is in the
 * field, given what the field held before the edit and what we would have
 * computed from the times before the edit.
 *
 * The rule: replace it if it is empty, or if it still matches what we
 * previously computed. A value that matches our own previous output was
 * almost certainly put there by us, so updating it is a correction rather
 * than an overwrite. Anything else is the pilot's own number and we leave it
 * alone — the whole point of a logbook is that the pilot's entry is
 * authoritative, and stomping a hand-corrected time on the next keystroke
 * would make the field feel broken.
 *
 * Deliberately stateless. The alternative — a per-flight "user touched this"
 * flag — would have to be persisted alongside the record and pushed through
 * the API payload and the flights table, adding a column to serve a UI
 * nicety. Comparing against the prior computed value gets the same behaviour
 * with nothing stored.
 */
export function shouldReplaceElapsed(
  currentElapsed: string,
  previouslyComputed: string | null,
): boolean {
  const trimmed = currentElapsed?.trim();
  if (!trimmed) return true;
  return previouslyComputed !== null && trimmed === previouslyComputed;
}

/**
 * Total logged time across flights, as HH:MM:SS, plus how many records were
 * counted. Records with an unparseable or empty elapsed value are skipped and
 * reported in `counted` so the UI can say the total is partial rather than
 * quietly under-reporting mission time.
 */
export function totalFlightTime(
  records: Array<{ elapsedTime: string }>,
): { total: string; counted: number; skipped: number } {
  let minutes = 0;
  let counted = 0;
  let skipped = 0;

  for (const record of records) {
    const parsed = parseElapsed(record.elapsedTime);
    if (parsed === null) {
      skipped += 1;
      continue;
    }
    minutes += parsed;
    counted += 1;
  }

  return { total: formatElapsed(minutes), counted, skipped };
}
