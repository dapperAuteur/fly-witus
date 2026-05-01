CREATE TYPE "public"."mission_type" AS ENUM('recreational', 'bvc_primary_source', 'commercial', 'test_maintenance');--> statement-breakpoint
CREATE TABLE "flights" (
	"id" text PRIMARY KEY NOT NULL,
	"mission_id" text NOT NULL,
	"flight_number" integer NOT NULL,
	"takeoff_location" text,
	"landing_location" text,
	"launch_time" text,
	"landing_time" text,
	"elapsed_time" text,
	"battery_voltage" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mission_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"mission_id" text NOT NULL,
	"url" text NOT NULL,
	"caption" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "missions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mission_number" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"pilot_name" text,
	"location" text,
	"aircraft_type" text,
	"rp_cert" text,
	"profile_id" text,
	"mission_type" "mission_type" DEFAULT 'recreational' NOT NULL,
	"weather_temperature" text,
	"weather_wind" text,
	"weather_precipitation" text,
	"completed" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"laanc_authorization_number" text,
	"bvc_episode" text,
	"wanderlearn_course_slug" text,
	"partner_institution" text,
	"academic_purpose" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "flights" ADD CONSTRAINT "flights_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_photos" ADD CONSTRAINT "mission_photos_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flights_mission_idx" ON "flights" USING btree ("mission_id");--> statement-breakpoint
CREATE INDEX "mission_photos_mission_idx" ON "mission_photos" USING btree ("mission_id");--> statement-breakpoint
CREATE INDEX "missions_user_idx" ON "missions" USING btree ("user_id","timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "missions_user_number_unique" ON "missions" USING btree ("user_id","mission_number");