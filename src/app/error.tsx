"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

// Route-level error boundary (~500s and uncaught render errors). Renders
// inside the root layout, so the global nav stays available; we also give
// a "Try again" (reset) and explicit links back into the app. The raw
// error is logged, never shown to the user.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error boundary]", error);
  }, [error]);

  return (
    <main className="max-w-xl mx-auto px-6 py-16 text-center">
      <Image
        src="/flywitus-platypus-logo.png"
        alt="Fly WitUS"
        width={64}
        height={64}
        className="h-14 w-auto mx-auto mb-4"
      />
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Something went wrong
      </p>
      <h1 className="text-2xl font-bold mt-1">We hit some turbulence</h1>
      <p className="text-sm text-muted-foreground mt-2">
        An unexpected error occurred. Your saved missions are safe — try again,
        or head back into the app.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground mt-2">Reference: {error.digest}</p>
      )}
      <div className="mt-6 flex flex-wrap gap-2 justify-center">
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-4 py-2 border border-border rounded-lg text-sm font-semibold hover:bg-muted"
        >
          Back to checklist
        </Link>
        <Link
          href="/help"
          className="px-4 py-2 border border-border rounded-lg text-sm font-semibold hover:bg-muted"
        >
          Get help
        </Link>
      </div>
    </main>
  );
}
