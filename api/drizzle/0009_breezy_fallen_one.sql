CREATE TYPE "angoleva"."sos_alert_status" AS ENUM('open', 'acknowledged', 'resolved');--> statement-breakpoint
CREATE TYPE "angoleva"."ticket_message_author" AS ENUM('client', 'provider', 'admin');--> statement-breakpoint
CREATE TYPE "angoleva"."ticket_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "angoleva"."ticket_status" AS ENUM('open', 'in_progress', 'resolved');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."review_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"note" text NOT NULL,
	"handled_by_account_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."support_ticket_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"author" "angoleva"."ticket_message_author" NOT NULL,
	"author_name" varchar(160) NOT NULL,
	"body" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "angoleva"."sos_alerts" ADD COLUMN "area" varchar(160);--> statement-breakpoint
ALTER TABLE "angoleva"."sos_alerts" ADD COLUMN "message" text;--> statement-breakpoint
ALTER TABLE "angoleva"."sos_alerts" ADD COLUMN "status" "angoleva"."sos_alert_status" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "angoleva"."sos_alerts" ADD COLUMN "acknowledged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "angoleva"."sos_alerts" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "angoleva"."sos_alerts" ADD COLUMN "resolution" text;--> statement-breakpoint
ALTER TABLE "angoleva"."sos_alerts" ADD COLUMN "handled_by_account_id" text;--> statement-breakpoint
ALTER TABLE "angoleva"."support_tickets" ADD COLUMN "subject" varchar(160);--> statement-breakpoint
ALTER TABLE "angoleva"."support_tickets" ADD COLUMN "status" "angoleva"."ticket_status" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "angoleva"."support_tickets" ADD COLUMN "priority" "angoleva"."ticket_priority" DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "angoleva"."support_tickets" ADD COLUMN "assignee_account_id" text;--> statement-breakpoint
ALTER TABLE "angoleva"."support_tickets" ADD COLUMN "resolution" text;--> statement-breakpoint
ALTER TABLE "angoleva"."support_tickets" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "angoleva"."support_tickets" ADD COLUMN "satisfaction_score" integer;--> statement-breakpoint
ALTER TABLE "angoleva"."support_tickets" ADD COLUMN "satisfaction_comment" text;--> statement-breakpoint
ALTER TABLE "angoleva"."support_tickets" ADD COLUMN "satisfaction_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "angoleva"."support_tickets" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."review_notes" ADD CONSTRAINT "review_notes_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "angoleva"."service_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."review_notes" ADD CONSTRAINT "review_notes_handled_by_account_id_accounts_id_fk" FOREIGN KEY ("handled_by_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "angoleva"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."sos_alerts" ADD CONSTRAINT "sos_alerts_handled_by_account_id_accounts_id_fk" FOREIGN KEY ("handled_by_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."support_tickets" ADD CONSTRAINT "support_tickets_assignee_account_id_accounts_id_fk" FOREIGN KEY ("assignee_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_ticket_messages_ticket_idx" ON "angoleva"."support_ticket_messages" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_tickets_status_idx" ON "angoleva"."support_tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_tickets_assignee_idx" ON "angoleva"."support_tickets" USING btree ("assignee_account_id");
