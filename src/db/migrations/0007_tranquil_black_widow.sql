CREATE TABLE "group_meetups" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"created_by_id" text,
	"title" text NOT NULL,
	"description" text,
	"location_name" text,
	"status" text DEFAULT 'proposing' NOT NULL,
	"finalized_start" timestamp with time zone,
	"finalized_end" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetup_responses" (
	"id" text PRIMARY KEY NOT NULL,
	"option_id" text NOT NULL,
	"user_id" text NOT NULL,
	"response" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetup_time_options" (
	"id" text PRIMARY KEY NOT NULL,
	"meetup_id" text NOT NULL,
	"proposed_by_id" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "group_meetups" ADD CONSTRAINT "group_meetups_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_meetups" ADD CONSTRAINT "group_meetups_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetup_responses" ADD CONSTRAINT "meetup_responses_option_id_meetup_time_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."meetup_time_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetup_responses" ADD CONSTRAINT "meetup_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetup_time_options" ADD CONSTRAINT "meetup_time_options_meetup_id_group_meetups_id_fk" FOREIGN KEY ("meetup_id") REFERENCES "public"."group_meetups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetup_time_options" ADD CONSTRAINT "meetup_time_options_proposed_by_id_users_id_fk" FOREIGN KEY ("proposed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_meetups_group_idx" ON "group_meetups" USING btree ("group_id","created_at");--> statement-breakpoint
CREATE INDEX "group_meetups_reminder_idx" ON "group_meetups" USING btree ("status","finalized_start");--> statement-breakpoint
CREATE UNIQUE INDEX "meetup_responses_option_user_unique" ON "meetup_responses" USING btree ("option_id","user_id");--> statement-breakpoint
CREATE INDEX "meetup_time_options_meetup_idx" ON "meetup_time_options" USING btree ("meetup_id");