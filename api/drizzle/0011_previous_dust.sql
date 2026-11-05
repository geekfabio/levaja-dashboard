CREATE TYPE "angoleva"."promotion_kind" AS ENUM('percent', 'fixed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."promotion_uses" (
	"id" text PRIMARY KEY NOT NULL,
	"promotion_id" text NOT NULL,
	"request_id" text NOT NULL,
	"client_account_id" text NOT NULL,
	"discount_kz" integer NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."promotions" (
	"id" text PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(160) NOT NULL,
	"kind" "angoleva"."promotion_kind" NOT NULL,
	"value" integer NOT NULL,
	"max_discount_kz" integer,
	"min_order_kz" integer DEFAULT 0 NOT NULL,
	"services" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"zone_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"budget_kz" integer NOT NULL,
	"per_client_limit" integer DEFAULT 1 NOT NULL,
	"first_order_only" boolean DEFAULT false NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"ended_at" timestamp with time zone,
	"created_by_account_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."promotion_uses" ADD CONSTRAINT "promotion_uses_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "angoleva"."promotions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."promotion_uses" ADD CONSTRAINT "promotion_uses_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "angoleva"."service_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."promotion_uses" ADD CONSTRAINT "promotion_uses_client_account_id_clients_account_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "angoleva"."clients"("account_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "promotion_uses_promotion_idx" ON "angoleva"."promotion_uses" USING btree ("promotion_id");