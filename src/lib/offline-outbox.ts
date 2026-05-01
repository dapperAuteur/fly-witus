"use client";

// IndexedDB-backed offline outbox + read cache for the cloud-sync flow.
// Two object stores:
//   - "outbox":   pending POSTs queued when the network is unreachable.
//   - "missions": local cache of server-side missions, keyed by missionNumber,
//                 so signed-in users see their history even when offline.
//
// Anonymous users never touch this — page.tsx still uses localStorage for
// them via missions-store.ts.

import { openDB, type IDBPDatabase } from "idb";
import { nanoid } from "nanoid";
import type { MissionInput } from "./missions-api";

const DB_NAME = "fly-witus";
const DB_VERSION = 1;
const STORE_OUTBOX = "outbox";
const STORE_CACHE = "missions";

export type OutboxOp = "create";

export interface OutboxEntry {
  id: string;
  op: OutboxOp;
  payload: MissionInput;
  createdAt: string;
  // missionNumber duped to top level so the cache lookup that swaps a
  // pending entry for the server-confirmed one can match without parsing
  // payload.
  missionNumber: string;
}

export interface CachedMission {
  // Mirrors the server response but keyed on missionNumber for both the
  // user-input case (no server id yet) and the after-confirm case
  // (id present).
  id?: string;
  missionNumber: string;
  timestamp: string;
  pilotName: string | null;
  location: string | null;
  aircraftType: string | null;
  rpCert: string | null;
  weather: { temperature?: string; wind?: string; precipitation?: string };
  completed: Record<string, boolean | string>;
  flights: Array<{
    flightNumber: number;
    takeoffLoc: string;
    landingLoc: string;
    launchTime: string;
    landingTime: string;
    elapsedTime: string;
    batteryVoltage: string;
    notes: string;
  }>;
  photos: Array<{ url: string; caption?: string }>;
  // 'pending' if waiting in outbox; 'synced' once the server confirmed.
  syncStatus: "pending" | "synced";
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB not available"));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
          db.createObjectStore(STORE_OUTBOX, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_CACHE)) {
          db.createObjectStore(STORE_CACHE, { keyPath: "missionNumber" });
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueueOutbox(payload: MissionInput): Promise<OutboxEntry> {
  const db = await getDb();
  const entry: OutboxEntry = {
    id: nanoid(),
    op: "create",
    payload,
    createdAt: new Date().toISOString(),
    missionNumber: payload.missionNumber,
  };
  await db.put(STORE_OUTBOX, entry);
  return entry;
}

export async function readOutbox(): Promise<OutboxEntry[]> {
  const db = await getDb();
  return (await db.getAll(STORE_OUTBOX)) as OutboxEntry[];
}

export async function deleteOutboxEntry(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_OUTBOX, id);
}

export async function outboxCount(): Promise<number> {
  const db = await getDb();
  return db.count(STORE_OUTBOX);
}

export async function cacheMission(mission: CachedMission): Promise<void> {
  const db = await getDb();
  await db.put(STORE_CACHE, mission);
}

export async function cacheMissions(items: CachedMission[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_CACHE, "readwrite");
  for (const m of items) {
    await tx.store.put(m);
  }
  await tx.done;
}

export async function readCachedMissions(): Promise<CachedMission[]> {
  const db = await getDb();
  const all = (await db.getAll(STORE_CACHE)) as CachedMission[];
  // Newest first by ISO timestamp.
  return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// Replace the cache wholesale after a successful list fetch — keeps the
// signed-in user's IDB store in sync with what's actually on the server,
// drops missions deleted from another device.
export async function replaceCache(items: CachedMission[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_CACHE, "readwrite");
  await tx.store.clear();
  for (const m of items) {
    await tx.store.put(m);
  }
  await tx.done;
}

export async function clearAllSyncData(): Promise<void> {
  // Called on sign-out so the next anonymous session doesn't see the
  // previous user's cached missions through IDB.
  const db = await getDb();
  const tx = db.transaction([STORE_OUTBOX, STORE_CACHE], "readwrite");
  await tx.objectStore(STORE_OUTBOX).clear();
  await tx.objectStore(STORE_CACHE).clear();
  await tx.done;
}
