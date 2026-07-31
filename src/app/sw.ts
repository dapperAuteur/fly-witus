/// <reference lib="webworker" />
// Service worker for Fly WitUS — built by serwist at next-build time and
// emitted to public/sw.js. Closes the launch-prep verify item:
//   "App works offline end-to-end: load → kill network → complete a
//    checklist + log a flight → reconnect → data syncs."
//
// The mission/profile data is already in localStorage (see page.tsx
// STORAGE_KEY/PROFILES_KEY/CURRENT_MISSION_KEY), so offline persistence
// of *user input* is solved without us. What this worker adds:
//   - Precaches the app shell (HTML, CSS, JS, fonts, logo) so the page
//     loads when network is gone.
//   - Default runtime caching strategies for static assets, API calls,
//     navigations.
//
// Cloud sync of missions across devices comes later in
// feat/track-e-cloud-sync-missions and uses the IndexedDB outbox pattern
// from src/lib/offline-outbox.ts (idb is already a dep).

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // serwist injects this manifest at build time.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// serwist picks the FIRST matching rule, so anything that must bypass the cache has to sit ahead
// of defaultCache. defaultCache's third rule matches every same-origin GET under /api/ with a
// NetworkFirst strategy (cacheName "apis", maxAgeSeconds 1440 * 60), which would happily serve a
// day-old 200 for /api/health after the database went down. A health check answered from cache is
// worse than no health check, so it is pinned to NetworkOnly.
const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: ({ sameOrigin, url: { pathname } }) => sameOrigin && pathname === "/api/health",
    handler: new NetworkOnly(),
  },
  ...defaultCache,
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
});

serwist.addEventListeners();
