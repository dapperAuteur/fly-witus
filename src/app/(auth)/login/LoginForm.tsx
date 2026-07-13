"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { signIn } from "@/lib/auth-client";
import { WitusSsoButton } from "@/components/witus-sso-button";

export function LoginForm({ witusSsoEnabled }: { witusSsoEnabled: boolean }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter an email address.");
      return;
    }

    setLoading(true);
    const result = await signIn.magicLink({
      email: trimmed,
      callbackURL: "/",
    });
    setLoading(false);

    if (result.error) {
      setError(result.error.message ?? "Could not send sign-in link. Try again.");
      return;
    }

    setSubmitted(trimmed);
  }

  function reset() {
    setSubmitted(null);
    setEmail("");
    setError(null);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted px-4">
      <div className="w-full max-w-md bg-card text-card-foreground rounded-2xl shadow-lg p-8 border-t-4 border-sky-500">
        <div className="flex flex-col items-center mb-6">
          <Image
            src="/flywitus-platypus-logo.png"
            alt="Fly WitUS"
            width={64}
            height={64}
            className="h-14 w-auto mb-3"
            priority
          />
          <h1 className="text-2xl font-extrabold text-card-foreground">Fly WitUS</h1>
        </div>

        {submitted ? (
          <div className="text-center">
            <h2 className="text-xl font-bold text-card-foreground mb-2">Check your email</h2>
            <p className="text-muted-foreground text-sm mb-1">
              We sent a sign-in link to{" "}
              <span className="font-semibold text-card-foreground">{submitted}</span>.
            </p>
            <p className="text-muted-foreground text-sm mb-6">
              Click the link to continue. It expires in 15 minutes.
            </p>
            <button
              type="button"
              onClick={reset}
              className="text-sm text-sky-600 hover:text-sky-700 font-medium"
            >
              ← Use a different email
            </button>
          </div>
        ) : (
          <>
            <p className="text-center text-muted-foreground mb-4">Enter your email to sign in</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                disabled={loading}
              />
              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-semibold transition disabled:bg-gray-400"
              >
                {loading ? "Sending…" : "Send Sign-In Link"}
              </button>
            </form>

            {witusSsoEnabled && (
              <div className="mt-4">
                <WitusSsoButton />
              </div>
            )}

            <div className="flex items-center my-6">
              <div className="flex-grow border-t border-border" />
              <span className="px-3 text-xs text-muted-foreground uppercase tracking-wider">or</span>
              <div className="flex-grow border-t border-border" />
            </div>

            <Link
              href="/"
              className="block text-center w-full py-2 border border-border text-muted-foreground rounded-lg hover:bg-muted font-semibold transition"
            >
              Continue Without Account
            </Link>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Local storage only — no cloud sync, no groups.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
