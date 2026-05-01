import Stripe from "stripe";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { lifetimeSlotCounter } from "@/db/schema/commerce";
import { env, hasStripe } from "./env";

// v3 §2: 4 paid-tier states. Plan keys are the public/stable names the
// checkout endpoint accepts; "lifetime" maps to the one-time price,
// the others to recurring subscription prices.
export type Plan = "monthly" | "annual" | "lifetime";

export const PLAN_PRICES: Record<Plan, string | undefined> = {
  monthly: env.STRIPE_PRICE_ID_MONTHLY,
  annual: env.STRIPE_PRICE_ID_ANNUAL,
  lifetime: env.STRIPE_PRICE_ID_LIFETIME,
};

export const PLAN_TIER: Record<Plan, "cloud_monthly" | "cloud_annual" | "lifetime"> = {
  monthly: "cloud_monthly",
  annual: "cloud_annual",
  lifetime: "lifetime",
};

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (!hasStripe) {
    throw new Error("Stripe is not configured. See user-task #03.");
  }
  if (cached) return cached;
  // apiVersion pinned. Bump intentionally on Stripe SDK upgrades so we
  // see the changelog instead of silently inheriting new API behavior.
  cached = new Stripe(env.STRIPE_SECRET_KEY!, { apiVersion: "2026-04-22.dahlia" });
  return cached;
}

// ── Lifetime slot counter ──────────────────────────────────────
//
// Singleton row at id=1. Created lazily on first read so we don't need a
// separate seed script. v3 §2: 100 standard slots; once full, the
// lifetime tier disappears from the pricing page until an admin opens a
// promo with its own slot pool.

export async function getLifetimeCounter() {
  const [existing] = await db.select().from(lifetimeSlotCounter).limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(lifetimeSlotCounter)
    .values({ id: 1 })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  // Race: someone else inserted between our SELECT and INSERT. Re-read.
  const [row] = await db.select().from(lifetimeSlotCounter).limit(1);
  if (!row) throw new Error("lifetime_slot_counter singleton missing after init");
  return row;
}

export async function lifetimeSlotsAvailable(): Promise<number> {
  const c = await getLifetimeCounter();
  return Math.max(0, c.standardSlotsTotal - c.standardSlotsUsed);
}

// Atomic increment with a WHERE guard so the standard pool can't
// over-sell when two webhooks land at once. Returns the post-increment
// row, or null if the increment was rejected (slots full).
export async function incrementLifetimeSlotsUsed(): Promise<{
  used: number;
  total: number;
} | null> {
  const result = await db
    .update(lifetimeSlotCounter)
    .set({
      standardSlotsUsed: sql`${lifetimeSlotCounter.standardSlotsUsed} + 1`,
      updatedAt: new Date(),
    })
    .where(
      sql`${lifetimeSlotCounter.id} = 1 AND ${lifetimeSlotCounter.standardSlotsUsed} < ${lifetimeSlotCounter.standardSlotsTotal}`,
    )
    .returning();

  if (result.length === 0) return null;
  return {
    used: result[0].standardSlotsUsed,
    total: result[0].standardSlotsTotal,
  };
}

// ── Customer reuse ─────────────────────────────────────────────
//
// Better Auth stores users.stripeCustomerId, but it's null on first
// purchase. ensureStripeCustomer reuses it when present and creates +
// persists a new one otherwise. Returns the customer id.

import { users } from "@/db/schema/auth";

export async function ensureStripeCustomer(input: {
  userId: string;
  email: string;
}): Promise<string> {
  const [user] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (user?.stripeCustomerId) return user.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: input.email,
    metadata: { userId: input.userId },
  });

  await db
    .update(users)
    .set({ stripeCustomerId: customer.id })
    .where(eq(users.id, input.userId));

  return customer.id;
}
