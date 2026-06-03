"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { FEEDBACK_TYPES, feedbackTypeLabel, type FeedbackType } from "@/lib/feedback-api";

// Floating help/feedback widget shown on every page (rendered once in the
// root layout). Lets anyone — signed in or not — submit a bug, a piece of
// feedback, or a question. Captures the current page URL + user agent to
// help reproduce bugs. Also links to the self-serve /help docs.

export function HelpBubble() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setType("bug");
    setMessage("");
    setEmail("");
    setDone(false);
    setError(null);
  };

  const close = () => {
    setOpen(false);
    // Let the closing animation/visual settle before clearing the form.
    setTimeout(reset, 200);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          message: message.trim(),
          pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          contactEmail: session ? undefined : email.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Submit failed (HTTP ${res.status})`);
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Help & feedback"
          className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full bg-sky-600 text-white shadow-lg hover:bg-sky-700 transition flex items-center justify-center text-xl font-bold"
        >
          ?
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-card text-card-foreground border border-border shadow-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold">Help &amp; feedback</span>
            <button
              type="button"
              onClick={close}
              aria-label="Close help"
              className="text-muted-foreground hover:text-card-foreground text-lg leading-none"
            >
              ×
            </button>
          </div>

          {done ? (
            <div className="p-4 space-y-3">
              <p className="text-sm">Thanks — we got it. We&apos;ll follow up if needed.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={reset}
                  className="px-3 py-1.5 border border-border rounded-md text-sm font-semibold hover:bg-muted"
                >
                  Send another
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="px-3 py-1.5 bg-sky-600 text-white rounded-md text-sm font-semibold hover:bg-sky-700"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div className="flex gap-1">
                {FEEDBACK_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex-1 px-2 py-1.5 rounded-md text-xs font-semibold border transition ${
                      type === t
                        ? "bg-sky-600 text-white border-sky-600"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {feedbackTypeLabel(t)}
                  </button>
                ))}
              </div>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                maxLength={5000}
                rows={4}
                placeholder={
                  type === "bug"
                    ? "What went wrong? What did you expect?"
                    : type === "question"
                      ? "What would you like to know?"
                      : "Tell us what you think…"
                }
                className="w-full px-3 py-2 border border-border rounded-md text-sm"
              />

              {!session && (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email (optional — so we can reply)"
                  maxLength={320}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm"
                />
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={submitting || !message.trim()}
                className="w-full py-2 bg-sky-600 text-white rounded-md text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
              >
                {submitting ? "Sending…" : "Send"}
              </button>

              <p className="text-xs text-muted-foreground text-center">
                Looking for answers?{" "}
                <Link href="/help" onClick={close} className="text-sky-700 underline">
                  Browse the help docs
                </Link>
              </p>
            </form>
          )}
        </div>
      )}
    </>
  );
}
