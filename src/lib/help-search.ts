// Tiny dependency-free fuzzy search over the help docs. Good enough for a
// handful of docs: per-query-token scoring across weighted fields (title,
// keywords, summary, category, body) with substring + subsequence
// (typo-tolerant) matching. No fuse.js / external lib needed.

import { HELP_DOCS, helpDocText, type HelpDoc } from "@/content/help/docs";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// True if every char of `needle` appears in `hay` in order (allowing
// gaps) — catches typos/abbreviations like "exprt" → "export".
function isSubsequence(needle: string, hay: string): boolean {
  if (!needle) return true;
  let i = 0;
  for (let j = 0; j < hay.length && i < needle.length; j++) {
    if (hay[j] === needle[i]) i++;
  }
  return i === needle.length;
}

interface Field {
  text: string;
  weight: number;
}

function docFields(doc: HelpDoc): Field[] {
  const body = helpDocText(doc);
  return [
    { text: normalize(doc.title), weight: 6 },
    { text: normalize(doc.keywords.join(" ")), weight: 5 },
    { text: normalize(doc.summary), weight: 3 },
    { text: normalize(doc.category), weight: 2 },
    { text: normalize(body), weight: 1 },
  ];
}

function tokenFieldScore(token: string, field: Field): number {
  const { text, weight } = field;
  if (!text) return 0;
  if (text.includes(token)) {
    // Word-boundary hits rank above mid-word ones.
    const boundary = new RegExp(`(^|\\s)${escapeRegExp(token)}`).test(text);
    return weight * (boundary ? 3 : 2);
  }
  // Fuzzy fallback: only for tokens long enough to be meaningful.
  if (token.length >= 3 && isSubsequence(token, text)) {
    return weight * 1;
  }
  return 0;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface HelpSearchResult {
  doc: HelpDoc;
  score: number;
}

export function searchHelpDocs(query: string): HelpSearchResult[] {
  const q = normalize(query);
  if (!q) return HELP_DOCS.map((doc) => ({ doc, score: 0 }));

  const tokens = q.split(" ").filter(Boolean);

  const scored = HELP_DOCS.map((doc) => {
    const fields = docFields(doc);
    let score = 0;
    let matchedTokens = 0;
    for (const token of tokens) {
      const best = Math.max(...fields.map((f) => tokenFieldScore(token, f)));
      if (best > 0) matchedTokens++;
      score += best;
    }
    // Require at least one token to match; reward docs that match more of
    // the query.
    if (matchedTokens === 0) return null;
    score += matchedTokens * 2;
    return { doc, score };
  }).filter((r): r is HelpSearchResult => r !== null);

  return scored.sort((a, b) => b.score - a.score);
}
