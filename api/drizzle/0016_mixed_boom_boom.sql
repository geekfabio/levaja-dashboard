DO $$ BEGIN
 CREATE TYPE "angoleva"."referral_reward_kind" AS ENUM('invitee', 'inviter');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TYPE "angoleva"."wallet_transaction_type" ADD VALUE IF NOT EXISTS 'bonus';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."referral_rewards" (
	"id" text PRIMARY KEY NOT NULL,
	"client_account_id" text NOT NULL,
	"kind" "angoleva"."referral_reward_kind" NOT NULL,
	"source_account_id" text NOT NULL,
	"amount_kz" integer NOT NULL,
	"used_request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "angoleva"."clients" ADD COLUMN IF NOT EXISTS "referral_code" varchar(12);--> statement-breakpoint
ALTER TABLE "angoleva"."clients" ADD COLUMN IF NOT EXISTS "referred_by_account_id" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."referral_rewards" ADD CONSTRAINT "referral_rewards_client_account_id_clients_account_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "angoleva"."clients"("account_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referral_rewards_client_idx" ON "angoleva"."referral_rewards" USING btree ("client_account_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."clients" ADD CONSTRAINT "clients_referral_code_unique" UNIQUE("referral_code");
EXCEPTION
 WHEN duplicate_table THEN null;
 WHEN duplicate_object THEN null;
END $$;