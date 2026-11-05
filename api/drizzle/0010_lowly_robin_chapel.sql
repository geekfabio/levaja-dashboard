CREATE TYPE "angoleva"."broadcast_audience_kind" AS ENUM('clients', 'providers');--> statement-breakpoint
CREATE TYPE "angoleva"."broadcast_audience_segment" AS ENUM('all', 'inactive_30', 'new_30', 'online', 'business');--> statement-breakpoint
CREATE TYPE "angoleva"."broadcast_channel" AS ENUM('push', 'sms', 'email');--> statement-breakpoint
CREATE TYPE "angoleva"."broadcast_status" AS ENUM('draft', 'scheduled', 'sent', 'cancelled');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."admin_api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"prefix" varchar(20) NOT NULL,
	"secret_hash" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_account_id" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by_account_id" text,
	"revoke_reason" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."admin_webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"webhook_id" text NOT NULL,
	"event" varchar(80) NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" varchar(10) NOT NULL,
	"duration_ms" integer NOT NULL,
	"simulated" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."admin_webhooks" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"description" varchar(240) DEFAULT '' NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"secret_hash" text NOT NULL,
	"secret_preview" varchar(60) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_account_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."broadcasts" (
	"id" text PRIMARY KEY NOT NULL,
	"title" varchar(160) NOT NULL,
	"channel" "angoleva"."broadcast_channel" NOT NULL,
	"audience_kind" "angoleva"."broadcast_audience_kind" NOT NULL,
	"audience_segment" "angoleva"."broadcast_audience_segment" NOT NULL,
	"audience_zone_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subject" varchar(200),
	"message" text NOT NULL,
	"status" "angoleva"."broadcast_status" DEFAULT 'draft' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"recipients" integer,
	"delivered" integer,
	"failed" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_account_id" text NOT NULL,
	"cancel_reason" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."admin_api_keys" ADD CONSTRAINT "admin_api_keys_created_by_account_id_accounts_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."admin_api_keys" ADD CONSTRAINT "admin_api_keys_revoked_by_account_id_accounts_id_fk" FOREIGN KEY ("revoked_by_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."admin_webhook_deliveries" ADD CONSTRAINT "admin_webhook_deliveries_webhook_id_admin_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "angoleva"."admin_webhooks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."admin_webhooks" ADD CONSTRAINT "admin_webhooks_created_by_account_id_accounts_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."broadcasts" ADD CONSTRAINT "broadcasts_created_by_account_id_accounts_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_webhook_deliveries_webhook_idx" ON "angoleva"."admin_webhook_deliveries" USING btree ("webhook_id");
