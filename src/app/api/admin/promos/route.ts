import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/db/client";
import { promos } from "@/db/schema/commerce";
import { hasStripe } from "@/lib/env";
import { syncStripeCouponForPromo } from "@/lib/promos";
import { requireAdmin } from "@/lib/api-auth";

const baseSchema = z.object({
  name: z.string().trim().min(1).max(160),
  type: z.enum(["lifetime_reopen", "discount", "trial"]),
  isActive: z.boolean().default(false),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  bannerText: z.string().trim().max(280).nullable().optional(),

  // lifetime_reopen-specific
  lifetimePriceCard: z.number().positive().nullable().optional(),
  lifetimePriceCashapp: z.number().positive().nullable().optional(),
  lifetimeSlots: z.number().int().positive().nullable().optional(),

  // discount-specific
  discountKind: z.enum(["percent", "fixed"]).nullable().optional(),
  discountAmount: z.number().positive().nullable().optional(),
  appliesTo: z.enum(["monthly", "annual", "both"]).nullable().optional(),
  promoCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(3)
    .max(40)
    .regex(/^[A-Z0-9_-]+$/, "Code can only contain A-Z 0-9 _ -")
    .nullable()
    .optional(),
  maxRedemptions: z.number().int().positive().nullable().optional(),
});

// GET /api/admin/promos — list all promos for the admin table.
export async function GET() {
  const adminOrRes = await requireAdmin();
  if (adminOrRes instanceof NextResponse) return adminOrRes;

  const rows = await db.select().from(promos).orderBy(desc(promos.createdAt));
  return NextResponse.json({ promos: rows });
}

// POST /api/admin/promos — create. For type=discount also creates the
// Stripe coupon (and promotion_code if promoCode is set) so the next
// checkout session can apply it.
export async function POST(req: Request) {
  const adminOrRes = await requireAdmin();
  if (adminOrRes instanceof NextResponse) return adminOrRes;

  const body = await req.json().catch(() => null);
  const parsed = baseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid promo", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Type-specific required fields.
  if (input.type === "lifetime_reopen") {
    if (!input.lifetimeSlots || (!input.lifetimePriceCard && !input.lifetimePriceCashapp)) {
      return NextResponse.json(
        { error: "lifetime_reopen requires lifetimeSlots and at least one price" },
        { status: 400 },
      );
    }
  }
  if (input.type === "discount") {
    if (!input.discountKind || !input.discountAmount || !input.appliesTo) {
      return NextResponse.json(
        { error: "discount requires discountKind, discountAmount, appliesTo" },
        { status: 400 },
      );
    }
    if (input.discountKind === "percent" && input.discountAmount > 100) {
      return NextResponse.json(
        { error: "percent discount cannot exceed 100" },
        { status: 400 },
      );
    }
  }

  const id = nanoid();
  await db.insert(promos).values({
    id,
    app: "fly_witus",
    name: input.name,
    type: input.type,
    isActive: input.isActive,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    bannerText: input.bannerText ?? null,
    lifetimePriceCard: input.lifetimePriceCard ?? null,
    lifetimePriceCashapp: input.lifetimePriceCashapp ?? null,
    lifetimeSlots: input.lifetimeSlots ?? null,
    discountKind: input.discountKind ?? null,
    discountAmount: input.discountAmount ?? null,
    appliesTo: input.appliesTo ?? null,
    promoCode: input.promoCode ?? null,
    maxRedemptions: input.maxRedemptions ?? null,
    createdBy: adminOrRes.id,
  });

  // For discount promos: spin up the Stripe objects right away. Failure
  // here surfaces as 500 with the underlying message — the admin can
  // toggle isActive=false to prevent bad rows from advertising in the UI
  // while we investigate.
  let stripeCouponId: string | null = null;
  if (input.type === "discount" && hasStripe) {
    try {
      stripeCouponId = await syncStripeCouponForPromo({
        promoId: id,
        discountKind: input.discountKind!,
        discountAmount: input.discountAmount!,
        appliesTo: input.appliesTo!,
        promoCode: input.promoCode ?? null,
        maxRedemptions: input.maxRedemptions ?? null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
      });
    } catch (err) {
      console.error("[admin-promos] Stripe coupon create failed", err);
      return NextResponse.json(
        {
          error: "Promo saved but Stripe coupon creation failed",
          promoId: id,
          stripeError: err instanceof Error ? err.message : String(err),
        },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ id, stripeCouponId }, { status: 201 });
}
