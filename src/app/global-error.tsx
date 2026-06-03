"use client";

import { useEffect } from "react";
import "./globals.css";

// Last-resort boundary for errors thrown in the root layout itself. It
// replaces the whole document, so it renders its own <html>/<body> and
// can't use the app nav — just a reload + a link home.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error boundary]", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="max-w-xl mx-auto px-6 py-16 text-center">
          {/* Plain <img> on purpose: this fallback runs when the app is
              broken, so we avoid next/image's runtime. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/flywitus-platypus-logo.png"
            alt="Fly WitUS"
            className="h-14 w-auto mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold">We hit some turbulence</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Something went wrong loading the app. Try again, or reload the page.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground mt-2">
              Reference: {error.digest}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => reset()}
              className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700"
            >
              Try again
            </button>
            {/* Plain <a> on purpose: a full reload recovers a broken
                document better than client navigation. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="px-4 py-2 border border-border rounded-lg text-sm font-semibold hover:bg-muted"
            >
              Back to checklist
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
