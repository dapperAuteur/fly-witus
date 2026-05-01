import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

// Promo system per v3 §2D. Three types:
//   lifetime_reopen — temporarily re-open lifetime tier with custom price + slot count
//   discount        — % or $ off monthly/annual via Stripe coupon
//   trial           — extend free-trial period (placeholder for future)
export const promoType = pgEnum("promo_type", ["lifetime_reopen", "discount", "trial"]);

export const discountKind = pgEnum("discount_kind", ["percent", "fixed"]);

export const promoAppliesTo = pgEnum("promo_applies_to", ["monthly", "annual", "both"]);

export const promos = pgTable(
  "promos",
  {
    id: text("id").primaryKey(),

    // v3 §2D reusability note: same admin panel manages promos across all
    // paid WitUS apps, so each row carries its target app.
    app: text("app").notNull().default("fly_witus"),

    name: text("name").notNull(),
    type: promoType("type").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),

    // ── Lifetime-reopen fields ─────────────────────────────────
    lifetimePriceCard: real("lifetime_price_card"),
    lifetimePriceCashapp: real("lifetime_price_cashapp"),
    lifetimeSlots: integer("lifetime_slots"),
    lifetimeSlotsUsed: integer("lifetime_slots_used").notNull().default(0),
    bannerText: text("banner_text"),

    // ── Discount fields ────────────────────────────────────────
    // Stripe coupon is created via the Stripe API when the discount promo
    // is saved; the coupon ID is stored here for redemption tracking.
    stripeCouponId: text("stripe_coupon_id"),
    discountKind: discountKind("discount_kind"),
    discountAmount: real("discount_amount"),
    appliesTo: promoAppliesTo("applies_to"),
    // Optional: leave blank to apply automatically on every checkout.
    // Indexed unique so we can look up by code at checkout time.
    promoCode: text("promo_code"),
    maxRedemptions: integer("max_redemptions"),
    redemptionsUsed: integer("redemptions_used").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // No FK cascade — preserve promo records even if the admin's user row is
    // ever soft-deleted; we want the audit trail.
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    index("promos_app_active_idx").on(t.app, t.isActive),
    // PG treats NULLs as distinct in unique indexes, so multiple promos
    // can have NULL promoCode (auto-applied promos) without collision.
    uniqueIndex("promos_code_unique").on(t.promoCode),
  ],
);

// Singleton tracker for the standard 100-slot lifetime offering. Promo
// re-opens track their own slots in the promos table (lifetimeSlotsUsed).
//
// We use a singleton row rather than a settings-style key/value because
// counter increments need atomic UPDATE … RETURNING semantics, which
// only work cleanly on a real row with a known id.
export const lifetimeSlotCounter = pgTable("lifetime_slot_counter", {
  id: integer("id").primaryKey().default(1),
  standardSlotsTotal: integer("standard_slots_total").notNull().default(100),
  standardSlotsUsed: integer("standard_slots_used").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Promo = typeof promos.$inferSelect;
export type NewPromo = typeof promos.$inferInsert;
export type LifetimeSlotCounter = typeof lifetimeSlotCounter.$inferSelect;
