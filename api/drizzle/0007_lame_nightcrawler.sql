CREATE TYPE "angoleva"."admin_access_result" AS ENUM('success', 'wrong_code', 'two_factor_failed', 'inactive', 'logout', 'revoked');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."admin_access_log" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text,
	"email" varchar(254) NOT NULL,
	"user_name" varchar(160),
	"result" "angoleva"."admin_access_result" NOT NULL,
	"ip" "inet",
	"device" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "angoleva"."accounts" ADD COLUMN "two_factor_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."admin_access_log" ADD CONSTRAINT "admin_access_log_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_access_log_account_idx" ON "angoleva"."admin_access_log" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_access_log_at_idx" ON "angoleva"."admin_access_log" USING btree ("at");