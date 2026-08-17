CREATE TYPE "public"."aircraft_document_kind" AS ENUM('airworthiness_certificate', 'registration_federal', 'registration_state', 'radio_station_licence', 'operating_limitations', 'weight_and_balance', 'insurance', 'other');--> statement-breakpoint
CREATE TYPE "public"."credential_kind" AS ENUM('pilot_certificate', 'government_id', 'medical_certificate', 'basicmed_exam', 'basicmed_course', 'student_endorsement', 'flight_review', 'part_107_certificate', 'trust_certificate', 'other');--> statement-breakpoint
CREATE TABLE "aircraft_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"aircraft_id" text NOT NULL,
	"kind" "aircraft_document_kind" NOT NULL,
	"label" text,
	"reference_number" text,
	"on_board" boolean DEFAULT false NOT NULL,
	"issued_on" date,
	"expires_on" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pilot_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" "credential_kind" NOT NULL,
	"label" text,
	"reference_number" text,
	"issued_on" date,
	"expires_on" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aircraft_documents" ADD CONSTRAINT "aircraft_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_documents" ADD CONSTRAINT "aircraft_documents_aircraft_id_aircraft_profiles_id_fk" FOREIGN KEY ("aircraft_id") REFERENCES "public"."aircraft_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilot_credentials" ADD CONSTRAINT "pilot_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aircraft_documents_user_idx" ON "aircraft_documents" USING btree ("user_id","expires_on");--> statement-breakpoint
CREATE INDEX "aircraft_documents_aircraft_idx" ON "aircraft_documents" USING btree ("aircraft_id");--> statement-breakpoint
CREATE INDEX "pilot_credentials_user_idx" ON "pilot_credentials" USING btree ("user_id","expires_on");