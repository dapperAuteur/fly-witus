import { NextResponse } from "next/server";
import { z } from "zod";
import { env, hasStripe } from "@/lib/env";
import { requireUser } from "@/lib/api-auth";
import {
  ensureStripeCustomer,
  getStripe,
  lifetimeSlotsAvailable,
  PLAN_PRICES,
  type Plan,
} from "@/lib/stripe";

// POST /api/checkout — creates a Stripe Checkout session for the
// signed-in user. Returns { url } for the client to redirect to.
//
// Body: { plan: 'monthly' | 'annual' | 'lifetime' }
//
// 401 if not authed. 503 if Stripe env not configured. 409 if lifetime
// is sold out.

const bodySchema = z.object({
  plan: z.enum(["monthly", "annual", "lifetime"]),
});

export async function POST(req: Request) {
  if (!hasStripe) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 },
    );
  }

  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid plan", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const plan: Plan = parsed.data.plan;
  const priceId = PLAN_PRICES[plan];
  if (!priceId) {
    return NextResponse.json(
      { error: `Stripe price ID for plan "${plan}" is not configured` },
      { status: 503 },
    );
  }

  // Lifetime: refuse if standard pool sold out. Promo re-opens are
  // checked separately when that branch lands.
  if (plan === "lifetime") {
    const slots = await lifetimeSlotsAvailable();
    if (slots <= 0) {
      return NextResponse.json(
        {
          error:
            "Lifetime tier sold out. Watch the pricing page for a re-open promo.",
          code: "LIFETIME_SOLD_OUT",
        },
        { status: 409 },
      );
    }
  }

  const customerId = await ensureStripeCustomer({
    userId: userOrRes.id,
    email: userOrRes.email,
  });

  const stripe = getStripe();
  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");

  // Lifetime → one-time payment mode. Recurring plans → subscription mode.
  // Stripe rejects mixed line items so the mode must match the price type.
  const session = await stripe.checkout.sessions.create({
    mode: plan === "lifetime" ? "payment" : "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/?checkout=success&plan=${plan}`,
    cancel_url: `${baseUrl}/pricing?checkout=cancelled`,
    // Metadata round-trips into the webhook event so we can credit the
    // right user + plan even if the session/customer mapping is stale.
    metadata: { userId: userOrRes.id, plan },
    // Apply the same metadata to the resulting subscription / payment_intent
    // so downstream events (subscription.updated, etc.) carry it forward.
    subscription_data:
      plan === "lifetime"
        ? undefined
        : { metadata: { userId: userOrRes.id, plan } },
    payment_intent_data:
      plan === "lifetime" ? { metadata: { userId: userOrRes.id, plan } } : undefined,
    allow_promotion_codes: true,
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe did not return a checkout URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url, sessionId: session.id });
}
