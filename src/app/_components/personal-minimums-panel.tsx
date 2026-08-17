"use client";

import React, { useEffect, useState } from "react";
import {
  evaluateMinimums,
  isConfigured,
  loadMinimums,
  saveMinimums,
  type MinimumsStatus,
  type PersonalMinimums,
  type StructuredWeather,
} from "@/lib/personal-minimums";

// Personal minimums panel — the pilot's own limits, checked against the
// forecast that is already on screen.
//
// Deliberately advisory in every visual decision below. There is no blocking
// state, no disabled Save button, no red banner across the form. An exceeded
// limit is presented as information the pilot asked to be shown, because they
// are the one who set the number and they are the one flying.

const STATUS_STYLES: Record<MinimumsStatus, { chip: string; icon: string; word: string }> = {
  within: {
    chip: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    icon: "✓",
    word: "Within limits",
  },
  "at-limit": {
    chip: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    icon: "!",
    word: "At your limit",
  },
  exceeded: {
    chip: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
    icon: "✕",
    word: "Outside your limits",
  },
  unknown: {
    chip: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-600",
    icon: "?",
    word: "Not reported",
  },
};

/** Parse a number input, treating blank as "no limit set". */
function parseLimit(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

const LimitField: React.FC<{
  id: string;
  label: string;
  unit: string;
  value: number | undefined;
  hint?: string;
  max?: number;
  onChange: (value: number | undefined) => void;
}> = ({ id, label, unit, value, hint, max, onChange }) => (
  <div>
    <label htmlFor={id} className="text-xs font-semibold text-muted-foreground block mb-1">
      {label} ({unit})
    </label>
    <input
      id={id}
      type="number"
      inputMode="numeric"
      min={0}
      max={max}
      value={value ?? ""}
      onChange={(e) => onChange(parseLimit(e.target.value))}
      placeholder="—"
      aria-describedby={hint ? `${id}-hint` : undefined}
      className="w-full px-2 py-1 text-sm border border-border rounded focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
    />
    {hint && (
      <p id={`${id}-hint`} className="text-[11px] text-muted-foreground mt-1">
        {hint}
      </p>
    )}
  </div>
);

export const PersonalMinimumsPanel: React.FC<{
  weather: StructuredWeather | null;
}> = ({ weather }) => {
  const [minimums, setMinimums] = useState<PersonalMinimums>({ platform: "uas" });
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load after mount — localStorage is unavailable during SSR, and reading it
  // in the initial state would produce a hydration mismatch.
  useEffect(() => {
    const stored = loadMinimums("uas");
    setMinimums(stored);
    // Open straight into the editor the first time, when there is nothing to
    // show yet. An empty panel with a "configure" button buried in it is how
    // a feature like this goes unused.
    setEditing(!isConfigured(stored));
    setLoaded(true);
  }, []);

  const update = (patch: Partial<PersonalMinimums>): void => {
    const next = { ...minimums, ...patch };
    setMinimums(next);
    saveMinimums(next);
  };

  if (!loaded) return null;

  const verdict = evaluateMinimums(minimums, weather);
  const summary = STATUS_STYLES[verdict.overall];

  return (
    <div className="bg-card text-card-foreground rounded-2xl shadow-lg p-6 border-t-4 border-sky-500 mt-6">
      <div className="flex justify-between items-start mb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-card-foreground">Personal Minimums</h2>
          <p className="text-sm text-muted-foreground mt-1">
            The conditions you have decided you fly in, checked against the forecast.
          </p>
        </div>
        <button
          onClick={() => setEditing((open) => !open)}
          aria-expanded={editing}
          className="px-4 py-2 border border-border rounded-lg hover:bg-muted font-semibold text-sm transition shrink-0"
        >
          {editing ? "Done" : "Edit limits"}
        </button>
      </div>

      {editing && (
        <div className="mb-5 p-4 bg-muted rounded-lg border border-border">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <LimitField
              id="min-wind"
              label="Max sustained wind"
              unit="kt"
              value={minimums.maxWindKt}
              onChange={(v) => update({ maxWindKt: v })}
            />
            <LimitField
              id="min-gust"
              label="Max gust"
              unit="kt"
              value={minimums.maxGustKt}
              onChange={(v) => update({ maxGustKt: v })}
            />
            <LimitField
              id="min-sky"
              label="Max cloud cover"
              unit="%"
              max={100}
              value={minimums.maxSkyCoverPercent}
              onChange={(v) => update({ maxSkyCoverPercent: v })}
            />
            <LimitField
              id="min-crosswind"
              label="Max crosswind"
              unit="kt"
              value={minimums.maxCrosswindKt}
              onChange={(v) => update({ maxCrosswindKt: v })}
              hint="Needs a runway heading to check."
            />
            <LimitField
              id="min-runway"
              label="Runway heading"
              unit="° true"
              max={360}
              value={minimums.runwayHeadingDeg}
              onChange={(v) => update({ runwayHeadingDeg: v })}
              hint="Degrees TRUE, not the painted runway number — those are magnetic."
            />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Leave a field blank to skip that check. Limits are saved on this device.
          </p>
        </div>
      )}

      {verdict.unconfigured ? (
        <p className="text-muted-foreground text-sm py-2">
          No limits set yet. Add the wind and cloud conditions you are comfortable
          flying in, and every pre-flight will check the forecast against them.
        </p>
      ) : !weather ? (
        <p className="text-muted-foreground text-sm py-2">
          Fetch the weather above and your limits will be checked against it.
        </p>
      ) : (
        <>
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold mb-4 ${summary.chip}`}
          >
            <span aria-hidden="true">{summary.icon}</span>
            <span>{summary.word}</span>
          </div>

          <ul className="space-y-2">
            {verdict.checks.map((check) => {
              const style = STATUS_STYLES[check.status];
              return (
                <li
                  key={check.id}
                  className="flex items-start gap-3 py-2 border-b border-border last:border-0"
                >
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full border text-xs font-bold shrink-0 ${style.chip}`}
                    aria-hidden="true"
                  >
                    {style.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-card-foreground">
                      {check.label}
                      <span className="sr-only">: {style.word}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">{check.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          {verdict.hasUnknowns && (
            <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border">
              A limit shown as not reported has <strong>not</strong> been checked. The
              forecast did not include that value — it does not mean conditions are
              within your limits.
            </p>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border">
        Advisory only. These are your own numbers checked against a forecast, not a
        clearance and not a legal determination. Conditions on site can differ from any
        forecast, and the decision to fly is yours.
      </p>
    </div>
  );
};
