ALTER TABLE "angoleva"."crm_activities" ADD COLUMN "company_name" varchar(160) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "angoleva"."crm_activities" ADD COLUMN "contact_name" varchar(160);--> statement-breakpoint
ALTER TABLE "angoleva"."crm_activities" ADD COLUMN "check_in" jsonb;--> statement-breakpoint
ALTER TABLE "angoleva"."crm_documents" ADD COLUMN "uploaded_by" varchar(120) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "angoleva"."crm_documents" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "angoleva"."crm_tasks" ADD COLUMN "company_name" varchar(160);--> statement-breakpoint
ALTER TABLE "angoleva"."crm_tasks" ADD COLUMN "reminder_date" timestamp with time zone;