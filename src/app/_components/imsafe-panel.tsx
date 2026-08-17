"use client";

import React from "react";
import {
  IMSAFE_ITEMS,
  summarizeImsafe,
  type ImsafeAnswer,
  type ImsafeState,
} from "@/lib/imsafe";

// IMSAFE self-assessment panel (plans/08 Phase 2c).
//
// Two deliberate interaction choices:
//
// There is no default answer. Every item starts unanswered, and an unanswered
// item is visibly unanswered — no pre-ticked "I'm fine" that a pilot can
// scroll past and have counted as a considered response. The risk assessment
// reads an untouched IMSAFE as not-assessed for the same reason.
//
// "Flagged" is not styled as failure. A pilot who flags fatigue has done the
// difficult part, which is noticing; the UI should not make that feel like
// getting an answer wrong. Amber, not red, and the copy stays neutral.

export const ImsafePanel: React.FC<{
  state: ImsafeState;
  onChange: (state: ImsafeState) => void;
}> = ({ state, onChange }) => {
  const summary = summarizeImsafe(state);

  const setAnswer = (itemId: string, answer: ImsafeAnswer): void => {
    onChange({ ...state, [itemId]: answer });
  };

  return (
    <div className="bg-card text-card-foreground rounded-2xl shadow-lg p-6 border-t-4 border-violet-500 mt-6">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-card-foreground">IMSAFE</h2>
        <p className="text-sm text-muted-foreground mt-1">
          The pilot-fitness check most people run in their head. Answering it here
          means it is recorded with the flight — and that you notice the day you
          skipped it.
        </p>
      </div>

      <div
        className="mb-4 text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        {summary.untouched ? (
          <span>Not started — {summary.totalCount} questions.</span>
        ) : (
          <span>
            {summary.answeredCount} of {summary.totalCount} answered
            {summary.flagged.length > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-amber-700 dark:text-amber-400">
                  {summary.flagged.length} flagged
                </span>
              </>
            )}
          </span>
        )}
      </div>

      <ul className="space-y-3">
        {IMSAFE_ITEMS.map((item) => {
          const answer = state[item.id] ?? "unanswered";
          const groupName = `imsafe-${item.id}`;
          return (
            <li
              key={item.id}
              className={`p-4 rounded-lg border ${
                answer === "flagged"
                  ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
                  : "border-border bg-muted"
              }`}
            >
              <fieldset>
                <legend className="font-semibold text-card-foreground mb-1">
                  <span
                    className="inline-flex items-center justify-center w-6 h-6 rounded bg-violet-600 text-white text-xs font-bold mr-2"
                    aria-hidden="true"
                  >
                    {item.letter}
                  </span>
                  {item.label}
                  <span className="sr-only">: </span>
                </legend>

                <p className="text-sm text-card-foreground mb-2">{item.prompt}</p>

                <ul className="text-xs text-muted-foreground mb-3 space-y-0.5 list-disc list-inside">
                  {item.considerations.map((consideration, idx) => (
                    <li key={idx}>{consideration}</li>
                  ))}
                </ul>

                <div className="flex flex-wrap gap-2">
                  <label
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium cursor-pointer transition ${
                      answer === "clear"
                        ? "border-emerald-400 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200"
                        : "border-border hover:bg-card"
                    }`}
                  >
                    <input
                      type="radio"
                      name={groupName}
                      checked={answer === "clear"}
                      onChange={() => setAnswer(item.id, "clear")}
                      className="w-4 h-4 accent-emerald-600"
                    />
                    Yes, I&apos;m good
                  </label>

                  <label
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium cursor-pointer transition ${
                      answer === "flagged"
                        ? "border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
                        : "border-border hover:bg-card"
                    }`}
                  >
                    <input
                      type="radio"
                      name={groupName}
                      checked={answer === "flagged"}
                      onChange={() => setAnswer(item.id, "flagged")}
                      className="w-4 h-4 accent-amber-600"
                    />
                    This is a concern
                  </label>
                </div>
              </fieldset>
            </li>
          );
        })}
      </ul>

      {summary.flagged.length > 0 && (
        <div className="mt-4 p-4 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            You flagged{" "}
            <strong>{summary.flagged.map((i) => i.label.toLowerCase()).join(", ")}</strong>
            . Noticing it is the part most people skip. What you do about it is your
            call — but it is worth asking whether this flight has to happen today.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border">
        Self-assessment, recorded with your flight. Nothing here blocks anything, and
        it is not medical advice or a determination that you are fit to fly. You are
        the only one who can answer these.
      </p>
    </div>
  );
};
