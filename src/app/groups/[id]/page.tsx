"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";

type Tab = "missions" | "requests" | "members" | "invite";

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
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <p className="text-muted-foreground mb-4">Sign in to view this group.</p>
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
        <p className="text-muted-foreground mt-1">{data.group.description}</p>
      )}
      <p className="text-sm text-muted-foreground mt-2">
        {data.members.length} member{data.members.length === 1 ? "" : "s"} ·{" "}
        {data.sharedMissions.length} shared mission
        {data.sharedMissions.length === 1 ? "" : "s"}
      </p>

      <div className="mt-6 border-b border-border flex gap-1 flex-wrap">
        <TabButton active={tab === "missions"} onClick={() => setTab("missions")}>
          Shared Missions
        </TabButton>
        <TabButton active={tab === "requests"} onClick={() => setTab("requests")}>
          Flight Requests
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
        {tab === "requests" && (
          <RequestsTab groupId={data.group.id} currentUserId={data.membership.userId} />
        )}
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

interface FlightRequestRow {
  id: string;
  title: string;
  description: string;
  missionType: string;
  location: string | null;
  targetDate: string | null;
  priority: "low" | "medium" | "high";
  status: "open" | "claimed" | "in_progress" | "completed" | "cancelled";
  requestedById: string;
  requesterName: string | null;
  claimedById: string | null;
  claimantName: string | null;
  completedMissionId: string | null;
  bvcEpisode: string | null;
  wanderlearnCourseSlug: string | null;
  partnerInstitution: string | null;
  academicPurpose: string | null;
  createdAt: string;
}

interface MyMissionOption {
  id: string;
  missionNumber: string;
  timestamp: string;
}

function RequestsTab({
  groupId,
  currentUserId,
}: {
  groupId: string;
  currentUserId: string;
}) {
  const [requests, setRequests] = useState<FlightRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/requests`);
      if (!res.ok) throw new Error(`Failed (HTTP ${res.status})`);
      const json = await res.json();
      setRequests(json.requests ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm uppercase tracking-wide text-muted-foreground">
          {requests.length} request{requests.length === 1 ? "" : "s"}
        </h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 bg-sky-600 text-white rounded text-sm font-semibold hover:bg-sky-700"
          >
            + New request
          </button>
        )}
      </div>

      {showForm && (
        <NewRequestForm
          groupId={groupId}
          onCancel={() => setShowForm(false)}
          onCreated={async () => {
            setShowForm(false);
            await load();
          }}
        />
      )}

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {loading && <div className="h-24 bg-muted rounded animate-pulse" />}
      {!loading && requests.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground italic">
          No flight requests yet. Create one to ask a group member to fly a mission.
        </p>
      )}

      <ul className="space-y-3 mt-3">
        {requests.map((r) => (
          <RequestCard
            key={r.id}
            request={r}
            currentUserId={currentUserId}
            groupId={groupId}
            onChanged={load}
          />
        ))}
      </ul>
    </div>
  );
}

function NewRequestForm({
  groupId,
  onCancel,
  onCreated,
}: {
  groupId: string;
  onCancel: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [missionType, setMissionType] = useState("recreational");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const targetDateRaw = (form.get("targetDate") as string).trim();
    const payload: Record<string, unknown> = {
      title: (form.get("title") as string).trim(),
      description: (form.get("description") as string).trim(),
      missionType,
      location: (form.get("location") as string).trim() || undefined,
      targetDate: targetDateRaw ? new Date(targetDateRaw).toISOString() : undefined,
      priority: form.get("priority") as string,
    };
    if (missionType === "bvc_primary_source") {
      payload.bvcEpisode = (form.get("bvcEpisode") as string).trim() || undefined;
      payload.wanderlearnCourseSlug =
        (form.get("wanderlearnCourseSlug") as string).trim() || undefined;
      payload.partnerInstitution =
        (form.get("partnerInstitution") as string).trim() || undefined;
      payload.academicPurpose =
        (form.get("academicPurpose") as string).trim() || undefined;
    }
    try {
      const res = await fetch(`/api/groups/${groupId}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Failed (HTTP ${res.status})`);
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 rounded-lg p-4 mb-4"
    >
      {error && <p className="text-sm text-red-600">{error}</p>}
      <input
        name="title"
        required
        maxLength={160}
        placeholder="Title (e.g. BVC Episode 5 — Forest Footage)"
        className="w-full px-3 py-2 border border-border rounded"
      />
      <textarea
        name="description"
        required
        maxLength={2000}
        rows={3}
        placeholder="Describe what you need…"
        className="w-full px-3 py-2 border border-border rounded"
      />
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="block text-xs font-medium text-muted-foreground mb-1">Mission type</span>
          <select
            value={missionType}
            onChange={(e) => setMissionType(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded"
          >
            <option value="recreational">Recreational</option>
            <option value="bvc_primary_source">BVC Primary Source</option>
            <option value="commercial">Commercial</option>
            <option value="test_maintenance">Test / Maintenance</option>
          </select>
        </label>
        <label>
          <span className="block text-xs font-medium text-muted-foreground mb-1">Priority</span>
          <select
            name="priority"
            defaultValue="medium"
            className="w-full px-3 py-2 border border-border rounded"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>
      <input
        name="location"
        maxLength={200}
        placeholder="Location (optional)"
        className="w-full px-3 py-2 border border-border rounded"
      />
      <label>
        <span className="block text-xs font-medium text-muted-foreground mb-1">Target date (optional)</span>
        <input
          name="targetDate"
          type="date"
          className="w-full px-3 py-2 border border-border rounded"
        />
      </label>
      {missionType === "bvc_primary_source" && (
        <div className="space-y-2 border-t border-sky-200 dark:border-sky-900 pt-3">
          <input
            name="bvcEpisode"
            maxLength={120}
            placeholder="BVC episode (e.g. Episode 5 — Guayusa)"
            className="w-full px-3 py-2 border border-border rounded"
          />
          <input
            name="wanderlearnCourseSlug"
            maxLength={120}
            placeholder="Wanderlearn course slug"
            className="w-full px-3 py-2 border border-border rounded"
          />
          <input
            name="partnerInstitution"
            maxLength={160}
            placeholder="Partner institution"
            className="w-full px-3 py-2 border border-border rounded"
          />
          <textarea
            name="academicPurpose"
            maxLength={500}
            rows={2}
            placeholder="Academic purpose"
            className="w-full px-3 py-2 border border-border rounded"
          />
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-sky-600 text-white rounded text-sm font-semibold disabled:opacity-50"
        >
          {submitting ? "Posting…" : "Post request"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-border rounded text-sm font-semibold hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function RequestCard({
  request,
  currentUserId,
  groupId,
  onChanged,
}: {
  request: FlightRequestRow;
  currentUserId: string;
  groupId: string;
  onChanged: () => void | Promise<void>;
}) {
  const [showComplete, setShowComplete] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const isRequester = request.requestedById === currentUserId;
  const isClaimant = request.claimedById === currentUserId;

  const post = async (path: string) => {
    const res = await fetch(path, { method: "POST" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? `Action failed (HTTP ${res.status})`);
      return false;
    }
    await onChanged();
    return true;
  };

  const cancel = async () => {
    if (!confirm("Cancel this request?")) return;
    const res = await fetch(`/api/groups/${groupId}/requests/${request.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? `Cancel failed (HTTP ${res.status})`);
      return;
    }
    await onChanged();
  };

  const start = async () => {
    const res = await fetch(`/api/groups/${groupId}/requests/${request.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? `Start failed (HTTP ${res.status})`);
      return;
    }
    await onChanged();
  };

  return (
    <li className="bg-card text-card-foreground border border-border rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
            <StatusBadge status={request.status} />{" "}
            <PriorityBadge priority={request.priority} />
          </div>
          <h3 className="font-semibold text-lg">{request.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Posted by {request.requesterName ?? "member"} on{" "}
            {new Date(request.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{request.description}</p>
      <ul className="text-xs text-muted-foreground mt-2 space-y-0.5">
        {request.location && <li>📍 {request.location}</li>}
        {request.targetDate && (
          <li>📅 Target: {new Date(request.targetDate).toLocaleDateString()}</li>
        )}
        {request.missionType === "bvc_primary_source" && request.bvcEpisode && (
          <li>✈ BVC: {request.bvcEpisode}</li>
        )}
        {request.claimantName && (
          <li>
            🤝 Claimed by {request.claimantName}
            {isClaimant && " (you)"}
          </li>
        )}
      </ul>

      <div className="flex flex-wrap gap-2 mt-3">
        {request.status === "open" && !isRequester && (
          <button
            onClick={() => post(`/api/groups/${groupId}/requests/${request.id}/claim`)}
            className="px-3 py-1.5 bg-sky-600 text-white rounded text-sm font-semibold hover:bg-sky-700"
          >
            Claim this request
          </button>
        )}
        {request.status === "claimed" && isClaimant && (
          <button
            onClick={start}
            className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm font-semibold hover:bg-amber-700"
          >
            Start mission
          </button>
        )}
        {(request.status === "claimed" || request.status === "in_progress") &&
          isClaimant && (
            <button
              onClick={() => setShowComplete((v) => !v)}
              className="px-3 py-1.5 bg-green-600 text-white rounded text-sm font-semibold hover:bg-green-700"
            >
              {showComplete ? "Cancel" : "Complete request"}
            </button>
          )}
        {(isRequester || request.status === "open") &&
          request.status !== "completed" &&
          request.status !== "cancelled" && (
            <button
              onClick={cancel}
              className="px-3 py-1.5 border border-red-300 text-red-700 rounded text-sm font-semibold hover:bg-red-50"
            >
              Cancel request
            </button>
          )}
        <button
          onClick={() => setShowComments((v) => !v)}
          className="px-3 py-1.5 border border-border rounded text-sm hover:bg-muted"
        >
          {showComments ? "Hide comments" : "Comments"}
        </button>
      </div>

      {showComplete && (
        <CompleteRequestForm
          groupId={groupId}
          requestId={request.id}
          onDone={async () => {
            setShowComplete(false);
            await onChanged();
          }}
        />
      )}

      {showComments && <CommentsThread groupId={groupId} requestId={request.id} />}
    </li>
  );
}

function CompleteRequestForm({
  groupId,
  requestId,
  onDone,
}: {
  groupId: string;
  requestId: string;
  onDone: () => void | Promise<void>;
}) {
  const [missions, setMissions] = useState<MyMissionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/missions");
        if (!res.ok) throw new Error(`Failed (HTTP ${res.status})`);
        const json = await res.json();
        if (!cancelled) {
          setMissions(
            (json.missions ?? []).map((m: MyMissionOption) => ({
              id: m.id,
              missionNumber: m.missionNumber,
              timestamp: m.timestamp,
            })),
          );
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const missionId = form.get("missionId") as string;
    if (!missionId) {
      setError("Pick a mission");
      setSubmitting(false);
      return;
    }
    try {
      const res = await fetch(`/api/groups/${groupId}/requests/${requestId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ missionId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Complete failed (HTTP ${res.status})`);
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-3 pt-3 border-t border-border">
        <p className="text-sm text-muted-foreground">Loading your missions…</p>
      </div>
    );
  }

  if (missions.length === 0) {
    return (
      <div className="mt-3 pt-3 border-t border-border">
        <p className="text-sm text-muted-foreground">
          You don&apos;t have any saved missions to link yet. Save a mission first, then come back.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 pt-3 border-t border-border space-y-2"
    >
      {error && <p className="text-sm text-red-600">{error}</p>}
      <select
        name="missionId"
        defaultValue=""
        className="w-full px-3 py-2 border border-border rounded text-sm"
      >
        <option value="" disabled>
          Pick the mission you flew for this request…
        </option>
        {missions.map((m) => (
          <option key={m.id} value={m.id}>
            Mission {m.missionNumber} · {new Date(m.timestamp).toLocaleDateString()}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">
        Linking auto-shares this mission to the group and emails the requester.
      </p>
      <button
        type="submit"
        disabled={submitting}
        className="px-3 py-1.5 bg-green-600 text-white rounded text-sm font-semibold disabled:opacity-50"
      >
        {submitting ? "Linking…" : "Link mission & complete"}
      </button>
    </form>
  );
}

function CommentsThread({ groupId, requestId }: { groupId: string; requestId: string }) {
  const [comments, setComments] = useState<
    Array<{
      id: string;
      content: string;
      createdAt: string;
      authorEmail: string;
      authorName: string | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/requests/${requestId}/comments`);
      if (!res.ok) throw new Error(`Failed (HTTP ${res.status})`);
      const json = await res.json();
      setComments(json.comments ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [groupId, requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!text.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/requests/${requestId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text.trim() }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Failed (HTTP ${res.status})`);
      }
      setText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-border">
      {loading && <p className="text-sm text-muted-foreground">Loading comments…</p>}
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {!loading && comments.length === 0 && (
        <p className="text-sm text-muted-foreground italic mb-2">No comments yet.</p>
      )}
      <ul className="space-y-2 mb-3">
        {comments.map((c) => (
          <li key={c.id} className="text-sm bg-muted rounded p-2">
            <div className="text-xs text-muted-foreground mb-0.5">
              {c.authorName ?? c.authorEmail} ·{" "}
              {new Date(c.createdAt).toLocaleString()}
            </div>
            <p className="whitespace-pre-wrap">{c.content}</p>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          placeholder="Add a comment…"
          className="flex-1 px-3 py-2 border border-border rounded text-sm"
        />
        <button
          type="submit"
          disabled={posting || !text.trim()}
          className="px-3 py-1.5 bg-gray-800 text-white rounded text-sm font-semibold disabled:opacity-50"
        >
          {posting ? "Posting…" : "Post"}
        </button>
      </form>
    </div>
  );
}

function StatusBadge({ status }: { status: FlightRequestRow["status"] }) {
  const cls: Record<FlightRequestRow["status"], string> = {
    open: "bg-sky-100 text-sky-800",
    claimed: "bg-amber-100 text-amber-800",
    in_progress: "bg-amber-100 text-amber-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls[status]}`}
    >
      {status.replace(/_/g, " ").toUpperCase()}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: FlightRequestRow["priority"] }) {
  if (priority === "medium") return null;
  const cls =
    priority === "high" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800";
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {priority.toUpperCase()}
    </span>
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
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function MissionsTab({ shares }: { shares: SharedMissionRow[] }) {
  if (shares.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No missions shared to this group yet. Share one from your dashboard.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {shares.map((s) => (
        <li key={s.shareId} className="bg-card text-card-foreground border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">
            {s.sharedByName ?? "Member"} shared on{" "}
            {new Date(s.sharedAt).toLocaleDateString()}
          </div>
          <div className="font-semibold">
            Mission {s.mission.missionNumber}{" "}
            <span className="text-muted-foreground font-normal text-sm">
              · {new Date(s.mission.timestamp).toLocaleDateString()}
            </span>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {[
              s.mission.location,
              s.mission.aircraftType,
              s.mission.missionType.replace(/_/g, " "),
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          {s.note && (
            <p className="text-sm text-muted-foreground mt-2 italic">&ldquo;{s.note}&rdquo;</p>
          )}
          {s.mission.flights.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
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
          className="bg-card text-card-foreground border border-border rounded-lg p-3 flex items-center justify-between"
        >
          <div>
            <div className="font-semibold">{m.displayName ?? m.email}</div>
            <div className="text-xs text-muted-foreground">
              Joined {new Date(m.joinedAt).toLocaleDateString()}
            </div>
          </div>
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
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
      <div className="bg-card text-card-foreground border border-border rounded-lg p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
          Invite Code
        </div>
        <div className="font-mono text-2xl tracking-wider mb-3">{group.inviteCode}</div>
        <div className="text-xs text-muted-foreground mb-1">Share this link:</div>
        <div className="flex gap-2 items-center">
          <input
            readOnly
            value={inviteUrl}
            className="flex-1 px-3 py-2 border border-border rounded text-sm font-mono"
          />
          <button
            onClick={handleCopy}
            className="px-3 py-2 border border-border rounded text-sm hover:bg-muted"
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
