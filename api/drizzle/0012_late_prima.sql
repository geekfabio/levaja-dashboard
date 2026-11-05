CREATE TYPE "angoleva"."business_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "angoleva"."penalty_kind" AS ENUM('warning', 'fine', 'suspension');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."business_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"nif" varchar(20) NOT NULL,
	"sector" varchar(120) NOT NULL,
	"contact_name" varchar(160) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"email" varchar(254) NOT NULL,
	"status" "angoleva"."business_status" DEFAULT 'active' NOT NULL,
	"suspension_reason" text,
	"contract_starts_at" timestamp with time zone NOT NULL,
	"contract_ends_at" timestamp with time zone NOT NULL,
	"contract_discount_rate" numeric(5, 4) NOT NULL,
	"contract_payment_terms_days" integer NOT NULL,
	"contract_credit_limit_kz" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_accounts_nif_unique" UNIQUE("nif")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."business_members" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"client_account_id" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."business_statements" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"month" varchar(7) NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reference" varchar(120) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."penalties" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_account_id" text NOT NULL,
	"kind" "angoleva"."penalty_kind" NOT NULL,
	"reason" text NOT NULL,
	"amount_kz" integer,
	"days" integer,
	"until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_account_id" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_account_id" text,
	"revoke_reason" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."business_members" ADD CONSTRAINT "business_members_business_id_business_accounts_id_fk" FOREIGN KEY ("business_id") REFERENCES "angoleva"."business_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."business_members" ADD CONSTRAINT "business_members_client_account_id_clients_account_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "angoleva"."clients"("account_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."business_statements" ADD CONSTRAINT "business_statements_business_id_business_accounts_id_fk" FOREIGN KEY ("business_id") REFERENCES "angoleva"."business_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."penalties" ADD CONSTRAINT "penalties_provider_account_id_providers_account_id_fk" FOREIGN KEY ("provider_account_id") REFERENCES "angoleva"."providers"("account_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."penalties" ADD CONSTRAINT "penalties_created_by_account_id_accounts_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."penalties" ADD CONSTRAINT "penalties_revoked_by_account_id_accounts_id_fk" FOREIGN KEY ("revoked_by_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "business_members_business_idx" ON "angoleva"."business_members" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "business_members_client_unique" ON "angoleva"."business_members" USING btree ("client_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "business_statements_business_month_unique" ON "angoleva"."business_statements" USING btree ("business_id","month");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "penalties_provider_idx" ON "angoleva"."penalties" USING btree ("provider_account_id");
