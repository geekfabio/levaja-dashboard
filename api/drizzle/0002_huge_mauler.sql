CREATE TYPE "angoleva"."provider_account_status" AS ENUM('pending_approval', 'active', 'suspended');--> statement-breakpoint
ALTER TABLE "angoleva"."clients" ADD COLUMN "blocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "angoleva"."clients" ADD COLUMN "blocked_reason" text;--> statement-breakpoint
ALTER TABLE "angoleva"."providers" ADD COLUMN "account_status" "angoleva"."provider_account_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "angoleva"."providers" ADD COLUMN "suspension_reason" text;