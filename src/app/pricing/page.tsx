import Image from "next/image";
import Link from "next/link";
import { and, eq, lte, gte, isNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import { promos } from "@/db/schema/commerce";
import { getLifetimeCounter } from "@/lib/stripe";
import { PricingActions } from "./_components/pricing-actions";

// Server component — fetches the live lifetime slot counter and any
// currently-active lifetime_reopen promo at render time. Pricing is
// public so no auth needed; sign-in is required only to actually
// purchase (handled inside <PricingActions>).
export const metadata = {
  title: "Pricing — Fly WitUS",
  description: "Free, Cloud, and Lifetime plans for Fly WitUS.",
};

// Force dynamic rendering so the lifetime slot counter is fresh on every
// request. Without this, Next.js statically prerenders at build time and
// the counter freezes at deploy values — which would silently mislead
// pilots about availability after slots fill on launch day.
export const dynamic = "force-dynamic";

// Static price labels live here, not env, so the page renders the same
// values the pricing copy promises even if Stripe Dashboard prices ever
// drift. The actual Stripe charge uses STRIPE_PRICE_ID_*.
const PRICE_LABELS = {
  monthly: "$10.60",
  annual: "$103.29",
  lifetimeCard: "$103.29",
  lifetimeCashApp: "$100",
  annualSavings: "$24",
};

async function loadActiveLifetimeReopenPromo() {
  const now = new Date();
  const rows = await db
    .select()
    .from(promos)
    .where(
      and(
        eq(promos.app, "fly_witus"),
        eq(promos.type, "lifetime_reopen"),
        eq(promos.isActive, true),
        or(isNull(promos.startsAt), lte(promos.startsAt, now)),
        or(isNull(promos.endsAt), gte(promos.endsAt, now)),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

// Surface a banner for active discount promos that have bannerText set.
// We show at most one — admin can rank by editing isActive.
async function loadActiveDiscountBanner() {
  const now = new Date();
  const rows = await db
    .select({
      id: promos.id,
      bannerText: promos.bannerText,
      promoCode: promos.promoCode,
      discountKind: promos.discountKind,
      discountAmount: promos.discountAmount,
      appliesTo: promos.appliesTo,
    })
    .from(promos)
    .where(
      and(
        eq(promos.app, "fly_witus"),
        eq(promos.type, "discount"),
        eq(promos.isActive, true),
        or(isNull(promos.startsAt), lte(promos.startsAt, now)),
        or(isNull(promos.endsAt), gte(promos.endsAt, now)),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export default async function PricingPage() {
  const counter = await getLifetimeCounter();
  const [promo, discountBanner] = await Promise.all([
    loadActiveLifetimeReopenPromo(),
    loadActiveDiscountBanner(),
  ]);

  const standardSlotsRemaining = Math.max(
    0,
    counter.standardSlotsTotal - counter.standardSlotsUsed,
  );

  // Standard lifetime is "available" when standard slots remain OR a
  // re-open promo is active with its own pool.
  const promoSlotsRemaining = promo?.lifetimeSlots
    ? Math.max(0, promo.lifetimeSlots - promo.lifetimeSlotsUsed)
    : 0;
  const lifetimeAvailable = standardSlotsRemaining > 0 || promoSlotsRemaining > 0;

  // If a promo is active and overrides the price, show that price.
  // Otherwise the standard $103.29 / $100 split applies.
  const lifetimeCardPrice = promo?.lifetimePriceCard
    ? `$${promo.lifetimePriceCard.toFixed(2)}`
    : PRICE_LABELS.lifetimeCard;
  const lifetimeCashAppPrice = promo?.lifetimePriceCashapp
    ? `$${promo.lifetimePriceCashapp.toFixed(2)}`
    : PRICE_LABELS.lifetimeCashApp;

  return (
    <main className="min-h-screen bg-background font-sans p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Top header — link back home + pricing title */}
        <header className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-3 mb-4">
            <Image
              src="/flywitus-platypus-logo.png"
              alt="Fly WitUS"
              width={64}
              height={64}
              className="h-12 w-auto"
              priority
            />
            <span className="text-2xl font-extrabold text-card-foreground">FLY WIT US</span>
          </Link>
          <h1 className="text-4xl font-extrabold text-card-foreground">Pricing</h1>
          <p className="mt-2 text-muted-foreground">
            Built by a Part 107 pilot for Part 107 pilots.
          </p>
        </header>

        {promo && (
          <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
            <p className="text-sm font-bold text-amber-900 uppercase tracking-wider mb-1">
              ⚡ Limited time
            </p>
            <p className="text-base text-amber-950">
              {promo.bannerText ??
                `Lifetime accounts re-opened at $${promo.lifetimePriceCard?.toFixed(2)}. ${promoSlotsRemaining} slots available.`}
            </p>
          </div>
        )}

        {discountBanner && discountBanner.bannerText && (
          <div className="mb-8 rounded-2xl border-2 border-sky-300 bg-sky-50 p-5">
            <p className="text-sm font-bold text-sky-900 uppercase tracking-wider mb-1">
              🎟 Active discount
            </p>
            <p className="text-base text-sky-950">
              {discountBanner.bannerText}
              {discountBanner.promoCode && (
                <>
                  {" "}
                  Use code{" "}
                  <code className="font-mono font-bold bg-white px-2 py-0.5 rounded">
                    {discountBanner.promoCode}
                  </code>{" "}
                  at checkout.
                </>
              )}
            </p>
          </div>
        )}

        <PricingActions
          standardSlotsTotal={counter.standardSlotsTotal}
          standardSlotsRemaining={standardSlotsRemaining}
          lifetimeAvailable={lifetimeAvailable}
          lifetimeCardPrice={lifetimeCardPrice}
          lifetimeCashAppPrice={lifetimeCashAppPrice}
          monthlyPrice={PRICE_LABELS.monthly}
          annualPrice={PRICE_LABELS.annual}
          annualSavings={PRICE_LABELS.annualSavings}
        />

        <footer className="text-center text-sm text-muted-foreground py-8 mt-8 border-t border-border">
          <p>
            Questions? Email{" "}
            <a href="mailto:bam@awews.com" className="text-sky-600 hover:underline">
              bam@awews.com
            </a>
          </p>
          <p className="mt-2">
            <Link href="/" className="text-sky-600 hover:underline">
              ← Back to checklist
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
