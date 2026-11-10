CREATE TYPE "angoleva"."negotiation_by" AS ENUM('client', 'provider');--> statement-breakpoint
CREATE TYPE "angoleva"."negotiation_status" AS ENUM('pending', 'accepted', 'declined', 'cancelled');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."request_negotiations" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"amount_kz" integer NOT NULL,
	"min_kz" integer NOT NULL,
	"max_kz" integer NOT NULL,
	"by" "angoleva"."negotiation_by" NOT NULL,
	"status" "angoleva"."negotiation_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."request_negotiations" ADD CONSTRAINT "request_negotiations_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "angoleva"."service_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."request_negotiations" ADD CONSTRAINT "request_negotiations_provider_account_id_accounts_id_fk" FOREIGN KEY ("provider_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "request_negotiations_request_idx" ON "angoleva"."request_negotiations" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "request_negotiations_provider_idx" ON "angoleva"."request_negotiations" USING btree ("provider_account_id");