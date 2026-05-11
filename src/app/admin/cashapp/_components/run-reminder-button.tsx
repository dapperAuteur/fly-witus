"use client";

import { useState } from "react";

// Manual trigger for the daily cashapp reminder. Hits the admin-gated
// endpoint that runs the same query the cron does, but doesn't depend
// on CRON_SECRET. Useful for smoke-tests + pre-launch demos.
export function RunReminderButton() {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!confirm("Send the pending-CashApp reminder email + Inbox push now?")) return;
    setBusy(true);
    setFeedback(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/cashapp/run-reminder", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Failed (HTTP ${res.status})`);
      setFeedback(
        json.notified
          ? `Sent. ${json.pending} pending request${json.pending === 1 ? "" : "s"}.`
          : "Queue empty — nothing sent.",
      );
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-start gap-2">
      <button
        onClick={run}
        disabled={busy}
        className="px-3 py-1.5 border border-amber-300 text-amber-800 bg-amber-50 rounded text-sm font-semibold hover:bg-amber-100 disabled:opacity-50"
      >
        {busy ? "Sending…" : "Run reminder now"}
      </button>
      {feedback && <span className="text-sm text-green-700 mt-1">{feedback}</span>}
      {error && <span className="text-sm text-red-600 mt-1">{error}</span>}
    </div>
  );
}
