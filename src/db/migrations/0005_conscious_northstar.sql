CREATE TYPE "public"."flight_request_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."flight_request_status" AS ENUM('open', 'claimed', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "group_flight_request_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_flight_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"requested_by_id" text NOT NULL,
	"assigned_to_id" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"mission_type" text NOT NULL,
	"location" text,
	"target_date" timestamp with time zone,
	"priority" "flight_request_priority" DEFAULT 'medium' NOT NULL,
	"status" "flight_request_status" DEFAULT 'open' NOT NULL,
	"claimed_by_id" text,
	"claimed_at" timestamp with time zone,
	"completed_mission_id" text,
	"bvc_episode" text,
	"wanderlearn_course_slug" text,
	"partner_institution" text,
	"academic_purpose" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "group_flight_request_comments" ADD CONSTRAINT "group_flight_request_comments_request_id_group_flight_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."group_flight_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_flight_request_comments" ADD CONSTRAINT "group_flight_request_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_flight_requests" ADD CONSTRAINT "group_flight_requests_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_flight_requests" ADD CONSTRAINT "group_flight_requests_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_flight_requests" ADD CONSTRAINT "group_flight_requests_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_flight_requests" ADD CONSTRAINT "group_flight_requests_claimed_by_id_users_id_fk" FOREIGN KEY ("claimed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_flight_requests" ADD CONSTRAINT "group_flight_requests_completed_mission_id_missions_id_fk" FOREIGN KEY ("completed_mission_id") REFERENCES "public"."missions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_flight_request_comments_req_idx" ON "group_flight_request_comments" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "group_flight_requests_group_idx" ON "group_flight_requests" USING btree ("group_id","status","created_at");--> statement-breakpoint
CREATE INDEX "group_flight_requests_claimed_idx" ON "group_flight_requests" USING btree ("claimed_by_id");