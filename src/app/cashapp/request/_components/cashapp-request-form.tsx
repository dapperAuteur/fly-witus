"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function CashAppRequestForm() {
  const router = useRouter();
  const [cashappUsername, setCashappUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const trimmed = cashappUsername.trim();
    if (!trimmed) {
      setError("Enter your CashApp username.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/cashapp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cashappUsername: trimmed }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not submit. Try again.");
        setSubmitting(false);
        return;
      }
      // Reload the server component so the page renders the "pending"
      // state with the username we just stored.
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-0">
        <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 font-mono">
          $
        </span>
        <input
          type="text"
          autoComplete="off"
          inputMode="text"
          required
          value={cashappUsername.startsWith("$") ? cashappUsername.slice(1) : cashappUsername}
          onChange={(e) => setCashappUsername(e.target.value.replace(/^\$/, ""))}
          placeholder="YourCashTag"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500 font-mono"
          disabled={submitting}
          maxLength={32}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 font-semibold transition disabled:bg-gray-400"
      >
        {submitting ? "Submitting…" : "I've sent payment — Request Activation"}
      </button>
      <p className="text-xs text-gray-500 text-center">
        Admin verifies within 24 hours. You&apos;ll receive a confirmation email.
      </p>
    </form>
  );
}
