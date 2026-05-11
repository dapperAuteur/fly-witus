"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";

type Tab = "missions" | "members" | "invite";

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  inviteCode: string;
  createdAt: string;
}

interface MembershipRow {
  id: string;
  role: "owner" | "admin" | "member";
  userId: string;
}

interface MemberRow {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  invitedBy: string | null;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface SharedMissionRow {
  shareId: string;
  sharedAt: string;
  sharedById: string;
  sharedByName: string | null;
  note: string | null;
  mission: {
    id: string;
    missionNumber: string;
    timestamp: string;
    location: string | null;
    aircraftType: string | null;
    missionType: string;
    weatherTemperature: string | null;
    weatherWind: string | null;
    bvcEpisode: string | null;
    flights: Array<{ id: string; flightNumber: number; elapsedTime: string | null }>;
    photos: Array<{ id: string; url: string; caption: string | null }>;
  };
}

interface DashboardPayload {
  group: GroupRow;
  membership: MembershipRow;
  members: MemberRow[];
  sharedMissions: SharedMissionRow[];
}

export default function GroupDashboardPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("missions");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${params.id}`);
      if (res.status === 404) {
        setError("Group not found, or you're not a member.");
        return;
      }
      if (!res.ok) throw new Error(`Failed to load group (HTTP ${res.status})`);
      const json = (await res.json()) as DashboardPayload;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (!session) return;
    void load();
  }, [load, session]);

  if (isPending || loading) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <p className="text-gray-600 mb-4">Sign in to view this group.</p>
        <Link
          href="/login"
          className="inline-block px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-semibold"
        >
          Sign In
        </Link>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <p className="text-sm text-red-600 mb-4">{error ?? "Could not load group."}</p>
        <Link href="/groups" className="text-sm text-sky-700 hover:underline">
          ← Back to groups
        </Link>
      </main>
    );
  }

  const isOwner = data.membership.role === "owner";

  const handleDelete = async () => {
    if (!confirm(`Delete group "${data.group.name}"? Cannot be undone.`)) return;
    const res = await fetch(`/api/groups/${data.group.id}`, { method: "DELETE" });
    if (res.ok) router.push("/groups");
    else alert(`Delete failed (HTTP ${res.status})`);
  };

  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-2">
        <Link href="/groups" className="text-sm text-sky-700 hover:underline">
          ← All groups
        </Link>
        {isOwner && (
          <button
            onClick={handleDelete}
            className="text-sm text-red-700 hover:underline"
          >
            Delete group
          </button>
        )}
      </div>
      <h1 className="text-2xl font-bold">{data.group.name}</h1>
      {data.group.description && (
        <p className="text-gray-600 mt-1">{data.group.description}</p>
      )}
      <p className="text-sm text-gray-500 mt-2">
        {data.members.length} member{data.members.length === 1 ? "" : "s"} ·{" "}
        {data.sharedMissions.length} shared mission
        {data.sharedMissions.length === 1 ? "" : "s"}
      </p>

      <div className="mt-6 border-b border-gray-200 flex gap-1">
        <TabButton active={tab === "missions"} onClick={() => setTab("missions")}>
          Shared Missions
        </TabButton>
        <TabButton active={tab === "members"} onClick={() => setTab("members")}>
          Members
        </TabButton>
        <TabButton active={tab === "invite"} onClick={() => setTab("invite")}>
          Invite
        </TabButton>
      </div>

      <div className="mt-6">
        {tab === "missions" && <MissionsTab shares={data.sharedMissions} />}
        {tab === "members" && <MembersTab members={data.members} />}
        {tab === "invite" && (
          <InviteTab
            group={data.group}
            isOwner={isOwner}
            onCodeRotated={(code) => setData({ ...data, group: { ...data.group, inviteCode: code } })}
          />
        )}
      </div>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
        active
          ? "border-sky-600 text-sky-700"
          : "border-transparent text-gray-600 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}

function MissionsTab({ shares }: { shares: SharedMissionRow[] }) {
  if (shares.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">
        No missions shared to this group yet. Share one from your dashboard.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {shares.map((s) => (
        <li key={s.shareId} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">
            {s.sharedByName ?? "Member"} shared on{" "}
            {new Date(s.sharedAt).toLocaleDateString()}
          </div>
          <div className="font-semibold">
            Mission {s.mission.missionNumber}{" "}
            <span className="text-gray-500 font-normal text-sm">
              · {new Date(s.mission.timestamp).toLocaleDateString()}
            </span>
          </div>
          <div className="text-sm text-gray-700 mt-1">
            {[
              s.mission.location,
              s.mission.aircraftType,
              s.mission.missionType.replace(/_/g, " "),
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          {s.note && (
            <p className="text-sm text-gray-600 mt-2 italic">&ldquo;{s.note}&rdquo;</p>
          )}
          {s.mission.flights.length > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              {s.mission.flights.length} flight
              {s.mission.flights.length === 1 ? "" : "s"} ·{" "}
              {s.mission.photos.length} photo
              {s.mission.photos.length === 1 ? "" : "s"}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function MembersTab({ members }: { members: MemberRow[] }) {
  return (
    <ul className="space-y-2">
      {members.map((m) => (
        <li
          key={m.id}
          className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between"
        >
          <div>
            <div className="font-semibold">{m.displayName ?? m.email}</div>
            <div className="text-xs text-gray-500">
              Joined {new Date(m.joinedAt).toLocaleDateString()}
            </div>
          </div>
          <span className="text-xs uppercase tracking-wide text-gray-600">
            {m.role}
          </span>
        </li>
      ))}
    </ul>
  );
}

function InviteTab({
  group,
  isOwner,
  onCodeRotated,
}: {
  group: GroupRow;
  isOwner: boolean;
  onCodeRotated: (code: string) => void;
}) {
  const [rotating, setRotating] = useState(false);
  const [copied, setCopied] = useState(false);
  const inviteUrl =
    typeof window === "undefined"
      ? `https://fly.witus.online/join/${group.inviteCode}`
      : `${window.location.origin}/join/${group.inviteCode}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleRegenerate = async () => {
    if (!confirm("Regenerate the invite code? The old link will stop working.")) return;
    setRotating(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/invite/regenerate`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      onCodeRotated(json.inviteCode);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setRotating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">
          Invite Code
        </div>
        <div className="font-mono text-2xl tracking-wider mb-3">{group.inviteCode}</div>
        <div className="text-xs text-gray-500 mb-1">Share this link:</div>
        <div className="flex gap-2 items-center">
          <input
            readOnly
            value={inviteUrl}
            className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm font-mono"
          />
          <button
            onClick={handleCopy}
            className="px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
      {isOwner && (
        <button
          onClick={handleRegenerate}
          disabled={rotating}
          className="text-sm text-amber-700 hover:underline disabled:opacity-50"
        >
          {rotating ? "Regenerating…" : "Regenerate code"}
        </button>
      )}
    </div>
  );
}
