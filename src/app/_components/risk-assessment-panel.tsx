"use client";

import React, { useMemo, useState } from "react";
import {
  assessRisk,
  categoryLabel,
  type RiskBand,
  type FactorStatus,
} from "@/lib/risk-assessment";
import type { MinimumsVerdict } from "@/lib/personal-minimums";
import { formatSolarTime, type SolarTimes } from "@/lib/solar";

// Pre-flight risk assessment panel (roadmap p4).
//
// The design rule throughout: the number is an index into an explanation, not
// the product. A pilot who reads "elevated" and nothing else has learned
// nothing, so the band is always accompanied by what drove it and what to do.

const BAND_STYLES: Record<RiskBand, { chip: string; word: string }> = {
  low: {
    chip: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    word: "Low",
  },
  moderate: {
    chip: "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
    word: "Moderate",
  },
  elevated: {
    chip: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    word: "Elevated",
  },
  high: {
    chip: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
    word: "High",
  },
};

const FACTOR_ICONS: Record<FactorStatus, string> = {
  ok: "✓",
  caution: "!",
  elevated: "▲",
  "not-assessed": "–",
};

const FACTOR_TEXT: Record<FactorStatus, string> = {
  ok: "text-emerald-700 dark:text-emerald-400",
  caution: "text-amber-700 dark:text-amber-400",
  elevated: "text-red-700 dark:text-red-400",
  "not-assessed": "text-muted-foreground",
};

export const RiskAssessmentPanel: React.FC<{
  minimums: MinimumsVerdict;
  solar: SolarTimes | null;
}> = ({ minimums, solar }) => {
  const [plannedDuration, setPlannedDuration] = useState("");
  const [externalPressure, setExternalPressure] = useState(false);
  const [unfamiliarSite, setUnfamiliarSite] = useState(false);

  const parsedDuration = useMemo(() => {
    const value = Number(plannedDuration.trim());
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }, [plannedDuration]);

  const assessment = useMemo(
    () =>
      assessRisk({
        minimums,
        solar,
        plannedDurationMinutes: parsedDuration,
        externalPressure,
        unfamiliarSite,
      }),
    [minimums, solar, parsedDuration, externalPressure, unfamiliarSite],
  );

  const bandStyle = BAND_STYLES[assessment.band];

  // Group factors by PAVE category so the output maps onto training a pilot
  // already has, rather than presenting a flat list of our own devising.
  const categories = ["pilot", "aircraft", "environment", "external"] as const;

  return (
    <div className="bg-card text-card-foreground rounded-2xl shadow-lg p-6 border-t-4 border-amber-500 mt-6">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-card-foreground">Pre-Flight Risk Assessment</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Grouped by PAVE — Pilot, Aircraft, enVironment, External pressures.
        </p>
      </div>

      <div className="mb-5 p-4 bg-muted rounded-lg border border-border">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="planned-duration"
              className="text-xs font-semibold text-muted-foreground block mb-1"
            >
              Planned flight time (minutes)
            </label>
            <input
              id="planned-duration"
              type="number"
              inputMode="numeric"
              min={0}
              value={plannedDuration}
              onChange={(e) => setPlannedDuration(e.target.value)}
              placeholder="e.g. 25"
              aria-describedby="planned-duration-hint"
              className="w-full px-2 py-1 text-sm border border-border rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
            <p id="planned-duration-hint" className="text-[11px] text-muted-foreground mt-1">
              Used to work out how much daylight is left when you land.
            </p>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-muted-foreground mb-1">
              Anything else in play?
            </legend>
            <label className="flex items-start gap-2 text-sm text-card-foreground">
              <input
                type="checkbox"
                checked={externalPressure}
                onChange={(e) => setExternalPressure(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-amber-600"
              />
              <span>I am under schedule or client pressure to complete this flight</span>
            </label>
            <label className="flex items-start gap-2 text-sm text-card-foreground">
              <input
                type="checkbox"
                checked={unfamiliarSite}
                onChange={(e) => setUnfamiliarSite(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-amber-600"
              />
              <span>I have not flown this site before</span>
            </label>
          </fieldset>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold ${bandStyle.chip}`}
        >
          {bandStyle.word} risk
        </span>
        <span className="text-sm text-muted-foreground">
          {assessment.headline} Scored {assessment.score} of {assessment.assessedMax} points
          across what could be checked.
        </span>
      </div>

      {solar && solar.kind === "normal" && (
        <p className="text-xs text-muted-foreground mb-4">
          Sunrise {formatSolarTime(solar.sunrise)} · sunset {formatSolarTime(solar.sunset)} ·
          civil twilight ends {formatSolarTime(solar.civilTwilightEnd)}
        </p>
      )}

      <div className="space-y-4 mb-5">
        {categories.map((category) => {
          const factors = assessment.factors.filter((f) => f.category === category);
          if (factors.length === 0) return null;
          return (
            <div key={category}>
              <h3 className="text-sm font-bold text-card-foreground mb-2">
                {categoryLabel(category)}
              </h3>
              <ul className="space-y-1.5">
                {factors.map((factor) => (
                  <li key={factor.id} className="flex items-start gap-3 text-sm">
                    <span
                      className={`font-bold shrink-0 w-4 text-center ${FACTOR_TEXT[factor.status]}`}
                      aria-hidden="true"
                    >
                      {FACTOR_ICONS[factor.status]}
                    </span>
                    <div className="min-w-0">
                      <span className="font-semibold text-card-foreground">
                        {factor.label}
                      </span>
                      {factor.status === "not-assessed" && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (not assessed)
                        </span>
                      )}
                      <p className="text-muted-foreground">{factor.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-muted rounded-lg border border-border">
        <h3 className="text-sm font-bold text-card-foreground mb-2">What to do about it</h3>
        <ul className="space-y-1.5 list-disc list-inside">
          {assessment.actions.map((action, idx) => (
            <li key={idx} className="text-sm text-muted-foreground">
              {action}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border">
        Advisory only. This is a structured prompt to think, not a clearance, an
        authorisation, or a legal determination — and it does not cover pilot fitness or
        aircraft condition. The decision to fly is yours.
      </p>
    </div>
  );
};
