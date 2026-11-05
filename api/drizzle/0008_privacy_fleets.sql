DO $$ BEGIN
 CREATE TYPE "angoleva"."fleet_status" AS ENUM('active', 'suspended');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "angoleva"."privacy_subject_kind" AS ENUM('client', 'provider');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "angoleva"."privacy_request_kind" AS ENUM('access', 'rectification', 'erasure', 'portability', 'objection');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "angoleva"."privacy_request_channel" AS ENUM('app', 'email', 'phone');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "angoleva"."privacy_request_status" AS ENUM('received', 'in_progress', 'completed', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."fleets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"nif" varchar(20) NOT NULL,
	"contact_name" varchar(160) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"email" varchar(254) NOT NULL,
	"status" "angoleva"."fleet_status" DEFAULT 'active' NOT NULL,
	"suspension_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fleets_nif_unique" UNIQUE("nif")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."privacy_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"subject_kind" "angoleva"."privacy_subject_kind" NOT NULL,
	"subject_account_id" text NOT NULL,
	"subject_name" varchar(160) NOT NULL,
	"kind" "angoleva"."privacy_request_kind" NOT NULL,
	"channel" "angoleva"."privacy_request_channel" NOT NULL,
	"details" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"status" "angoleva"."privacy_request_status" DEFAULT 'received' NOT NULL,
	"assignee_account_id" text,
	"resolution" text,
	"completed_at" timestamp with time zone,
	CONSTRAINT "privacy_requests_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "angoleva"."providers" ADD COLUMN IF NOT EXISTS "fleet_id" text;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."providers" ADD CONSTRAINT "providers_fleet_id_fleets_id_fk" FOREIGN KEY ("fleet_id") REFERENCES "angoleva"."fleets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."privacy_requests" ADD CONSTRAINT "privacy_requests_subject_account_id_accounts_id_fk" FOREIGN KEY ("subject_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."privacy_requests" ADD CONSTRAINT "privacy_requests_assignee_account_id_accounts_id_fk" FOREIGN KEY ("assignee_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "privacy_requests_subject_idx" ON "angoleva"."privacy_requests" USING btree ("subject_account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "privacy_requests_status_idx" ON "angoleva"."privacy_requests" USING btree ("status");
