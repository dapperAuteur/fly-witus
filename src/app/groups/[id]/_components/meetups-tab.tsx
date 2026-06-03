"use client";

import { useCallback, useEffect, useState } from "react";

// Doodle-style group meetup scheduling. Members propose candidate times,
// everyone marks availability (yes/no/maybe), and a manager (creator or
// group owner/admin) finalizes one — which enables the .ics download and
// arms the email reminder. A group can have many meetups at once.

type MeetupStatus = "proposing" | "scheduled" | "completed" | "cancelled";

interface MeetupListItem {
  id: string;
  title: string;
  status: MeetupStatus;
  locationName: string | null;
  finalizedStart: string | null;
  createdById: string | null;
  createdByName: string;
  optionCount: number;
}

interface TimeOption {
  id: string;
  startsAt: string;
  endsAt: string | null;
  proposedByName: string;
}

interface ResponseRow {
  id: string;
  optionId: string;
  userId: string;
  response: "yes" | "no" | "maybe";
  userName: string | null;
}

interface MeetupDetailData {
  id: string;
  groupId: string;
  title: string;
  description: string | null;
  locationName: string | null;
  status: MeetupStatus;
  createdById: string | null;
  createdByName: string;
  finalizedStart: string | null;
  finalizedEnd: string | null;
  options: TimeOption[];
  responses: ResponseRow[];
}

const STATUS_STYLE: Record<MeetupStatus, string> = {
  proposing: "bg-sky-100 text-sky-800",
  scheduled: "bg-green-100 text-green-800",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

function fmt(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// datetime-local value (no tz) → ISO string.
function localToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function MeetupsTab({
  groupId,
  currentUserId,
  role,
}: {
  groupId: string;
  currentUserId: string;
  role: string;
}) {
  const [meetups, setMeetups] = useState<MeetupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/meetups`);
      if (!res.ok) throw new Error(`Failed (HTTP ${res.status})`);
      const json = await res.json();
      setMeetups(json.meetups ?? []);
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
          {meetups.length} meetup{meetups.length === 1 ? "" : "s"}
        </h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 bg-sky-600 text-white rounded text-sm font-semibold hover:bg-sky-700"
          >
            + New meetup
          </button>
        )}
      </div>

      {showForm && (
        <NewMeetupForm
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
      {!loading && meetups.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground italic">
          No meetups yet. Propose one — pick a few candidate times and let the
          group mark when they&apos;re free.
        </p>
      )}

      <ul className="space-y-3 mt-3">
        {meetups.map((m) => (
          <MeetupRow
            key={m.id}
            meetup={m}
            groupId={groupId}
            currentUserId={currentUserId}
            role={role}
            onChanged={load}
          />
        ))}
      </ul>
    </div>
  );
}

function NewMeetupForm({
  groupId,
  onCancel,
  onCreated,
}: {
  groupId: string;
  onCancel: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [times, setTimes] = useState<string[]>([""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const timeOptions = times
      .map((t) => localToIso(t))
      .filter((iso): iso is string => !!iso)
      .map((iso) => ({ startsAt: iso }));
    try {
      const res = await fetch(`/api/groups/${groupId}/meetups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: (form.get("title") as string).trim(),
          description: (form.get("description") as string).trim() || undefined,
          locationName: (form.get("location") as string).trim() || undefined,
          timeOptions: timeOptions.length ? timeOptions : undefined,
        }),
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
        maxLength={120}
        placeholder="Title (e.g. Saturday morning mapping run)"
        className="w-full px-3 py-2 border border-border rounded"
      />
      <textarea
        name="description"
        maxLength={2000}
        rows={2}
        placeholder="Details (optional)"
        className="w-full px-3 py-2 border border-border rounded"
      />
      <input
        name="location"
        maxLength={200}
        placeholder="Location (optional)"
        className="w-full px-3 py-2 border border-border rounded"
      />
      <div className="space-y-2">
        <span className="block text-xs font-medium text-card-foreground">
          Candidate times (members can add more later)
        </span>
        {times.map((t, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="datetime-local"
              value={t}
              onChange={(e) =>
                setTimes((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
              }
              className="flex-1 px-3 py-2 border border-border rounded text-sm"
            />
            {times.length > 1 && (
              <button
                type="button"
                onClick={() => setTimes((prev) => prev.filter((_, j) => j !== i))}
                className="px-3 py-2 border border-border rounded text-sm hover:bg-muted"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setTimes((prev) => [...prev, ""])}
          className="text-sm text-sky-700 hover:underline"
        >
          + Add another time
        </button>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-sky-600 text-white rounded text-sm font-semibold disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create meetup"}
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

function MeetupRow({
  meetup,
  groupId,
  currentUserId,
  role,
  onChanged,
}: {
  meetup: MeetupListItem;
  groupId: string;
  currentUserId: string;
  role: string;
  onChanged: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="bg-card text-card-foreground border border-border rounded-lg p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs font-semibold rounded-full px-2 py-0.5 ${STATUS_STYLE[meetup.status]}`}
            >
              {meetup.status}
            </span>
            <h3 className="font-semibold">{meetup.title}</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {meetup.status === "scheduled" && meetup.finalizedStart
              ? `Confirmed: ${fmt(meetup.finalizedStart)}`
              : `${meetup.optionCount} time${meetup.optionCount === 1 ? "" : "s"} proposed`}
            {meetup.locationName ? ` · 📍 ${meetup.locationName}` : ""}
            {` · by ${meetup.createdByName}`}
          </p>
        </div>
        <span className="text-muted-foreground text-sm shrink-0">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <MeetupDetail
          meetupId={meetup.id}
          groupId={groupId}
          currentUserId={currentUserId}
          role={role}
          onChanged={onChanged}
        />
      )}
    </li>
  );
}

function MeetupDetail({
  meetupId,
  groupId,
  currentUserId,
  role,
  onChanged,
}: {
  meetupId: string;
  groupId: string;
  currentUserId: string;
  role: string;
  onChanged: () => void | Promise<void>;
}) {
  const [data, setData] = useState<MeetupDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTime, setNewTime] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/meetups/${meetupId}`);
      if (!res.ok) throw new Error(`Failed (HTTP ${res.status})`);
      const json = await res.json();
      setData(json.meetup);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [groupId, meetupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    await load();
    await onChanged();
  };

  const respond = async (optionId: string, response: "yes" | "no" | "maybe") => {
    setBusy(true);
    try {
      await fetch(`/api/groups/${groupId}/meetups/${meetupId}/responses`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId, response }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const addTime = async () => {
    const iso = localToIso(newTime);
    if (!iso) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/meetups/${meetupId}/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt: iso }),
      });
      if (res.ok) {
        setNewTime("");
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  const manage = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/meetups/${meetupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? `Failed (HTTP ${res.status})`);
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this meetup?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/meetups/${meetupId}`, {
        method: "DELETE",
      });
      if (res.ok) await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground mt-3 pt-3 border-t border-border">Loading…</p>;
  }
  if (error || !data) {
    return <p className="text-sm text-red-600 mt-3 pt-3 border-t border-border">{error ?? "Failed to load."}</p>;
  }

  const canManage =
    role === "owner" || role === "admin" || data.createdById === currentUserId;
  const isOpen = data.status === "proposing" || data.status === "scheduled";

  const tally = (optionId: string, value: "yes" | "no" | "maybe") =>
    data.responses.filter((r) => r.optionId === optionId && r.response === value).length;
  const myResponse = (optionId: string) =>
    data.responses.find((r) => r.optionId === optionId && r.userId === currentUserId)?.response;

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-3">
      {data.description && (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{data.description}</p>
      )}

      {data.status === "scheduled" && data.finalizedStart && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-semibold">Confirmed: {fmt(data.finalizedStart)}</span>
          <a
            href={`/api/groups/${groupId}/meetups/${meetupId}/ics`}
            className="text-sky-700 underline"
          >
            Add to calendar
          </a>
        </div>
      )}

      {/* Time options + availability grid */}
      <ul className="space-y-2">
        {data.options.length === 0 && (
          <li className="text-sm text-muted-foreground italic">No times proposed yet.</li>
        )}
        {data.options.map((o) => {
          const mine = myResponse(o.id);
          return (
            <li key={o.id} className="border border-border rounded-md p-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-medium">{fmt(o.startsAt)}</span>
                <span className="text-xs text-muted-foreground">
                  ✅ {tally(o.id, "yes")} · 🤔 {tally(o.id, "maybe")} · ❌ {tally(o.id, "no")}
                </span>
              </div>
              {isOpen && (
                <div className="flex gap-1 mt-2">
                  {(["yes", "maybe", "no"] as const).map((v) => (
                    <button
                      key={v}
                      disabled={busy}
                      onClick={() => respond(o.id, v)}
                      className={`px-2 py-1 rounded text-xs font-semibold border transition ${
                        mine === v
                          ? "bg-sky-600 text-white border-sky-600"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      {v === "yes" ? "I'm free" : v === "maybe" ? "Maybe" : "Can't"}
                    </button>
                  ))}
                  {canManage && data.status === "proposing" && (
                    <button
                      disabled={busy}
                      onClick={() => manage({ action: "finalize", finalOptionId: o.id })}
                      className="ml-auto px-2 py-1 rounded text-xs font-semibold bg-green-600 text-white hover:bg-green-700"
                    >
                      Pick this time
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Propose a new time */}
      {isOpen && (
        <div className="flex gap-2">
          <input
            type="datetime-local"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="flex-1 px-3 py-2 border border-border rounded text-sm"
          />
          <button
            disabled={busy || !newTime}
            onClick={addTime}
            className="px-3 py-2 border border-border rounded text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            Propose time
          </button>
        </div>
      )}

      {/* Manager controls */}
      {canManage && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          {data.status === "scheduled" && (
            <button
              disabled={busy}
              onClick={() => manage({ action: "reopen" })}
              className="px-2 py-1 text-xs border border-border rounded hover:bg-muted"
            >
              Reopen for new times
            </button>
          )}
          {data.status !== "completed" && data.status !== "cancelled" && (
            <>
              <button
                disabled={busy}
                onClick={() => manage({ action: "complete" })}
                className="px-2 py-1 text-xs border border-border rounded hover:bg-muted"
              >
                Mark completed
              </button>
              <button
                disabled={busy}
                onClick={() => manage({ action: "cancel" })}
                className="px-2 py-1 text-xs border border-amber-300 text-amber-700 rounded hover:bg-amber-50 dark:hover:bg-amber-950/30"
              >
                Cancel meetup
              </button>
            </>
          )}
          <button
            disabled={busy}
            onClick={remove}
            className="px-2 py-1 text-xs border border-red-300 text-red-700 rounded hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
