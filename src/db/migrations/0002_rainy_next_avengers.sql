CREATE TYPE "public"."discount_kind" AS ENUM('percent', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."promo_applies_to" AS ENUM('monthly', 'annual', 'both');--> statement-breakpoint
CREATE TYPE "public"."promo_type" AS ENUM('lifetime_reopen', 'discount', 'trial');--> statement-breakpoint
CREATE TABLE "lifetime_slot_counter" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"standard_slots_total" integer DEFAULT 100 NOT NULL,
	"standard_slots_used" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promos" (
	"id" text PRIMARY KEY NOT NULL,
	"app" text DEFAULT 'fly_witus' NOT NULL,
	"name" text NOT NULL,
	"type" "promo_type" NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"lifetime_price_card" real,
	"lifetime_price_cashapp" real,
	"lifetime_slots" integer,
	"lifetime_slots_used" integer DEFAULT 0 NOT NULL,
	"banner_text" text,
	"stripe_coupon_id" text,
	"discount_kind" "discount_kind",
	"discount_amount" real,
	"applies_to" "promo_applies_to",
	"promo_code" text,
	"max_redemptions" integer,
	"redemptions_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
ALTER TABLE "promos" ADD CONSTRAINT "promos_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "promos_app_active_idx" ON "promos" USING btree ("app","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "promos_code_unique" ON "promos" USING btree ("promo_code");