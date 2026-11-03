CREATE TYPE "angoleva"."refund_source" AS ENUM('dispute', 'cancellation', 'manual');--> statement-breakpoint
CREATE TYPE "angoleva"."refund_status" AS ENUM('pending', 'approved', 'rejected', 'paid');--> statement-breakpoint
CREATE TYPE "angoleva"."dispute_category" AS ENUM('damage', 'payment', 'price', 'no_show', 'delay', 'conduct', 'other');--> statement-breakpoint
CREATE TYPE "angoleva"."dispute_outcome" AS ENUM('no_refund', 'refund_full', 'refund_partial');--> statement-breakpoint
CREATE TYPE "angoleva"."claim_kind" AS ENUM('cargo_damage', 'vehicle_damage', 'accident', 'theft', 'injury');--> statement-breakpoint
CREATE TYPE "angoleva"."claim_status" AS ENUM('reported', 'under_review', 'approved', 'rejected', 'paid');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."refunds" (
	"id" text PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"request_id" text NOT NULL,
	"amount_kz" integer NOT NULL,
	"reason" text NOT NULL,
	"source" "angoleva"."refund_source" NOT NULL,
	"charge_provider" boolean DEFAULT false NOT NULL,
	"status" "angoleva"."refund_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"requested_by_account_id" text NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by_account_id" text,
	"decision_reason" text,
	"paid_at" timestamp with time zone,
	"payment_reference" varchar(120),
	CONSTRAINT "refunds_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."disputes" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"reason" text NOT NULL,
	"category" "angoleva"."dispute_category",
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened_by_account_id" text,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_account_id" text,
	"resolution" text,
	"outcome" "angoleva"."dispute_outcome",
	"refund_id" text,
	CONSTRAINT "disputes_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."claims" (
	"id" text PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"request_id" text NOT NULL,
	"kind" "angoleva"."claim_kind" NOT NULL,
	"description" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reported_by_account_id" text NOT NULL,
	"estimated_amount_kz" integer NOT NULL,
	"status" "angoleva"."claim_status" DEFAULT 'reported' NOT NULL,
	"insurer" varchar(120),
	"policy_number" varchar(60),
	"approved_amount_kz" integer,
	"decision_reason" text,
	"decided_at" timestamp with time zone,
	"decided_by_account_id" text,
	"paid_at" timestamp with time zone,
	"payment_reference" varchar(120),
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"photo_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "claims_code_unique" UNIQUE("code")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."refunds" ADD CONSTRAINT "refunds_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "angoleva"."service_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."refunds" ADD CONSTRAINT "refunds_requested_by_account_id_accounts_id_fk" FOREIGN KEY ("requested_by_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."refunds" ADD CONSTRAINT "refunds_decided_by_account_id_accounts_id_fk" FOREIGN KEY ("decided_by_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."disputes" ADD CONSTRAINT "disputes_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "angoleva"."service_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."disputes" ADD CONSTRAINT "disputes_opened_by_account_id_accounts_id_fk" FOREIGN KEY ("opened_by_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."disputes" ADD CONSTRAINT "disputes_resolved_by_account_id_accounts_id_fk" FOREIGN KEY ("resolved_by_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."disputes" ADD CONSTRAINT "disputes_refund_id_refunds_id_fk" FOREIGN KEY ("refund_id") REFERENCES "angoleva"."refunds"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."claims" ADD CONSTRAINT "claims_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "angoleva"."service_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."claims" ADD CONSTRAINT "claims_reported_by_account_id_accounts_id_fk" FOREIGN KEY ("reported_by_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."claims" ADD CONSTRAINT "claims_decided_by_account_id_accounts_id_fk" FOREIGN KEY ("decided_by_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refunds_request_idx" ON "angoleva"."refunds" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refunds_status_idx" ON "angoleva"."refunds" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disputes_request_idx" ON "angoleva"."disputes" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "claims_request_idx" ON "angoleva"."claims" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "claims_status_idx" ON "angoleva"."claims" USING btree ("status");