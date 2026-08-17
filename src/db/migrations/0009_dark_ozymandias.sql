CREATE TYPE "public"."aircraft_platform" AS ENUM('uas', 'manned');--> statement-breakpoint
ALTER TABLE "aircraft_profiles" ADD COLUMN "platform" "aircraft_platform" DEFAULT 'uas' NOT NULL;--> statement-breakpoint
ALTER TABLE "aircraft_profiles" ADD COLUMN "category_class" text;--> statement-breakpoint
ALTER TABLE "aircraft_profiles" ADD COLUMN "type_rating" text;--> statement-breakpoint
ALTER TABLE "aircraft_profiles" ADD COLUMN "custom_checklist" jsonb DEFAULT '[]'::jsonb NOT NULL;