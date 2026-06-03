"use client";

import { useState } from "react";

const STATUSES = ["new", "triaged", "resolved"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_STYLE: Record<Status, string> = {
  new: "bg-sky-100 text-sky-800",
  triaged: "bg-amber-100 text-amber-800",
  resolved: "bg-green-100 text-green-800",
};

// Inline status switcher for the admin feedback queue. Optimistically
// reflects the new status and reverts on error.
export function StatusControl({
  id,
  initialStatus,
}: {
  id: string;
  initialStatus: string;
}) {
  const [status, setStatus] = useState<Status>(
    (STATUSES as readonly string[]).includes(initialStatus)
      ? (initialStatus as Status)
      : "new",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const update = async (next: Status) => {
    if (next === status) return;
    const prev = status;
    setStatus(next);
    setSaving(true);
    setError(false);
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setStatus(prev);
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        disabled={saving}
        onChange={(e) => update(e.target.value as Status)}
        className={`text-xs font-semibold rounded px-2 py-1 border border-border ${STATUS_STYLE[status]}`}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-600">save failed</span>}
    </div>
  );
}
