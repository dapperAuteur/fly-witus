import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// v3 brief §2: 4 paid-tier states. 'free' covers anonymous + signed-in-but-unpaid.
export const accountTier = pgEnum("account_tier", [
  "free",
  "cloud_monthly",
  "cloud_annual",
  "lifetime",
]);

// v3 brief §2B: CashApp manual-activation states.
export const cashAppStatus = pgEnum("cashapp_payment_status", [
  "pending",
  "verified",
  "rejected",
]);

export const users = pgTable(
  "users",
  {
    // Better Auth core
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    name: text("name"),
    image: text("image"),

    // v3 §4: account tier + Stripe linkage
    accountTier: accountTier("account_tier").notNull().default("free"),
    tierExpiresAt: timestamp("tier_expires_at", { withTimezone: true }),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),

    // v3 §4: CashApp manual-activation tracking
    cashappUsername: text("cashapp_username"),
    cashappPaymentStatus: cashAppStatus("cashapp_payment_status"),
    cashappRequestedAt: timestamp("cashapp_requested_at", { withTimezone: true }),
    cashappActivatedAt: timestamp("cashapp_activated_at", { withTimezone: true }),
    cashappActivatedBy: text("cashapp_activated_by"),
    cashappRejectionReason: text("cashapp_rejection_reason"),

    // v3 §4: promo tracking. No FK yet — promos table lands in feat/track-e-promo-system.
    appliedPromoId: text("applied_promo_id"),

    // v3 §5: admin gate. Set true for ADMIN_EMAIL on first sign-in (see feat/track-e-better-auth-and-login).
    isAdmin: boolean("is_admin").notNull().default(false),

    // v3 §4: profile fields
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    part107CertNumber: text("part107_cert_number"),
    homeLocation: text("home_location"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Better Auth requires accounts even when no OAuth is configured (the magic-link plugin
// stores its provider rows here). v3 §1 explicitly forbids OAuth — we just don't write
// any accounts rows for OAuth providers, but the table must exist for Better Auth to start.
export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Magic-link tokens live here (15-min expiry per v3 §1).
export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
