"use client";

import { useState } from "react";

type Tier = "free" | "cloud_monthly" | "cloud_annual" | "lifetime";
const TIERS: Tier[] = ["free", "cloud_monthly", "cloud_annual", "lifetime"];

interface UserRow {
  id: string;
  email: string;
  displayName: string | null;
  accountTier: string;
  tierExpiresAt: Date | string | null;
  isAdmin: boolean;
  createdAt: Date | string;
  cashappPaymentStatus: string | null;
}

export function UsersTable({ users }: { users: UserRow[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
          <tr>
            <th className="px-3 py-2">User</th>
            <th className="px-3 py-2">Tier</th>
            <th className="px-3 py-2">Admin</th>
            <th className="px-3 py-2">Joined</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-4 text-gray-500 italic">
                No users match.
              </td>
            </tr>
          )}
          {users.map((u) => (
            <UserRowEditor key={u.id} user={u} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserRowEditor({ user }: { user: UserRow }) {
  const [tier, setTier] = useState(user.accountTier);
  const [isAdmin, setIsAdmin] = useState(user.isAdmin);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = tier !== user.accountTier || isAdmin !== user.isAdmin;

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountTier: tier, isAdmin }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Save failed (HTTP ${res.status})`);
      setFeedback("Saved");
      setTimeout(() => setFeedback(null), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-t border-gray-100">
      <td className="px-3 py-2">
        <div className="font-semibold">{user.email}</div>
        {user.displayName && <div className="text-xs text-gray-500">{user.displayName}</div>}
        {user.cashappPaymentStatus === "pending" && (
          <span className="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded">
            CashApp pending
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="px-2 py-1 border border-gray-300 rounded text-sm"
        >
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {user.tierExpiresAt && (
          <div className="text-xs text-gray-500 mt-1">
            Expires: {new Date(user.tierExpiresAt).toLocaleDateString()}
          </div>
        )}
      </td>
      <td className="px-3 py-2">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isAdmin}
            onChange={(e) => setIsAdmin(e.target.checked)}
          />
          Admin
        </label>
      </td>
      <td className="px-3 py-2 text-xs text-gray-600">
        {new Date(user.createdAt).toLocaleDateString()}
      </td>
      <td className="px-3 py-2">
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="px-3 py-1 bg-sky-600 text-white rounded text-xs font-semibold disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {feedback && <span className="ml-2 text-xs text-green-700">{feedback}</span>}
        {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
      </td>
    </tr>
  );
}
