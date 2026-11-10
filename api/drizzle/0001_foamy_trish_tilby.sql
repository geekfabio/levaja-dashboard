ALTER TABLE "angoleva"."crm_companies" ADD COLUMN "open_deals" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "angoleva"."crm_companies" ADD COLUMN "pipeline_value_kz" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "angoleva"."crm_companies" ADD COLUMN "win_probability" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "angoleva"."crm_companies" ADD COLUMN "trend" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "angoleva"."crm_companies" ADD COLUMN "last_interaction" jsonb DEFAULT '{"date":"","label":""}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "angoleva"."crm_companies" ADD COLUMN "activity_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "angoleva"."crm_companies" ADD COLUMN "logo" text;--> statement-breakpoint
ALTER TABLE "angoleva"."crm_companies" ADD COLUMN "next_follow_up" jsonb;--> statement-breakpoint
ALTER TABLE "angoleva"."crm_companies" ADD COLUMN "profile" jsonb;--> statement-breakpoint
ALTER TABLE "angoleva"."crm_contacts" ADD COLUMN "company_name" varchar(160) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "angoleva"."crm_contacts" ADD COLUMN "preferred_language" varchar(40) DEFAULT 'Português' NOT NULL;--> statement-breakpoint
ALTER TABLE "angoleva"."crm_opportunities" ADD COLUMN "company_name" varchar(160) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "angoleva"."crm_opportunities" ADD COLUMN "products" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "angoleva"."crm_opportunities" ADD COLUMN "stage_history" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "angoleva"."crm_tickets" ADD COLUMN "company_name" varchar(160);--> statement-breakpoint
ALTER TABLE "angoleva"."crm_tickets" ADD COLUMN "contact_name" varchar(160);--> statement-breakpoint
ALTER TABLE "angoleva"."crm_tickets" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "angoleva"."crm_tickets" ADD COLUMN "origin" varchar(20) DEFAULT 'Manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "angoleva"."crm_tickets" ADD COLUMN "assignee" varchar(120);--> statement-breakpoint
ALTER TABLE "angoleva"."crm_tickets" ADD COLUMN "assignee_avatar" varchar(255);--> statement-breakpoint
ALTER TABLE "angoleva"."crm_tickets" ADD COLUMN "comments" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "angoleva"."crm_tickets" ADD COLUMN "timeline" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "angoleva"."crm_tickets" ADD COLUMN "first_response_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "angoleva"."crm_tickets" ADD COLUMN "resolved_at" timestamp with time zone;