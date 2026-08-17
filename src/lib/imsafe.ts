// IMSAFE — the pilot-fitness self-assessment.
//
// plans/08 Phase 2c. Requested directly in the CFI review: "There are a few
// checklists that pilots go through before flights mentally that might be
// nice to put on there to double check."
//
// That word — mentally — is the whole case for building it. Nobody writes
// IMSAFE down, which means nobody notices the day they skipped it, and the
// day you skip it is correlated with the day you should not have.
//
// ON THE MNEMONIC, AND A DECISION THAT NEEDS BAM'S CONFIRMATION
//
// There are two IMSAFE expansions in circulation and the review used the
// second one:
//
//   FAA (Pilot's Handbook of Aeronautical Knowledge, and AC 60-22's
//   discussion of pilot self-assessment):
//     Illness · Medication · Stress · Alcohol · Fatigue · Emotion
//
//   As written in cfi-notes.md by Alexis:
//     Illness · Medication · Sleep · Alcohol · Food · External pressure
//
// We use the FAA expansion as the canonical six, because it is what a pilot
// was taught and what a CFI will recognise, and because "Emotion" and
// "Stress" cover ground that "Food" does not.
//
// Nothing from her version is lost, though — it is folded in as prompts
// rather than dropped:
//   - Sleep            -> the primary prompt under Fatigue
//   - Food / hydration -> a secondary prompt under Fatigue
//   - External pressure -> already a scored factor in the risk assessment
//                          (src/lib/risk-assessment.ts), where it belongs,
//                          since it is a circumstance rather than a state of
//                          the pilot
//
// This is a judgement call on a domain question and is flagged for BAM in
// plans/user-tasks. If Alexis prefers her expansion, changing IMSAFE_ITEMS
// is a one-file edit.
//
// SELF-ASSESSMENT, NOT A GATE. Nothing here blocks a flight. A pilot who
// flags fatigue and flies anyway has made a decision that is theirs to make;
// our job is to have asked the question and to have recorded the answer.

export type ImsafeAnswer = "clear" | "flagged" | "unanswered";

export interface ImsafeItem {
  id: string;
  /** The mnemonic letter, for display. */
  letter: string;
  label: string;
  /** The question actually posed to the pilot. */
  prompt: string;
  /** Secondary considerations, shown as supporting text. */
  considerations: string[];
}

export const IMSAFE_ITEMS: ImsafeItem[] = [
  {
    id: "illness",
    letter: "I",
    label: "Illness",
    prompt: "Am I free of any illness that would affect this flight?",
    considerations: [
      "A cold or blocked sinuses can make pressure changes painful or damaging",
      "Symptoms you would work through at a desk are different in an aircraft",
    ],
  },
  {
    id: "medication",
    letter: "M",
    label: "Medication",
    prompt: "Am I free of medication that could impair me?",
    considerations: [
      "Includes over-the-counter medicine — antihistamines and sleep aids are common culprits",
      "Consider the condition being treated, not only the drug",
    ],
  },
  {
    id: "stress",
    letter: "S",
    label: "Stress",
    prompt: "Am I free of stress that would distract me from flying?",
    considerations: [
      "Work, money, family — anything that will still be occupying you in the air",
      "Stress narrows attention exactly when you need it wide",
    ],
  },
  {
    id: "alcohol",
    letter: "A",
    label: "Alcohol",
    prompt: "Am I clear of alcohol and any lingering effects?",
    considerations: [
      "Consider the hangover as well as the drink — impairment outlasts intoxication",
      "Know and apply the rule that governs your operation",
    ],
  },
  {
    id: "fatigue",
    letter: "F",
    label: "Fatigue",
    prompt: "Am I adequately rested and fed for this flight?",
    considerations: [
      "How much sleep did you actually get, not how much you usually get",
      "Have you eaten and had water today? Low blood sugar looks a lot like fatigue",
      "Fatigue is the one people are worst at self-assessing",
    ],
  },
  {
    id: "emotion",
    letter: "E",
    label: "Emotion",
    prompt: "Am I emotionally settled enough to fly?",
    considerations: [
      "An argument, grief, or anger you are still carrying",
      "Elation counts too — a very good day can make you take chances",
    ],
  },
];

export interface ImsafeState {
  [itemId: string]: ImsafeAnswer;
}

export interface ImsafeSummary {
  /** Items the pilot flagged as a concern. */
  flagged: ImsafeItem[];
  /** Items not yet answered either way. */
  unanswered: ImsafeItem[];
  answeredCount: number;
  totalCount: number;
  /** True once every item has an answer. */
  complete: boolean;
  /** True if the assessment has not been started at all. */
  untouched: boolean;
}

export function summarizeImsafe(state: ImsafeState): ImsafeSummary {
  const flagged: ImsafeItem[] = [];
  const unanswered: ImsafeItem[] = [];

  for (const item of IMSAFE_ITEMS) {
    const answer = state[item.id] ?? "unanswered";
    if (answer === "flagged") flagged.push(item);
    else if (answer === "unanswered") unanswered.push(item);
  }

  const answeredCount = IMSAFE_ITEMS.length - unanswered.length;

  return {
    flagged,
    unanswered,
    answeredCount,
    totalCount: IMSAFE_ITEMS.length,
    complete: unanswered.length === 0,
    untouched: answeredCount === 0,
  };
}

/**
 * Flatten IMSAFE into the mission's `completed` map.
 *
 * Stored under the existing jsonb column rather than in a table of its own —
 * the assessment belongs to one mission, is never queried across missions, and
 * adding a table for it would mean a migration to serve six booleans.
 * Prefixed so the keys cannot collide with a checklist item id.
 */
export function imsafeToCompleted(state: ImsafeState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of IMSAFE_ITEMS) {
    const answer = state[item.id];
    if (answer && answer !== "unanswered") out[`imsafe_${item.id}`] = answer;
  }
  return out;
}

/** Read IMSAFE back out of a saved mission's `completed` map. */
export function imsafeFromCompleted(
  completed: Record<string, boolean | string>,
): ImsafeState {
  const state: ImsafeState = {};
  for (const item of IMSAFE_ITEMS) {
    const raw = completed[`imsafe_${item.id}`];
    if (raw === "clear" || raw === "flagged") state[item.id] = raw;
  }
  return state;
}
