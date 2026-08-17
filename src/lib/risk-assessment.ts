// Pre-flight risk assessment (FRAT).
//
// Roadmap item p4. The CFI who reviewed the app called this out as the thing
// she liked — while it was still only a line on the roadmap page. This is the
// implementation.
//
// STRUCTURED ON PAVE, NOT ON AN INVENTED SCHEME
//
// Factors are grouped by the FAA's PAVE checklist — Pilot, Aircraft,
// enVironment, External pressures. That framing is deliberate: a GA pilot has
// already been taught it, so the output reads as a familiar tool rather than
// as a number this app made up. Inventing a bespoke scoring scheme would have
// been easier and would have produced something nobody could calibrate
// against their training.
//
// A SCORE ALONE IS USELESS
//
// "7 out of 10" tells a pilot nothing they can act on. Every band here comes
// with a recommended action, and every factor that scores carries a sentence
// saying what specifically drove it. The number is an index into the
// explanation, not the product.
//
// PARTIAL BY DESIGN, AND IT SAYS WHICH PART
//
// Aircraft still cannot be assessed — the maintenance tracker is a later phase
// (plans/08). Pilot became assessable in Phase 2 with IMSAFE, but only once
// the pilot actually fills it in; an untouched IMSAFE is 'not-assessed', not
// 'fine'. Rather than quietly scoring an unassessed category as zero, which
// would flatter every assessment, those categories are excluded from the
// maths and named in the output. A tool that says "low risk" while having
// looked at half the picture is worse than one that admits the gap.
//
// ADVISORY. Nothing here blocks a flight or asserts a legal conclusion.

import type { ImsafeSummary } from "./imsafe";
import type { MinimumsVerdict } from "./personal-minimums";
import { minutesUntilSunset, type SolarTimes } from "./solar";

export type RiskCategory = "pilot" | "aircraft" | "environment" | "external";

export type FactorStatus = "ok" | "caution" | "elevated" | "not-assessed";

export interface RiskFactor {
  id: string;
  category: RiskCategory;
  label: string;
  status: FactorStatus;
  /** Points contributed. Zero for 'ok' and for 'not-assessed'. */
  points: number;
  /** Worst-case points this factor could contribute, for the denominator. */
  maxPoints: number;
  detail: string;
}

export type RiskBand = "low" | "moderate" | "elevated" | "high";

export interface RiskAssessment {
  factors: RiskFactor[];
  /** Points scored across assessed factors. */
  score: number;
  /** Points available across assessed factors only. */
  assessedMax: number;
  band: RiskBand;
  headline: string;
  /** What to actually do about it. Never empty. */
  actions: string[];
  /** Categories with nothing assessed — named so the score reads as partial. */
  unassessedCategories: RiskCategory[];
}

export interface RiskInputs {
  minimums: MinimumsVerdict;
  /** Null when no location has been set, so daylight cannot be evaluated. */
  solar: SolarTimes | null;
  /** Planned flight duration in minutes, if the pilot supplied one. */
  plannedDurationMinutes?: number;
  /** Pilot declares they are under schedule/client pressure to fly. */
  externalPressure?: boolean;
  /** Pilot declares the site is unfamiliar to them. */
  unfamiliarSite?: boolean;
  /** IMSAFE self-assessment. Undefined or untouched means not assessed. */
  imsafe?: ImsafeSummary;
  /** Evaluation time. Injectable so the assessment is testable. */
  now?: Date;
}

const CATEGORY_LABELS: Record<RiskCategory, string> = {
  pilot: "Pilot",
  aircraft: "Aircraft",
  environment: "Environment",
  external: "External pressures",
};

export function categoryLabel(category: RiskCategory): string {
  return CATEGORY_LABELS[category];
}

/**
 * Weather against the pilot's own limits — the heaviest single environmental
 * factor, because it is the one the pilot already told us they care about.
 *
 * Note that 'unknown' scores. Uncertainty is itself a risk: a limit you set
 * and cannot verify is a worse position than one you verified and cleared.
 */
function weatherFactor(minimums: MinimumsVerdict): RiskFactor {
  const base = {
    id: "weather-minimums",
    category: "environment" as const,
    label: "Weather vs your personal minimums",
    maxPoints: 4,
  };

  if (minimums.unconfigured) {
    return {
      ...base,
      status: "caution",
      points: 1,
      detail:
        "You have not set personal minimums, so there is nothing to check the forecast against.",
    };
  }

  switch (minimums.overall) {
    case "exceeded":
      return {
        ...base,
        status: "elevated",
        points: 4,
        detail: "The forecast is outside at least one limit you set for yourself.",
      };
    case "at-limit":
      return {
        ...base,
        status: "caution",
        points: 2,
        detail: "The forecast sits right at one of your limits.",
      };
    case "unknown":
      return {
        ...base,
        status: "caution",
        points: 1,
        detail:
          "At least one of your limits could not be checked — the forecast did not report that value.",
      };
    default:
      return {
        ...base,
        status: "ok",
        points: 0,
        detail: "The forecast is inside every limit you set.",
      };
  }
}

/**
 * Daylight margin — how much light remains after the flight is planned to end.
 *
 * Astronomy only. This reports the margin; it does not decide whether an
 * operation after sunset is permitted, which depends on rules and equipment
 * this module knows nothing about. See the regulations note in solar.ts.
 */
function daylightFactor(
  solar: SolarTimes | null,
  plannedDurationMinutes: number | undefined,
  now: Date,
): RiskFactor {
  const base = {
    id: "daylight-margin",
    category: "environment" as const,
    label: "Daylight remaining",
    maxPoints: 3,
  };

  if (!solar) {
    return {
      ...base,
      status: "not-assessed",
      points: 0,
      detail: "Set a launch location to check daylight.",
    };
  }

  if (solar.kind === "always-up") {
    return { ...base, status: "ok", points: 0, detail: "The sun does not set today." };
  }
  if (solar.kind === "always-down") {
    return {
      ...base,
      status: "elevated",
      points: 3,
      detail: "The sun does not rise today — this is a night operation throughout.",
    };
  }

  const remaining = minutesUntilSunset(solar, now);
  if (remaining === null) {
    return {
      ...base,
      status: "not-assessed",
      points: 0,
      detail: "Daylight could not be computed for this location.",
    };
  }

  const margin = remaining - (plannedDurationMinutes ?? 0);
  const round = Math.round(margin);

  if (margin < 0) {
    return {
      ...base,
      status: "elevated",
      points: 3,
      detail:
        plannedDurationMinutes === undefined
          ? "The sun has already set."
          : `The flight as planned runs about ${Math.abs(round)} minutes past sunset.`,
    };
  }
  if (margin < 30) {
    return {
      ...base,
      status: "elevated",
      points: 2,
      detail: `About ${round} minutes of daylight left after the planned flight — very little margin.`,
    };
  }
  if (margin < 60) {
    return {
      ...base,
      status: "caution",
      points: 1,
      detail: `About ${round} minutes of daylight left after the planned flight.`,
    };
  }
  return {
    ...base,
    status: "ok",
    points: 0,
    detail: `About ${Math.round(remaining / 60)} hours of daylight remaining.`,
  };
}

/**
 * Pilot fitness, from the IMSAFE self-assessment.
 *
 * An untouched or partially-filled IMSAFE reports 'not-assessed' rather than
 * scoring zero. This is the same rule the minimums check follows: not having
 * asked is not the same as having asked and been reassured, and the one thing
 * this module must never do is let a blank form read as a clean bill.
 *
 * Flags are weighted heavily because pilot state is the category that shows up
 * in accident causation most reliably, and because a pilot who flags one has
 * already done the hard part — noticing.
 */
function imsafeFactor(imsafe: ImsafeSummary | undefined): RiskFactor {
  const base = {
    id: "pilot-fitness",
    category: "pilot" as const,
    label: "Pilot fitness (IMSAFE)",
    maxPoints: 4,
  };

  if (!imsafe || imsafe.untouched) {
    return {
      ...base,
      status: "not-assessed",
      points: 0,
      maxPoints: 0,
      detail: "IMSAFE not started. Six questions, and they only work if you answer them.",
    };
  }

  if (!imsafe.complete) {
    return {
      ...base,
      status: "caution",
      points: 1,
      detail: `IMSAFE partly answered — ${imsafe.unanswered.length} of ${imsafe.totalCount} still blank (${imsafe.unanswered
        .map((i) => i.label.toLowerCase())
        .join(", ")}).`,
    };
  }

  if (imsafe.flagged.length === 0) {
    return {
      ...base,
      status: "ok",
      points: 0,
      detail: "IMSAFE complete with nothing flagged.",
    };
  }

  const names = imsafe.flagged.map((i) => i.label.toLowerCase()).join(", ");
  if (imsafe.flagged.length === 1) {
    return {
      ...base,
      status: "elevated",
      points: 3,
      detail: `You flagged ${names} on IMSAFE.`,
    };
  }
  return {
    ...base,
    status: "elevated",
    points: 4,
    detail: `You flagged ${imsafe.flagged.length} IMSAFE items: ${names}.`,
  };
}

/**
 * Assemble a risk assessment.
 *
 * Pilot and Aircraft factors are emitted as 'not-assessed' placeholders rather
 * than omitted, so the UI can show the pilot exactly what has not been looked
 * at instead of presenting a partial picture as a complete one.
 */
export function assessRisk(inputs: RiskInputs): RiskAssessment {
  const now = inputs.now ?? new Date();

  const factors: RiskFactor[] = [
    weatherFactor(inputs.minimums),
    daylightFactor(inputs.solar, inputs.plannedDurationMinutes, now),
    {
      id: "external-pressure",
      category: "external",
      label: "Schedule or client pressure",
      status: inputs.externalPressure ? "elevated" : "ok",
      points: inputs.externalPressure ? 3 : 0,
      maxPoints: 3,
      detail: inputs.externalPressure
        ? "You said you are under pressure to complete this flight. This is the factor most often present in accident reports."
        : "No schedule pressure declared.",
    },
    {
      id: "unfamiliar-site",
      category: "environment",
      label: "Site familiarity",
      status: inputs.unfamiliarSite ? "caution" : "ok",
      points: inputs.unfamiliarSite ? 2 : 0,
      maxPoints: 2,
      detail: inputs.unfamiliarSite
        ? "You have not flown this site before — allow extra time for the survey."
        : "Familiar site.",
    },
    imsafeFactor(inputs.imsafe),
    {
      id: "aircraft-condition",
      category: "aircraft",
      label: "Aircraft condition and maintenance",
      status: "not-assessed",
      points: 0,
      maxPoints: 0,
      detail: "Maintenance tracking is not part of this release.",
    },
  ];

  const assessed = factors.filter((f) => f.status !== "not-assessed");
  const score = assessed.reduce((sum, f) => sum + f.points, 0);
  const assessedMax = assessed.reduce((sum, f) => sum + f.maxPoints, 0);

  const unassessedCategories = (
    ["pilot", "aircraft", "environment", "external"] as RiskCategory[]
  ).filter((category) => {
    const inCategory = factors.filter((f) => f.category === category);
    return inCategory.length > 0 && inCategory.every((f) => f.status === "not-assessed");
  });

  // Band on the PROPORTION of available points scored, not on a raw total.
  // The denominator shifts as factors become assessable, so a fixed threshold
  // would silently re-calibrate itself every time a factor is added.
  const ratio = assessedMax > 0 ? score / assessedMax : 0;

  let band: RiskBand;
  if (ratio === 0) band = "low";
  else if (ratio < 0.25) band = "moderate";
  else if (ratio < 0.5) band = "elevated";
  else band = "high";

  // Any single elevated factor floors the band at elevated. Averaging is the
  // classic failure of scored checklists — three benign factors should not
  // dilute one serious one into looking acceptable.
  const hasElevated = assessed.some((f) => f.status === "elevated");
  if (hasElevated && (band === "low" || band === "moderate")) band = "elevated";

  const drivers = assessed
    .filter((f) => f.points > 0)
    .sort((a, b) => b.points - a.points);

  const headline =
    band === "low"
      ? "Nothing flagged in what was checked."
      : band === "moderate"
        ? "One or two things worth a second look."
        : band === "elevated"
          ? `${drivers.length} factor${drivers.length === 1 ? "" : "s"} above baseline.`
          : "Several factors stacking up.";

  const actions: string[] = [];
  if (band === "high" || band === "elevated") {
    actions.push(
      "Consider whether a delay removes the pressure — most of these factors improve on their own with time.",
    );
  }
  for (const driver of drivers.slice(0, 3)) {
    actions.push(driver.detail);
  }
  if (unassessedCategories.length > 0) {
    actions.push(
      `This score does not include ${unassessedCategories
        .map((c) => CATEGORY_LABELS[c].toLowerCase())
        .join(" or ")}. Assess ${unassessedCategories.length === 1 ? "it" : "them"} yourself before you fly.`,
    );
  }
  if (actions.length === 0) {
    actions.push("Nothing flagged. Fly the checklist as normal.");
  }

  return {
    factors,
    score,
    assessedMax,
    band,
    headline,
    actions,
    unassessedCategories,
  };
}
