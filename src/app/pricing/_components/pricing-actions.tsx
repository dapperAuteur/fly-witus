"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";

interface Props {
  standardSlotsTotal: number;
  standardSlotsRemaining: number;
  lifetimeAvailable: boolean;
  lifetimeCardPrice: string;
  lifetimeCashAppPrice: string;
  monthlyPrice: string;
  annualPrice: string;
  annualSavings: string;
}

type Plan = "monthly" | "annual" | "lifetime";

export function PricingActions({
  standardSlotsTotal,
  standardSlotsRemaining,
  lifetimeAvailable,
  lifetimeCardPrice,
  lifetimeCashAppPrice,
  monthlyPrice,
  annualPrice,
  annualSavings,
}: Props) {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [loading, setLoading] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(plan: Plan) {
    setError(null);
    if (sessionLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }

    setLoading(plan);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { url?: string; error?: string; code?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not start checkout. Try again.");
        setLoading(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error starting checkout. Try again.");
      setLoading(null);
    }
  }

  function startCashAppFlow() {
    // Placeholder until feat/track-e-cashapp-flow lands. Click takes
    // the user to /cashapp/request which doesn't exist yet — replaced
    // with the real form in the next branch.
    setError(
      "CashApp activation goes live shortly. For now, use card checkout — same lifetime, instant activation.",
    );
  }

  return (
    <div className="space-y-6">
      {/* Billing toggle (affects Cloud column only) */}
      <div className="flex justify-center items-center gap-3">
        <span
          className={
            billing === "monthly" ? "font-bold text-gray-900" : "text-gray-500"
          }
        >
          Monthly
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={billing === "annual"}
          onClick={() => setBilling((b) => (b === "monthly" ? "annual" : "monthly"))}
          className="relative inline-flex h-7 w-14 items-center rounded-full bg-sky-600 transition"
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
              billing === "annual" ? "translate-x-8" : "translate-x-1"
            }`}
          />
        </button>
        <span className="flex items-center gap-2">
          <span
            className={
              billing === "annual" ? "font-bold text-gray-900" : "text-gray-500"
            }
          >
            Annual
          </span>
          <span className="text-xs font-semibold text-lime-700 bg-lime-100 px-2 py-0.5 rounded-full">
            save {annualSavings}
          </span>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* FREE */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-gray-400 flex flex-col">
          <h2 className="text-xl font-extrabold text-gray-900 mb-1">FREE</h2>
          <p className="text-3xl font-extrabold text-gray-900">$0</p>
          <p className="text-gray-500 text-sm mb-4">forever</p>
          <ul className="space-y-2 text-sm text-gray-700 mb-6 flex-grow">
            <li>✓ Pre-flight checklist</li>
            <li>✓ PDF export (FAA Part 107)</li>
            <li>✓ Local mission log</li>
            <li className="text-gray-400">✗ Cloud sync</li>
            <li className="text-gray-400">✗ Groups</li>
            <li className="text-gray-400">✗ Analytics</li>
          </ul>
          <Link
            href="/"
            className="block text-center w-full py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition"
          >
            Use Free
          </Link>
        </div>

        {/* CLOUD */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-sky-500 flex flex-col">
          <h2 className="text-xl font-extrabold text-gray-900 mb-1">CLOUD</h2>
          <p className="text-3xl font-extrabold text-gray-900">
            {billing === "monthly" ? monthlyPrice : annualPrice}
          </p>
          <p className="text-gray-500 text-sm mb-4">
            {billing === "monthly" ? "per month" : "per year"}
          </p>
          <ul className="space-y-2 text-sm text-gray-700 mb-6 flex-grow">
            <li className="font-semibold">Everything in Free, plus:</li>
            <li>✓ Cloud sync across devices</li>
            <li>✓ Groups + flight requests</li>
            <li>✓ Flight analytics</li>
            <li>✓ DJI telemetry import</li>
            <li>✓ Battery cycle tracker</li>
            <li>✓ LAANC + Part 107 tracking</li>
          </ul>
          <button
            type="button"
            onClick={() => startCheckout(billing)}
            disabled={loading !== null || sessionLoading}
            className="w-full py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-semibold transition disabled:bg-gray-400"
          >
            {loading === billing
              ? "Redirecting…"
              : `Get Cloud ${billing === "monthly" ? "Monthly" : "Annual"}`}
          </button>
        </div>

        {/* LIFETIME */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-fuchsia-500 flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-extrabold text-gray-900">LIFETIME</h2>
            {lifetimeAvailable ? (
              <span className="text-xs font-semibold text-fuchsia-700 bg-fuchsia-100 px-2 py-0.5 rounded-full">
                ⚡ {standardSlotsRemaining} of {standardSlotsTotal} left
              </span>
            ) : (
              <span className="text-xs font-semibold text-gray-700 bg-gray-200 px-2 py-0.5 rounded-full">
                Sold Out
              </span>
            )}
          </div>
          <p className="text-3xl font-extrabold text-gray-900">{lifetimeCardPrice}</p>
          <p className="text-gray-500 text-sm mb-1">one-time</p>
          <p className="text-gray-500 text-sm mb-4">
            or {lifetimeCashAppPrice} via CashApp
          </p>
          <ul className="space-y-2 text-sm text-gray-700 mb-6 flex-grow">
            <li className="font-semibold">Everything in Cloud, forever:</li>
            <li>✓ No renewal fees</li>
            <li>✓ All future features included</li>
            <li>✓ Priority support</li>
          </ul>
          {lifetimeAvailable ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => startCheckout("lifetime")}
                disabled={loading !== null || sessionLoading}
                className="w-full py-2 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 font-semibold transition disabled:bg-gray-400"
              >
                {loading === "lifetime" ? "Redirecting…" : "Get Lifetime — Card"}
              </button>
              <button
                type="button"
                onClick={startCashAppFlow}
                disabled={loading !== null}
                className="w-full py-2 border-2 border-fuchsia-600 text-fuchsia-700 rounded-lg hover:bg-fuchsia-50 font-semibold transition disabled:opacity-50"
              >
                Get Lifetime — CashApp
              </button>
            </div>
          ) : (
            <p className="text-center text-sm text-gray-600 italic">
              Watch this page for a re-open promo.
            </p>
          )}
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="text-center text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2"
        >
          {error}
        </p>
      )}

      {!session && !sessionLoading && (
        <p className="text-center text-sm text-gray-500">
          You&apos;ll need to{" "}
          <Link href="/login" className="text-sky-600 hover:underline">
            sign in
          </Link>{" "}
          before checkout.
        </p>
      )}
    </div>
  );
}
