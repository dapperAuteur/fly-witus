"use client";

import { useEffect } from "react";

// Registers the serwist-generated service worker on page load. Mounted
// once at the root layout. Production-only — in dev the SW is disabled
// at the build-plugin level (see next.config.ts) and registering a
// stale or non-existent /sw.js would just log warnings.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      console.warn("[sw] registration failed:", err);
    });
  }, []);
  return null;
}
