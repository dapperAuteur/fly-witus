"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CounterShape {
  standardSlotsTotal: number;
  standardSlotsUsed: number;
}

export function LifetimeForm({ counter }: { counter: CounterShape }) {
  const router = useRouter();
  const [total, setTotal] = useState(counter.standardSlotsTotal);
  const [used, setUsed] = useState(counter.standardSlotsUsed);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    total !== counter.standardSlotsTotal || used !== counter.standardSlotsUsed;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/lifetime", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ standardSlotsTotal: total, standardSlotsUsed: used }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Save failed (HTTP ${res.status})`);
      setFeedback("Saved");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <h2 className="font-semibold">Adjust counter</h2>
      <p className="text-xs text-gray-500">
        Editing here only updates the standard-100 counter. Use this to re-open
        a closed offer (raise total) or correct a drift after a refund.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="block text-xs font-medium text-gray-700 mb-1">Total slots</span>
          <input
            type="number"
            min={0}
            max={10000}
            value={total}
            onChange={(e) => setTotal(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </label>
        <label>
          <span className="block text-xs font-medium text-gray-700 mb-1">Slots used</span>
          <input
            type="number"
            min={0}
            value={used}
            onChange={(e) => setUsed(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!dirty || saving}
          className="px-4 py-2 bg-sky-600 text-white rounded text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {feedback && <span className="text-sm text-green-700">{feedback}</span>}
      </div>
    </form>
  );
}
