"use client";

// Auth-aware mission persistence layer.
//
// Anonymous users  → localStorage only (existing behavior preserved).
// Signed-in users  → POST to /api/missions, cached in IndexedDB. When
//                    offline, writes queue in IDB outbox and drain on the
//                    next online event (or manual flushOutbox call).
//
// page.tsx talks to this module instead of touching either layer
// directly. The auth state is passed in (fetched via useSession) so this
// stays a pure client lib without React imports.

import type { MissionInput } from "./missions-api";
import {
  cacheMission,
  cacheMissions,
  deleteOutboxEntry,
  enqueueOutbox,
  outboxCount,
  readCachedMissions,
  readOutbox,
  replaceCache,
  type CachedMission,
} from "./offline-outbox";

const LS_KEY = "uas_missions";

// MissionLog shape used by page.tsx. Lives here so missions-store stays
// the boundary between the UI's local representation and the API/IDB
// representation. The "weather" object and "flightRecords" name match
// the existing UI code; the API layer renames flightRecords → flights.
export interface MissionLog {
  missionNumber: string;
  timestamp: string;
  pilotName: string;
  location: string;
  aircraftType: string;
  rpCert: string;
  profileId?: string;
  completed: Record<string, boolean | string>;
  weather: { temperature?: string; wind?: string; precipitation?: string };
  flightRecords: Array<{
    flightNumber: number;
    takeoffLoc: string;
    landingLoc: string;
    launchTime: string;
    landingTime: string;
    elapsedTime: string;
    batteryVoltage: string;
    notes: string;
  }>;
  photos?: Array<{ url: string; caption?: string }>;
  // Optional sync fields populated only for signed-in users.
  id?: string;
  syncStatus?: "pending" | "synced";
}

interface ApiFlight {
  flightNumber: number;
  takeoffLocation: string | null;
  landingLocation: string | null;
  launchTime: string | null;
  landingTime: string | null;
  elapsedTime: string | null;
  batteryVoltage: string | null;
  notes: string | null;
}

interface ApiMission {
  id: string;
  missionNumber: string;
  timestamp: string;
  pilotName: string | null;
  location: string | null;
  aircraftType: string | null;
  rpCert: string | null;
  profileId: string | null;
  weatherTemperature: string | null;
  weatherWind: string | null;
  weatherPrecipitation: string | null;
  completed: Record<string, boolean | string>;
  flights: ApiFlight[];
  photos: Array<{ url: string; caption: string | null }>;
}

// ── Conversion ─────────────────────────────────────────────────

function localToApi(m: MissionLog): MissionInput {
  return {
    missionNumber: m.missionNumber,
    timestamp: m.timestamp,
    pilotName: m.pilotName || null,
    location: m.location || null,
    aircraftType: m.aircraftType || null,
    rpCert: m.rpCert || null,
    profileId: m.profileId ?? null,
    missionType: "recreational",
    weather: {
      temperature: m.weather.temperature,
      wind: m.weather.wind,
      precipitation: m.weather.precipitation,
    },
    completed: m.completed,
    flights: m.flightRecords.map((f) => ({
      flightNumber: f.flightNumber,
      takeoffLocation: f.takeoffLoc || null,
      landingLocation: f.landingLoc || null,
      launchTime: f.launchTime || null,
      landingTime: f.landingTime || null,
      elapsedTime: f.elapsedTime || null,
      batteryVoltage: f.batteryVoltage || null,
      notes: f.notes || null,
    })),
    photos: (m.photos ?? []).map((p) => ({
      url: p.url,
      caption: p.caption ?? null,
    })),
  };
}

function apiToLocal(m: ApiMission): MissionLog {
  return {
    id: m.id,
    syncStatus: "synced",
    missionNumber: m.missionNumber,
    timestamp:
      typeof m.timestamp === "string" ? m.timestamp : new Date(m.timestamp).toISOString(),
    pilotName: m.pilotName ?? "",
    location: m.location ?? "",
    aircraftType: m.aircraftType ?? "",
    rpCert: m.rpCert ?? "",
    profileId: m.profileId ?? undefined,
    completed: m.completed,
    weather: {
      temperature: m.weatherTemperature ?? undefined,
      wind: m.weatherWind ?? undefined,
      precipitation: m.weatherPrecipitation ?? undefined,
    },
    flightRecords: m.flights.map((f) => ({
      flightNumber: f.flightNumber,
      takeoffLoc: f.takeoffLocation ?? "",
      landingLoc: f.landingLocation ?? "",
      launchTime: f.launchTime ?? "",
      landingTime: f.landingTime ?? "",
      elapsedTime: f.elapsedTime ?? "",
      batteryVoltage: f.batteryVoltage ?? "",
      notes: f.notes ?? "",
    })),
    photos: m.photos.map((p) => ({ url: p.url, caption: p.caption ?? undefined })),
  };
}

function localToCached(m: MissionLog, syncStatus: "pending" | "synced"): CachedMission {
  return {
    id: m.id,
    missionNumber: m.missionNumber,
    timestamp: m.timestamp,
    pilotName: m.pilotName || null,
    location: m.location || null,
    aircraftType: m.aircraftType || null,
    rpCert: m.rpCert || null,
    weather: m.weather,
    completed: m.completed,
    flights: m.flightRecords,
    photos: m.photos ?? [],
    syncStatus,
  };
}

function cachedToLocal(c: CachedMission): MissionLog {
  return {
    id: c.id,
    syncStatus: c.syncStatus,
    missionNumber: c.missionNumber,
    timestamp: c.timestamp,
    pilotName: c.pilotName ?? "",
    location: c.location ?? "",
    aircraftType: c.aircraftType ?? "",
    rpCert: c.rpCert ?? "",
    completed: c.completed,
    weather: c.weather,
    flightRecords: c.flights.map((f) => ({
      flightNumber: f.flightNumber,
      takeoffLoc: f.takeoffLoc ?? "",
      landingLoc: f.landingLoc ?? "",
      launchTime: f.launchTime ?? "",
      landingTime: f.landingTime ?? "",
      elapsedTime: f.elapsedTime ?? "",
      batteryVoltage: f.batteryVoltage ?? "",
      notes: f.notes ?? "",
    })),
    photos: c.photos,
  };
}

// ── localStorage path (anonymous) ─────────────────────────────

function readLocal(): MissionLog[] {
  try {
    const data = window.localStorage.getItem(LS_KEY);
    return data ? (JSON.parse(data) as MissionLog[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(missions: MissionLog[]): void {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(missions));
  } catch (err) {
    console.error("[missions-store] localStorage write failed:", err);
  }
}

// ── Public API ────────────────────────────────────────────────

export async function listMissions(authed: boolean): Promise<MissionLog[]> {
  if (!authed) return readLocal();

  // Signed-in: try server, fall back to IDB cache when offline / fetch fails.
  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const res = await fetch("/api/missions", { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as { missions: ApiMission[] };
        const local = json.missions.map(apiToLocal);
        // Persist to IDB for offline reads.
        await replaceCache(local.map((m) => localToCached(m, "synced")));
        return local;
      }
    } catch {
      // fall through to IDB
    }
  }
  const cached = await readCachedMissions().catch(() => []);
  return cached.map(cachedToLocal);
}

export async function saveMission(authed: boolean, mission: MissionLog): Promise<MissionLog> {
  if (!authed) {
    const list = readLocal();
    list.unshift(mission);
    writeLocal(list);
    return mission;
  }

  // Signed-in: try POST first; queue on failure.
  const payload = localToApi(mission);
  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const res = await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = (await res.json()) as { mission: ApiMission };
        const synced = apiToLocal(json.mission);
        await cacheMission(localToCached(synced, "synced"));
        return synced;
      }
      // Server returned 4xx/5xx — fall through to outbox so the user
      // doesn't lose data. 409 (duplicate) is a no-op since the row
      // already exists; we just refresh the cache.
      if (res.status === 409) {
        const pending: MissionLog = { ...mission, syncStatus: "synced" };
        await cacheMission(localToCached(pending, "synced"));
        return pending;
      }
    } catch {
      // network error — fall through to outbox
    }
  }
  await enqueueOutbox(payload);
  const pending: MissionLog = { ...mission, syncStatus: "pending" };
  await cacheMission(localToCached(pending, "pending"));
  return pending;
}

export async function flushOutbox(): Promise<{ flushed: number; remaining: number }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const remaining = await outboxCount().catch(() => 0);
    return { flushed: 0, remaining };
  }
  const entries = await readOutbox().catch(() => []);
  let flushed = 0;
  for (const entry of entries) {
    try {
      const res = await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry.payload),
      });
      if (res.ok) {
        const json = (await res.json()) as { mission: ApiMission };
        const synced = apiToLocal(json.mission);
        await cacheMission(localToCached(synced, "synced"));
        await deleteOutboxEntry(entry.id);
        flushed++;
      } else if (res.status === 409) {
        // Server already has this mission (idempotent retry succeeded
        // earlier or another device synced it). Drop the outbox entry.
        await deleteOutboxEntry(entry.id);
        flushed++;
      } else {
        // 4xx/5xx other than 409 — leave entry in outbox for next attempt
        // and stop iterating so we don't pile up failed retries.
        break;
      }
    } catch {
      // Network blip mid-drain; stop and leave the rest for next online.
      break;
    }
  }
  const remaining = await outboxCount().catch(() => 0);
  return { flushed, remaining };
}

export async function pendingCount(): Promise<number> {
  return outboxCount().catch(() => 0);
}

// Pre-fetch a batch of missions for offline reading. Useful right after
// sign-in so missions are warm when the user goes off-grid.
export async function warmCacheFromServer(): Promise<void> {
  try {
    const res = await fetch("/api/missions", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as { missions: ApiMission[] };
    const cached = json.missions
      .map(apiToLocal)
      .map((m) => localToCached(m, "synced"));
    await cacheMissions(cached);
  } catch {
    // ignore — opportunistic warm only
  }
}
