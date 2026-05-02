"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface QueueRow {
  id: string;
  email: string;
  cashappUsername: string;
  status: "pending" | "verified" | "rejected" | null;
  requestedAtIso: string | null;
  activatedAtIso: string | null;
  rejectionReason: string | null;
  tier: string;
}

interface Props {
  rows: QueueRow[];
}

type Mode = "idle" | "rejecting";

export function CashAppQueue({ rows }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function activate(id: string) {
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/cashapp/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activate" }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Activate failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error during activate");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmReject(id: string) {
    if (!rejectReason.trim()) {
      setError("Reason required for rejection.");
      return;
    }
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/cashapp/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: rejectReason.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Reject failed");
        return;
      }
      setRejectingId(null);
      setRejectReason("");
      router.refresh();
    } catch {
      setError("Network error during reject");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p
          role="alert"
          className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
        >
          {error}
        </p>
      )}

      {rows.map((row) => {
        const mode: Mode = rejectingId === row.id ? "rejecting" : "idle";
        const ageLabel = row.requestedAtIso ? formatAge(row.requestedAtIso) : "—";
        const showActions = row.status === "pending";

        return (
          <div
            key={row.id}
            className="bg-white rounded-2xl shadow p-4 border-l-4"
            style={{
              borderLeftColor:
                row.status === "verified"
                  ? "#65a30d" /* lime-600 */
                  : row.status === "rejected"
                    ? "#dc2626" /* red-600 */
                    : "#f59e0b" /* amber-500 */,
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={row.status} tier={row.tier} />
                  <span className="text-xs text-gray-500">{ageLabel}</span>
                </div>
                <p className="mt-1 font-semibold text-gray-900 break-all">
                  {row.email}
                </p>
                <p className="text-sm text-gray-700 font-mono break-all">
                  {row.cashappUsername || <em className="text-gray-400">no username</em>}
                </p>
                {row.status === "rejected" && row.rejectionReason && (
                  <p className="mt-1 text-xs text-red-700">
                    Reason: {row.rejectionReason}
                  </p>
                )}
                {row.status === "verified" && row.activatedAtIso && (
                  <p className="mt-1 text-xs text-gray-500">
                    Activated {new Date(row.activatedAtIso).toLocaleString()}
                  </p>
                )}
              </div>

              {showActions && mode === "idle" && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => activate(row.id)}
                    disabled={busyId !== null}
                    className="px-3 py-1.5 bg-lime-600 text-white rounded-lg hover:bg-lime-700 text-sm font-semibold transition disabled:bg-gray-400"
                  >
                    {busyId === row.id ? "Activating…" : "Verify & Activate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectingId(row.id);
                      setRejectReason("");
                      setError(null);
                    }}
                    disabled={busyId !== null}
                    className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-semibold transition disabled:opacity-50"
                  >
                    Reject ▾
                  </button>
                </div>
              )}
            </div>

            {mode === "rejecting" && (
              <div className="mt-3 border-t border-gray-200 pt-3">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Rejection reason (sent to user)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={2}
                  placeholder="e.g. Could not find your CashApp transaction in the last 24 hours."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                  autoFocus
                />
                <div className="mt-2 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setRejectingId(null);
                      setRejectReason("");
                    }}
                    disabled={busyId !== null}
                    className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmReject(row.id)}
                    disabled={busyId !== null}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold transition disabled:bg-gray-400"
                  >
                    {busyId === row.id ? "Rejecting…" : "Confirm Rejection"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({
  status,
  tier,
}: {
  status: QueueRow["status"];
  tier: string;
}) {
  if (status === "verified") {
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-lime-100 text-lime-800">
        VERIFIED · {tier}
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
        REJECTED
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
      ⏰ PENDING
    </span>
  );
}

function formatAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
