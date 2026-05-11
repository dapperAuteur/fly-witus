// Stripe coupon + promotion-code creation. Called when an admin saves a
// `discount`-type promo. Lifetime-reopen promos don't go through Stripe
// (they re-route the entire pricing tile and use either Stripe checkout
// at the new price or CashApp manual flow), so this module only covers
// the discount type.

import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { promos } from "@/db/schema/commerce";
import { getStripe } from "./stripe";

export interface DiscountPromoInput {
  promoId: string;
  discountKind: "percent" | "fixed";
  discountAmount: number;
  promoCode: string | null;
  appliesTo: "monthly" | "annual" | "both";
  maxRedemptions: number | null;
  endsAt: Date | null;
}

// Create the Stripe coupon for this promo and (if a code is provided) a
// promotion_code attached to the coupon. Persist stripeCouponId on the
// promos row. Idempotent on the application side: if the promo already
// has a stripeCouponId we skip creation.
export async function syncStripeCouponForPromo(input: DiscountPromoInput): Promise<string> {
  const [existing] = await db
    .select({ stripeCouponId: promos.stripeCouponId })
    .from(promos)
    .where(eq(promos.id, input.promoId))
    .limit(1);
  if (existing?.stripeCouponId) return existing.stripeCouponId;

  const stripe = getStripe();
  const coupon = await stripe.coupons.create({
    name: `fly_witus_promo_${input.promoId}`,
    duration: "once",
    ...(input.discountKind === "percent"
      ? { percent_off: input.discountAmount }
      : { amount_off: Math.round(input.discountAmount * 100), currency: "usd" }),
    ...(input.maxRedemptions ? { max_redemptions: input.maxRedemptions } : {}),
    ...(input.endsAt ? { redeem_by: Math.floor(input.endsAt.getTime() / 1000) } : {}),
    metadata: {
      promoId: input.promoId,
      app: "fly_witus",
      appliesTo: input.appliesTo,
    },
  });

  // Optional human-readable code customers type at checkout. Stripe's
  // promotion_code is a separate object pointing at the coupon — wrapped
  // under `promotion` for the dahlia API version.
  if (input.promoCode) {
    const promoCodeParams: Stripe.PromotionCodeCreateParams = {
      promotion: { type: "coupon", coupon: coupon.id },
      code: input.promoCode.toUpperCase(),
    };
    if (input.maxRedemptions) promoCodeParams.max_redemptions = input.maxRedemptions;
    if (input.endsAt) {
      promoCodeParams.expires_at = Math.floor(input.endsAt.getTime() / 1000);
    }
    await stripe.promotionCodes.create(promoCodeParams);
  }

  await db
    .update(promos)
    .set({ stripeCouponId: coupon.id })
    .where(eq(promos.id, input.promoId));

  return coupon.id;
}
