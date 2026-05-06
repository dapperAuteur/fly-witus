"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import type { AircraftProfile } from "@/db/schema/aircraft-profiles";

// Dashboard data shapes are intentionally narrower than the full DB rows
// — only the columns the UI binds to. The /api/profile route already
// filters its select; for missions we re-shape inline because the API
// returns nested flights/photos and we only need a summary here.

interface Profile {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  part107CertNumber: string | null;
  homeLocation: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MissionSummary {
  id: string;
  missionNumber: string;
  timestamp: string;
  location: string | null;
  aircraftType: string | null;
  flights: Array<{ id: string }>;
  photos: Array<{ id: string }>;
}

export default function DashboardPage() {
  const { data: session, isPending: sessionLoading } = useSession();

  if (sessionLoading) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
        <p className="text-gray-600 mb-4">You need to be signed in to view your dashboard.</p>
        <Link
          href="/login"
          className="inline-block px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-semibold"
        >
          Sign In
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/" className="text-sm text-sky-700 hover:underline">
          ← Back to checklist
        </Link>
      </div>
      <ProfileSection />
      <AircraftSection />
      <MissionsSection />
    </main>
  );
}

// ─── Profile section ──────────────────────────────────────────────────────

function ProfileSection() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error(`Failed to load profile (HTTP ${res.status})`);
      const json = await res.json();
      setProfile(json.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const form = new FormData(e.currentTarget);
    const payload = {
      displayName: (form.get("displayName") as string).trim() || null,
      avatarUrl: (form.get("avatarUrl") as string).trim() || null,
      part107CertNumber: (form.get("part107CertNumber") as string).trim() || null,
      homeLocation: (form.get("homeLocation") as string).trim() || null,
    };
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Save failed (HTTP ${res.status})`);
      }
      const json = await res.json();
      setProfile(json.profile);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Profile</h2>
      {loading && <div className="h-24 bg-gray-50 rounded animate-pulse" />}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {profile && (
        <form onSubmit={handleSave} className="space-y-3 bg-white border border-gray-200 rounded-lg p-4">
          <Field label="Email (read-only)">
            <input
              type="email"
              value={profile.email}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded text-gray-500 bg-gray-50"
            />
          </Field>
          <Field label="Display name">
            <input
              name="displayName"
              defaultValue={profile.displayName ?? ""}
              maxLength={120}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </Field>
          <Field label="Avatar URL">
            <input
              name="avatarUrl"
              type="url"
              defaultValue={profile.avatarUrl ?? ""}
              maxLength={500}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </Field>
          <Field label="Part 107 cert number">
            <input
              name="part107CertNumber"
              defaultValue={profile.part107CertNumber ?? ""}
              maxLength={40}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </Field>
          <Field label="Home location">
            <input
              name="homeLocation"
              defaultValue={profile.homeLocation ?? ""}
              maxLength={200}
              placeholder="City, State (or ZIP)"
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </Field>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
            {saved && <span className="text-sm text-green-700">Saved.</span>}
          </div>
        </form>
      )}
    </section>
  );
}

// ─── Aircraft section ─────────────────────────────────────────────────────

function AircraftSection() {
  const [profiles, setProfiles] = useState<AircraftProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/aircraft-profiles");
      if (!res.ok) throw new Error(`Failed to load aircraft (HTTP ${res.status})`);
      const json = await res.json();
      setProfiles(json.profiles ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this aircraft? Missions will keep their flight history.")) return;
    try {
      const res = await fetch(`/api/aircraft-profiles/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed (HTTP ${res.status})`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Aircraft</h2>
        {editingId !== "new" && (
          <button
            onClick={() => setEditingId("new")}
            className="px-3 py-1.5 bg-sky-600 text-white rounded text-sm font-semibold hover:bg-sky-700"
          >
            + Add aircraft
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {loading && <div className="h-24 bg-gray-50 rounded animate-pulse" />}

      {editingId === "new" && (
        <AircraftForm
          onCancel={() => setEditingId(null)}
          onSaved={async () => {
            setEditingId(null);
            await load();
          }}
        />
      )}

      {!loading && profiles.length === 0 && editingId !== "new" && (
        <p className="text-sm text-gray-500 italic">No aircraft saved yet.</p>
      )}

      <ul className="space-y-2 mt-2">
        {profiles.map((p) =>
          editingId === p.id ? (
            <li key={p.id}>
              <AircraftForm
                profile={p}
                onCancel={() => setEditingId(null)}
                onSaved={async () => {
                  setEditingId(null);
                  await load();
                }}
              />
            </li>
          ) : (
            <li
              key={p.id}
              className="flex items-start justify-between gap-4 bg-white border border-gray-200 rounded-lg p-3"
            >
              <div className="min-w-0">
                <div className="font-semibold">{p.name}</div>
                <div className="text-sm text-gray-600">
                  {[p.model, p.weightGrams ? `${p.weightGrams}g` : null, p.regNumber]
                    .filter(Boolean)
                    .join(" · ") || <span className="italic">No details</span>}
                </div>
                {p.notes && <div className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">{p.notes}</div>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setEditingId(p.id)}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="px-3 py-1 text-sm border border-red-300 text-red-700 rounded hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

function AircraftForm({
  profile,
  onCancel,
  onSaved,
}: {
  profile?: AircraftProfile;
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const weightRaw = (form.get("weightGrams") as string).trim();
    const payload = {
      name: (form.get("name") as string).trim(),
      model: (form.get("model") as string).trim() || null,
      weightGrams: weightRaw === "" ? null : Number(weightRaw),
      regNumber: (form.get("regNumber") as string).trim() || null,
      notes: (form.get("notes") as string).trim() || null,
    };
    if (payload.weightGrams !== null && !Number.isFinite(payload.weightGrams)) {
      setError("Weight must be a number (in grams)");
      setSaving(false);
      return;
    }
    try {
      const url = profile
        ? `/api/aircraft-profiles/${profile.id}`
        : "/api/aircraft-profiles";
      const method = profile ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Save failed (HTTP ${res.status})`);
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-sky-50 border border-sky-200 rounded-lg p-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Field label="Name (required)">
        <input
          name="name"
          required
          defaultValue={profile?.name ?? ""}
          maxLength={120}
          className="w-full px-3 py-2 border border-gray-300 rounded"
        />
      </Field>
      <Field label="Model">
        <input
          name="model"
          defaultValue={profile?.model ?? ""}
          maxLength={120}
          className="w-full px-3 py-2 border border-gray-300 rounded"
        />
      </Field>
      <Field label="Weight (grams)">
        <input
          name="weightGrams"
          type="number"
          min={0}
          max={25000}
          step={1}
          defaultValue={profile?.weightGrams ?? ""}
          className="w-full px-3 py-2 border border-gray-300 rounded"
        />
      </Field>
      <Field label="Registration number">
        <input
          name="regNumber"
          defaultValue={profile?.regNumber ?? ""}
          maxLength={60}
          className="w-full px-3 py-2 border border-gray-300 rounded"
        />
      </Field>
      <Field label="Notes">
        <textarea
          name="notes"
          defaultValue={profile?.notes ?? ""}
          maxLength={2000}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded"
        />
      </Field>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Saving…" : profile ? "Save changes" : "Add aircraft"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-semibold"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Missions section ─────────────────────────────────────────────────────

function MissionsSection() {
  const [missions, setMissions] = useState<MissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/missions");
      if (!res.ok) throw new Error(`Failed to load missions (HTTP ${res.status})`);
      const json = await res.json();
      setMissions(json.missions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (id: string, missionNumber: string) => {
    if (!confirm(`Delete mission ${missionNumber}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/missions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed (HTTP ${res.status})`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const sorted = useMemo(
    () =>
      [...missions].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    [missions],
  );

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Saved missions</h2>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {loading && <div className="h-24 bg-gray-50 rounded animate-pulse" />}
      {!loading && sorted.length === 0 && (
        <p className="text-sm text-gray-500 italic">No saved missions yet.</p>
      )}
      <ul className="space-y-2">
        {sorted.map((m) => (
          <li
            key={m.id}
            className="flex items-start justify-between gap-4 bg-white border border-gray-200 rounded-lg p-3"
          >
            <div className="min-w-0">
              <div className="font-semibold">
                Mission {m.missionNumber}{" "}
                <span className="text-gray-500 font-normal text-sm">
                  · {new Date(m.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {[m.aircraftType, m.location].filter(Boolean).join(" · ") || (
                  <span className="italic">No details</span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {m.flights.length} flight{m.flights.length === 1 ? "" : "s"} · {m.photos.length}{" "}
                photo{m.photos.length === 1 ? "" : "s"}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link
                href={`/?edit=${m.id}`}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                Edit
              </Link>
              <button
                onClick={() => handleDelete(m.id, m.missionNumber)}
                className="px-3 py-1 text-sm border border-red-300 text-red-700 rounded hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500 mt-3">
        Edit opens the checklist with the saved mission loaded. Save will update the existing
        record (PUT /api/missions/[id]).
      </p>
    </section>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      {children}
    </label>
  );
}
