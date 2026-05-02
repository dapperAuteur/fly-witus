import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { CashAppRequestForm } from "./_components/cashapp-request-form";

export const metadata = {
  title: "CashApp Activation — Fly WitUS",
};

export const dynamic = "force-dynamic";

export default async function CashAppRequestPage() {
  // Server-side auth check. Anonymous users land back on /login with a
  // post-login redirect to come right back here.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  // Read the user's current tier + cashapp status to render the right
  // state (form / pending notice / already-lifetime notice).
  const [me] = await db
    .select({
      accountTier: users.accountTier,
      cashappPaymentStatus: users.cashappPaymentStatus,
      cashappUsername: users.cashappUsername,
      cashappRequestedAt: users.cashappRequestedAt,
      cashappRejectionReason: users.cashappRejectionReason,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const cashappUsername = env.NEXT_PUBLIC_CASHAPP_USERNAME ?? "$Centenarian";
  const qrPath = env.NEXT_PUBLIC_CASHAPP_QR_PATH ?? "/images/cashapp-qr.jpg";
  const lifetimeAmount = "$100";

  const status = me?.cashappPaymentStatus;
  const isLifetime = me?.accountTier === "lifetime";

  return (
    <main className="min-h-screen bg-gray-50 font-sans p-4 sm:p-8">
      <div className="max-w-xl mx-auto">
        <header className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-3 mb-4">
            <Image
              src="/flywitus-platypus-logo.png"
              alt="Fly WitUS"
              width={48}
              height={48}
              className="h-10 w-auto"
              priority
            />
            <span className="text-xl font-extrabold text-gray-900">FLY WIT US</span>
          </Link>
          <h1 className="text-3xl font-extrabold text-gray-900">
            Lifetime via CashApp
          </h1>
        </header>

        {isLifetime ? (
          <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-lime-500">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              You&apos;re already lifetime ✓
            </h2>
            <p className="text-gray-700">
              No further action needed. Thanks for supporting Fly WitUS.
            </p>
            <Link
              href="/"
              className="mt-4 inline-block text-sky-600 hover:underline"
            >
              ← Back to checklist
            </Link>
          </div>
        ) : status === "pending" ? (
          <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-amber-500">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Pending verification
            </h2>
            <p className="text-gray-700 mb-2">
              We&apos;ve recorded your CashApp request as{" "}
              <span className="font-mono font-semibold">
                {me?.cashappUsername}
              </span>
              {me?.cashappRequestedAt
                ? ` on ${new Date(me.cashappRequestedAt).toLocaleString()}`
                : null}
              .
            </p>
            <p className="text-gray-700 mb-4">
              Admin will review and activate your account within 24 hours.
              You&apos;ll receive a confirmation email when active.
            </p>
            <Link
              href="/"
              className="text-sky-600 hover:underline"
            >
              ← Back to checklist
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-fuchsia-500">
            {status === "rejected" && me?.cashappRejectionReason && (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm font-semibold text-red-800 mb-1">
                  Previous request was rejected
                </p>
                <p className="text-sm text-red-700">
                  Reason: {me.cashappRejectionReason}
                </p>
                <p className="text-sm text-red-700 mt-2">
                  Re-send payment and submit again below.
                </p>
              </div>
            )}

            <h2 className="text-lg font-bold text-gray-900 mb-3">
              Step 1 — Send {lifetimeAmount} via CashApp
            </h2>
            <p className="text-gray-700 mb-3">
              Send to{" "}
              <span className="font-mono font-bold text-fuchsia-700">
                {cashappUsername}
              </span>
            </p>
            <div className="flex justify-center mb-5">
              <Image
                src={qrPath}
                alt={`CashApp QR for ${cashappUsername}`}
                width={200}
                height={200}
                className="w-48 h-48 border border-gray-200 rounded-lg"
              />
            </div>

            <h2 className="text-lg font-bold text-gray-900 mb-3">
              Step 2 — Tell us your CashApp username
            </h2>
            <p className="text-sm text-gray-600 mb-3">
              So admin can match your payment to your account.
            </p>
            <CashAppRequestForm />
          </div>
        )}

        <footer className="text-center text-sm text-gray-500 py-8 mt-8">
          <p>
            Prefer to pay by card?{" "}
            <Link href="/pricing" className="text-sky-600 hover:underline">
              Use card checkout
            </Link>{" "}
            for instant activation.
          </p>
        </footer>
      </div>
    </main>
  );
}
