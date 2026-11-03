CREATE TYPE "angoleva"."payout_batch_status" AS ENUM('draft', 'sent', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "angoleva"."settlement_method" AS ENUM('card', 'bank_reference');--> statement-breakpoint
CREATE TYPE "angoleva"."withdrawal_status" AS ENUM('pending', 'approved', 'rejected', 'paid');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."cash_deposits" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_account_id" text NOT NULL,
	"amount_kz" integer NOT NULL,
	"reference" text NOT NULL,
	"recorded_by_account_id" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."payout_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"status" "angoleva"."payout_batch_status" DEFAULT 'draft' NOT NULL,
	"total_kz" integer NOT NULL,
	"count" integer NOT NULL,
	"created_by_account_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"bank_reference" text,
	"cancel_reason" text,
	CONSTRAINT "payout_batches_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."settlement_records" (
	"id" text PRIMARY KEY NOT NULL,
	"day" varchar(10) NOT NULL,
	"method" "angoleva"."settlement_method" NOT NULL,
	"received" integer,
	"reference" text,
	"received_at" timestamp with time zone,
	"resolution" text,
	"resolved_by_account_id" text,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."withdrawals" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_account_id" text NOT NULL,
	"amount_kz" integer NOT NULL,
	"iban" varchar(40) NOT NULL,
	"status" "angoleva"."withdrawal_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by_account_id" text,
	"paid_at" timestamp with time zone,
	"payment_reference" text,
	"reason" text,
	"batch_id" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."cash_deposits" ADD CONSTRAINT "cash_deposits_provider_account_id_providers_account_id_fk" FOREIGN KEY ("provider_account_id") REFERENCES "angoleva"."providers"("account_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."cash_deposits" ADD CONSTRAINT "cash_deposits_recorded_by_account_id_accounts_id_fk" FOREIGN KEY ("recorded_by_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."payout_batches" ADD CONSTRAINT "payout_batches_created_by_account_id_accounts_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."settlement_records" ADD CONSTRAINT "settlement_records_resolved_by_account_id_accounts_id_fk" FOREIGN KEY ("resolved_by_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."withdrawals" ADD CONSTRAINT "withdrawals_provider_account_id_providers_account_id_fk" FOREIGN KEY ("provider_account_id") REFERENCES "angoleva"."providers"("account_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."withdrawals" ADD CONSTRAINT "withdrawals_decided_by_account_id_accounts_id_fk" FOREIGN KEY ("decided_by_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."withdrawals" ADD CONSTRAINT "withdrawals_batch_id_payout_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "angoleva"."payout_batches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cash_deposits_provider_idx" ON "angoleva"."cash_deposits" USING btree ("provider_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "settlement_records_day_idx" ON "angoleva"."settlement_records" USING btree ("day");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "withdrawals_provider_idx" ON "angoleva"."withdrawals" USING btree ("provider_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "withdrawals_batch_idx" ON "angoleva"."withdrawals" USING btree ("batch_id");