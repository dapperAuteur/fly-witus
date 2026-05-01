"use client";

import { useEffect, useState } from "react";

// Reactive online/offline state. SSR returns true (assume online) so the
// initial paint doesn't flash "Offline" before hydration. The first
// effect tick reads navigator.onLine for the real value.
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(true);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setOnline(navigator.onLine);
    }
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}
