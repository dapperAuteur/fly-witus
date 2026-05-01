import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import { env, hasStripe } from "@/lib/env";
import {
  getStripe,
  incrementLifetimeSlotsUsed,
  PLAN_TIER,
  type Plan,
} from "@/lib/stripe";

// Stripe webhook handler.
//
// Events handled:
//   checkout.session.completed   — activate paid tier on successful checkout.
//                                  For lifetime, atomically increment the
//                                  shared slot counter; if the pool is
//                                  exhausted (race with concurrent purchases
//                                  past the cap) we still grant the tier
//                                  since Stripe already charged the user, and
//                                  log a warning for admin reconciliation.
//   customer.subscription.updated — extend tierExpiresAt on renewal/upgrade.
//   customer.subscription.deleted — downgrade to 'free' tier when sub ends.
//   invoice.payment_failed        — log; future branch wires the email.
//
// Idempotency: Stripe retries on non-2xx, so handlers must be safe to
// re-run. accountTier transitions are idempotent (set, not toggle) and
// the lifetime slot increment uses a guarded atomic UPDATE — if the same
// event arrives twice we'd over-credit slots, so we deduplicate via the
// stripeSubscriptionId / payment_intent on the user row.

// Webhooks must read the raw body for signature verification — Next.js's
// default JSON parsing would corrupt it.
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!hasStripe) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 },
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, sig, env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        // Stripe sends events we didn't subscribe to in the dashboard;
        // ignore them quietly. Returning 2xx prevents the retry storm.
        break;
    }
  } catch (err) {
    console.error(`[stripe-webhook] handler ${event.type} threw:`, err);
    // Return 500 so Stripe retries. Idempotency in handlers means a
    // successful retry is safe.
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ── Handlers ───────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan as Plan | undefined;

  if (!userId || !plan) {
    console.warn("[stripe-webhook] checkout.session.completed missing metadata", {
      sessionId: session.id,
      metadata: session.metadata,
    });
    return;
  }

  if (plan === "lifetime") {
    // Idempotency guard: if the user is already lifetime, the increment
    // already ran on a previous delivery of this event. Skip.
    const [existing] = await db
      .select({ accountTier: users.accountTier })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (existing?.accountTier === "lifetime") {
      return;
    }

    const slotResult = await incrementLifetimeSlotsUsed();
    if (!slotResult) {
      // Pool exhausted past cap (race during high-traffic open). User
      // already paid via Stripe, so we still grant the tier. Admin can
      // reconcile by raising the standardSlotsTotal to absorb this row.
      console.warn(
        "[stripe-webhook] lifetime slot pool exhausted at credit time; still granting tier",
        { userId, sessionId: session.id },
      );
    }

    await db
      .update(users)
      .set({
        accountTier: "lifetime",
        tierExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    return;
  }

  // monthly / annual
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  let tierExpiresAt: Date | null = null;
  if (subscriptionId) {
    const sub = await getStripe().subscriptions.retrieve(subscriptionId);
    tierExpiresAt = subscriptionEndDate(sub);
  }

  await db
    .update(users)
    .set({
      accountTier: PLAN_TIER[plan],
      tierExpiresAt,
      stripeSubscriptionId: subscriptionId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  const plan = sub.metadata?.plan as Plan | undefined;
  if (!userId || !plan) {
    // Subscription can be updated for non-tier reasons (e.g. card change).
    // Fall back to looking up the user by stripeSubscriptionId.
    const [user] = await db
      .select({ id: users.id, accountTier: users.accountTier })
      .from(users)
      .where(eq(users.stripeSubscriptionId, sub.id))
      .limit(1);
    if (!user) return;
    await db
      .update(users)
      .set({ tierExpiresAt: subscriptionEndDate(sub), updatedAt: new Date() })
      .where(eq(users.id, user.id));
    return;
  }

  await db
    .update(users)
    .set({
      accountTier: PLAN_TIER[plan],
      tierExpiresAt: subscriptionEndDate(sub),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  // Downgrade by stripeSubscriptionId — metadata may be missing on older
  // subscriptions.
  await db
    .update(users)
    .set({
      accountTier: "free",
      tierExpiresAt: null,
      stripeSubscriptionId: null,
      updatedAt: new Date(),
    })
    .where(eq(users.stripeSubscriptionId, sub.id));
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // For now: log + leave the user's tier alone (Stripe does its own
  // dunning). When feat/track-e-emails-payment-failure lands we'll
  // send the v3 §8 "Action needed" email here.
  console.warn("[stripe-webhook] invoice.payment_failed", {
    invoiceId: invoice.id,
    customerId: invoice.customer,
  });
}

// ── Helpers ────────────────────────────────────────────────────

function subscriptionEndDate(sub: Stripe.Subscription): Date | null {
  // Stripe types now expose period boundaries on the subscription_item
  // rather than the subscription itself. Fall back to either source.
  const fromSub = (sub as unknown as { current_period_end?: number })
    .current_period_end;
  const fromItem = sub.items.data[0]?.current_period_end;
  const seconds = fromSub ?? fromItem;
  return typeof seconds === "number" ? new Date(seconds * 1000) : null;
}
