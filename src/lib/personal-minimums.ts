// Personal minimums — the limits a pilot sets for themselves, checked against
// the forecast.
//
// Roadmap item n3, which was originally scoped as "wind speed alerts: compare
// current wind to aircraft max specs". This is the better version of that
// idea, and the change is deliberate. An aircraft's max wind spec is a
// manufacturer limit — it says what the airframe survives, not what this
// pilot should attempt today. The CFI who reviewed the app asked for the
// second thing: "a section for personal minimums like max wind, weather
// conditions, crosswind (what I'm comfortable to fly in)".
//
// That is the feature no EFB does well and the one genuinely hard to do in
// your head, because it requires holding your own limits, the forecast, and
// trigonometry at the same time, in a field, under time pressure.
//
// ADVISORY, NEVER BLOCKING. Nothing here prevents a flight or claims a legal
// conclusion. It reports how the forecast sits against numbers the pilot
// themselves chose. The pilot is PIC and the tool does not get a vote.

import type { WeatherSnapshot } from "./noaa";

/**
 * Just the measurable parts of a forecast.
 *
 * Narrower than WeatherSnapshot on purpose: the display strings are irrelevant
 * to a limits check, and depending only on the numbers means a caller holding
 * a partially-populated weather object — which is what the mission form has,
 * since a pilot can type values in by hand — can pass it without a cast.
 */
export type StructuredWeather = Pick<
  WeatherSnapshot,
  "windSpeedKt" | "windGustKt" | "windDirectionDeg" | "skyCoverPercent"
>;

/**
 * Which kind of aircraft a set of limits applies to. A pilot who flies both a
 * quadcopter and a 172 needs two different sets of numbers, and this is the
 * seam the wider pilot module (plans/08) later widens.
 */
export type Platform = "uas" | "manned";

export interface PersonalMinimums {
  platform: Platform;
  /** Max sustained wind, knots. */
  maxWindKt?: number;
  /** Max gust, knots. */
  maxGustKt?: number;
  /**
   * Max crosswind component, knots. Only meaningful with a runway heading to
   * compute against — a UAS has no runway, so this is typically manned-only.
   */
  maxCrosswindKt?: number;
  /** Runway or landing-direction heading in degrees true, for crosswind. */
  runwayHeadingDeg?: number;
  /** Minimum acceptable sky clarity, as max tolerable cloud cover percent. */
  maxSkyCoverPercent?: number;
}

export type MinimumsStatus =
  | "within" // comfortably inside the limit
  | "at-limit" // close enough that it deserves a second look
  | "exceeded" // outside what the pilot said they fly in
  | "unknown"; // the forecast did not give us this value

export interface MinimumsCheck {
  id: string;
  label: string;
  status: MinimumsStatus;
  /** Human-readable statement of the comparison, e.g. "18 kt vs your 15 kt". */
  detail: string;
  /** The pilot's limit, for display. Undefined when they have not set one. */
  limit?: number;
  /** The forecast value. Undefined when the forecast did not supply it. */
  actual?: number;
  unit: string;
}

export interface MinimumsVerdict {
  checks: MinimumsCheck[];
  /** Worst status across all checks — what the summary line should say. */
  overall: MinimumsStatus;
  /** True if any check came back 'unknown'. */
  hasUnknowns: boolean;
  /** True if the pilot has not configured any limits at all. */
  unconfigured: boolean;
}

const STORAGE_KEY = "uas_personal_minimums";

/**
 * How close to a limit counts as "at limit" — the larger of 10% of the limit
 * or 2 knots.
 *
 * A flat percentage misbehaves at both ends: 10% of a 5 kt limit is half a
 * knot, which never triggers, while 10% of a 40 kt limit is 4 kt, which is
 * about right. The 2 kt floor keeps low limits meaningful, and taking the
 * larger of the two keeps high limits from becoming hair-triggered.
 */
function tolerance(limit: number): number {
  return Math.max(2, limit * 0.1);
}

function classify(actual: number, limit: number): MinimumsStatus {
  if (actual > limit) return "exceeded";
  if (actual >= limit - tolerance(limit)) return "at-limit";
  return "within";
}

/**
 * Crosswind component in knots for a wind at `windDirectionDeg` blowing across
 * a runway aligned to `runwayHeadingDeg`.
 *
 * Standard component trigonometry: the crosswind is the wind speed times the
 * sine of the angle between the wind and the runway. Absolute value, because
 * a 20 kt crosswind from the left and from the right are the same magnitude
 * of problem — which side it comes from is a technique question, not a limits
 * question.
 *
 * Both headings are degrees TRUE. NWS reports wind direction in degrees true,
 * while published runway numbers are MAGNETIC. A pilot entering "runway 27"
 * as 270 is giving a magnetic heading, and magnetic variation reaches around
 * 20 degrees at the edges of the continental US, which at 20 kt is a 7 kt
 * error in the crosswind component. See the note in the panel UI — the input
 * has to say which one it wants, and this is flagged in plans/08 as needing a
 * variation correction before the manned module ships.
 */
export function crosswindComponent(
  windSpeedKt: number,
  windDirectionDeg: number,
  runwayHeadingDeg: number,
): number {
  const angleDeg = windDirectionDeg - runwayHeadingDeg;
  const angleRad = (angleDeg * Math.PI) / 180;
  return Math.abs(windSpeedKt * Math.sin(angleRad));
}

/** Headwind component; negative means a tailwind. */
export function headwindComponent(
  windSpeedKt: number,
  windDirectionDeg: number,
  runwayHeadingDeg: number,
): number {
  const angleRad = ((windDirectionDeg - runwayHeadingDeg) * Math.PI) / 180;
  return windSpeedKt * Math.cos(angleRad);
}

/** True if the pilot has set at least one limit. */
export function isConfigured(minimums: PersonalMinimums): boolean {
  return (
    minimums.maxWindKt !== undefined ||
    minimums.maxGustKt !== undefined ||
    minimums.maxCrosswindKt !== undefined ||
    minimums.maxSkyCoverPercent !== undefined
  );
}

/**
 * Compare a forecast against a pilot's stated limits.
 *
 * The rule that matters most here: a limit the pilot set but the forecast
 * could not supply comes back as 'unknown', NOT as 'within'. NWS coverage is
 * uneven — see the header of noaa.ts — and reporting a green check for a
 * value nobody measured would be the single most dangerous thing this module
 * could do. Unknown is surfaced as caution and counted separately.
 */
export function evaluateMinimums(
  minimums: PersonalMinimums,
  weather: StructuredWeather | null,
): MinimumsVerdict {
  const checks: MinimumsCheck[] = [];

  const push = (
    id: string,
    label: string,
    limit: number | undefined,
    actual: number | undefined,
    unit: string,
  ): void => {
    if (limit === undefined) return; // no limit set — nothing to check

    if (actual === undefined) {
      checks.push({
        id,
        label,
        status: "unknown",
        detail: `Your limit is ${limit} ${unit}. The forecast did not report this.`,
        limit,
        unit,
      });
      return;
    }

    const status = classify(actual, limit);
    const detail =
      status === "exceeded"
        ? `${actual} ${unit} — over your ${limit} ${unit} limit.`
        : status === "at-limit"
          ? `${actual} ${unit} — right at your ${limit} ${unit} limit.`
          : `${actual} ${unit}, inside your ${limit} ${unit} limit.`;

    checks.push({ id, label, status, detail, limit, actual, unit });
  };

  push("wind", "Sustained wind", minimums.maxWindKt, weather?.windSpeedKt, "kt");
  push("gust", "Gusts", minimums.maxGustKt, weather?.windGustKt, "kt");

  // Crosswind needs three inputs to be computable: a limit, a runway heading,
  // and both wind speed and direction from the forecast. Missing any of them
  // yields 'unknown' rather than being quietly dropped, so the pilot can see
  // that a limit they set is not being checked.
  if (minimums.maxCrosswindKt !== undefined) {
    const canCompute =
      minimums.runwayHeadingDeg !== undefined &&
      weather?.windSpeedKt !== undefined &&
      weather?.windDirectionDeg !== undefined;

    if (canCompute) {
      const crosswind = Math.round(
        crosswindComponent(
          weather.windSpeedKt as number,
          weather.windDirectionDeg as number,
          minimums.runwayHeadingDeg as number,
        ),
      );
      push("crosswind", "Crosswind component", minimums.maxCrosswindKt, crosswind, "kt");
    } else {
      checks.push({
        id: "crosswind",
        label: "Crosswind component",
        status: "unknown",
        detail:
          minimums.runwayHeadingDeg === undefined
            ? `Your limit is ${minimums.maxCrosswindKt} kt. Set a runway heading to check it.`
            : `Your limit is ${minimums.maxCrosswindKt} kt. The forecast did not report wind direction.`,
        limit: minimums.maxCrosswindKt,
        unit: "kt",
      });
    }
  }

  push(
    "sky",
    "Cloud cover",
    minimums.maxSkyCoverPercent,
    weather?.skyCoverPercent,
    "%",
  );

  const order: MinimumsStatus[] = ["within", "unknown", "at-limit", "exceeded"];
  const overall = checks.reduce<MinimumsStatus>(
    (worst, check) =>
      order.indexOf(check.status) > order.indexOf(worst) ? check.status : worst,
    "within",
  );

  return {
    checks,
    overall,
    hasUnknowns: checks.some((c) => c.status === "unknown"),
    unconfigured: checks.length === 0,
  };
}

// --- Persistence -----------------------------------------------------------
//
// localStorage, matching how aircraft profiles are already stored in
// src/app/page.tsx. This is a deliberate Phase 1 scope choice: plans/08
// specifies a `personal_minimums` table, but a table means a migration, and
// running migrations against prod is an operator task with real cost (see
// plans/user-tasks/19). Keeping Phase 1 free of migrations means it ships to
// existing users without one. Cloud sync for minimums is queued as a
// follow-up in plans/08 §9.

const DEFAULT_MINIMUMS: PersonalMinimums = { platform: "uas" };

export function loadMinimums(platform: Platform = "uas"): PersonalMinimums {
  if (typeof window === "undefined") return { ...DEFAULT_MINIMUMS, platform };
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY}_${platform}`);
    if (!raw) return { ...DEFAULT_MINIMUMS, platform };
    const parsed = JSON.parse(raw) as PersonalMinimums;
    return { ...DEFAULT_MINIMUMS, ...parsed, platform };
  } catch (error) {
    console.error("Failed to load personal minimums:", error);
    return { ...DEFAULT_MINIMUMS, platform };
  }
}

export function saveMinimums(minimums: PersonalMinimums): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${STORAGE_KEY}_${minimums.platform}`,
      JSON.stringify(minimums),
    );
  } catch (error) {
    console.error("Failed to save personal minimums:", error);
  }
}
