"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";

interface GroupListItem {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  role: string;
  memberCount: number;
  sharedMissionCount: number;
  createdAt: string;
}

export default function GroupsListPage() {
  const { data: session, isPending } = useSession();
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNeedsUpgrade(false);
    try {
      const res = await fetch("/api/groups");
      if (res.status === 403) {
        const json = await res.json().catch(() => ({}));
        if (json.code === "TIER_REQUIRED") {
          setNeedsUpgrade(true);
          return;
        }
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          json.error
            ? `${json.error} (HTTP ${res.status})`
            : `Failed to load groups (HTTP ${res.status})`,
        );
      }
      const json = await res.json();
      setGroups(json.groups ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    void load();
  }, [load, session]);

  const handleJoin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: joinCode.trim().toUpperCase() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Join failed (HTTP ${res.status})`);
      window.location.href = `/groups/${json.groupId}`;
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : String(err));
    } finally {
      setJoining(false);
    }
  };

  if (isPending) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Groups</h1>
        <p className="text-muted-foreground mb-4">
          Sign in to view your groups and join via invite code.
        </p>
        <Link
          href="/login"
          className="inline-block px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-semibold"
        >
          Sign In
        </Link>
      </main>
    );
  }

  if (needsUpgrade) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Groups</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="font-semibold text-amber-900 mb-2">Paid plan required</p>
          <p className="text-sm text-amber-800 mb-3">
            Groups are available on Cloud Monthly, Cloud Annual, or Lifetime plans.
          </p>
          <Link
            href="/pricing"
            className="inline-block px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-semibold"
          >
            See pricing
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Groups</h1>
        <Link
          href="/groups/new"
          className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-semibold"
        >
          + New group
        </Link>
      </div>

      <section>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        {loading && <div className="h-24 bg-gray-50 rounded animate-pulse" />}
        {!loading && groups.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            You&apos;re not in any groups yet. Create one or join via invite code below.
          </p>
        )}
        <ul className="space-y-2">
          {groups.map((g) => (
            <li key={g.id}>
              <Link
                href={`/groups/${g.id}`}
                className="block bg-card text-card-foreground border border-border rounded-lg p-4 hover:border-sky-300 hover:shadow-sm transition"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-semibold text-lg">{g.name}</h2>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {g.role}
                  </span>
                </div>
                {g.description && (
                  <p className="text-sm text-muted-foreground mt-1">{g.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {g.memberCount} member{g.memberCount === 1 ? "" : "s"} ·{" "}
                  {g.sharedMissionCount} shared mission
                  {g.sharedMissionCount === 1 ? "" : "s"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-muted border border-border rounded-lg p-4">
        <h2 className="font-semibold mb-2">Join with invite code</h2>
        <form onSubmit={handleJoin} className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="A7K2X9P3"
            maxLength={20}
            className="flex-1 px-3 py-2 border border-border rounded font-mono uppercase tracking-wider"
          />
          <button
            type="submit"
            disabled={joining || joinCode.trim().length < 4}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {joining ? "Joining…" : "Join"}
          </button>
        </form>
        {joinError && <p className="text-sm text-red-600 mt-2">{joinError}</p>}
      </section>
    </main>
  );
}
