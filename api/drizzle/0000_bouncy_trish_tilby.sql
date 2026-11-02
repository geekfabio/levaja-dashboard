CREATE SCHEMA IF NOT EXISTS "angoleva";
--> statement-breakpoint
CREATE TYPE "angoleva"."account_kind" AS ENUM('client', 'provider', 'admin');--> statement-breakpoint
CREATE TYPE "angoleva"."admin_role" AS ENUM('admin', 'operations', 'support', 'finance');--> statement-breakpoint
CREATE TYPE "angoleva"."device_platform" AS ENUM('android', 'ios', 'web');--> statement-breakpoint
CREATE TYPE "angoleva"."otp_purpose" AS ENUM('register', 'recover', 'admin_login');--> statement-breakpoint
CREATE TYPE "angoleva"."document_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "angoleva"."payment_method" AS ENUM('bank_reference', 'card', 'cash');--> statement-breakpoint
CREATE TYPE "angoleva"."payment_status" AS ENUM('pending', 'confirmed', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "angoleva"."request_status" AS ENUM('searching', 'assigned', 'en_route', 'arrived', 'pickup_confirmed', 'in_transit', 'delivered', 'paid', 'rated', 'cancelled');--> statement-breakpoint
CREATE TYPE "angoleva"."service_type" AS ENUM('tow', 'cargo', 'small_move', 'house_move');--> statement-breakpoint
CREATE TYPE "angoleva"."wallet_transaction_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "angoleva"."wallet_transaction_type" AS ENUM('earning', 'withdrawal', 'adjustment');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "angoleva"."account_kind" NOT NULL,
	"email" varchar(254) NOT NULL,
	"phone" varchar(32),
	"password_hash" text,
	"full_name" varchar(160) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"admin_role" "angoleva"."admin_role",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."admin_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"csrf_secret" text NOT NULL,
	"ip" "inet",
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."devices" (
	"push_token" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"platform" "angoleva"."device_platform" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."otp_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text,
	"email" varchar(254) NOT NULL,
	"purpose" "angoleva"."otp_purpose" NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."refresh_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"replaced_by_token_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"sender" varchar(20) NOT NULL,
	"body" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."chat_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" varchar(20) DEFAULT 'service' NOT NULL,
	"request_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."client_addresses" (
	"id" text PRIMARY KEY NOT NULL,
	"client_account_id" text NOT NULL,
	"label" varchar(80) NOT NULL,
	"icon" varchar(20) NOT NULL,
	"place" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."client_payment_methods" (
	"id" text PRIMARY KEY NOT NULL,
	"client_account_id" text NOT NULL,
	"type" varchar(20) NOT NULL,
	"title" varchar(80) NOT NULL,
	"detail" varchar(80),
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."clients" (
	"account_id" text PRIMARY KEY NOT NULL,
	"rating" numeric(2, 1),
	"avatar_url" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."emergency_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"label" varchar(120) NOT NULL,
	"phone_number" varchar(32) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."help_articles" (
	"id" text PRIMARY KEY NOT NULL,
	"category" varchar(60) NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."payments" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"payment_method" "angoleva"."payment_method" NOT NULL,
	"status" "angoleva"."payment_status" DEFAULT 'pending' NOT NULL,
	"amount_kz" integer NOT NULL,
	"bank_reference" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."provider_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"full_name" varchar(160) NOT NULL,
	"email" varchar(254) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"service_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"zone_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"vehicle" jsonb,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reviewed_by_account_id" text,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"created_provider_account_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."provider_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_account_id" text NOT NULL,
	"title" varchar(120) NOT NULL,
	"kind" varchar(40) NOT NULL,
	"file_url" text,
	"valid_until" timestamp with time zone,
	"status" "angoleva"."document_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."providers" (
	"account_id" text PRIMARY KEY NOT NULL,
	"rating" numeric(2, 1),
	"reviews_count" integer DEFAULT 0 NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"avatar_url" text,
	"online" boolean DEFAULT false NOT NULL,
	"lat" numeric(9, 6),
	"lng" numeric(9, 6),
	"coverage_zone_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"coverage_service_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"declined_request_ids" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."service_request_events" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"status" "angoleva"."request_status" NOT NULL,
	"actor" varchar(20) NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."service_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"service_type" "angoleva"."service_type" NOT NULL,
	"status" "angoleva"."request_status" DEFAULT 'searching' NOT NULL,
	"client_account_id" text NOT NULL,
	"provider_account_id" text,
	"pickup" jsonb NOT NULL,
	"dropoff" jsonb,
	"stops" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"distance_km" numeric(7, 2),
	"duration_min" integer,
	"scheduled_for" timestamp with time zone,
	"tow_details" jsonb,
	"cargo_details" jsonb,
	"moving_details" jsonb,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pickup_photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"instructions" text,
	"pricing" jsonb,
	"provider_earning_kz" integer,
	"proposal" jsonb,
	"payment_method" "angoleva"."payment_method",
	"rating" integer,
	"review" text,
	"proof" jsonb,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_requests_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."sos_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text,
	"account_id" text NOT NULL,
	"lat" numeric(9, 6) NOT NULL,
	"lng" numeric(9, 6) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."support_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"request_id" text,
	"account_id" text NOT NULL,
	"reason" varchar(120) NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_tickets_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."vehicles" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_account_id" text NOT NULL,
	"brand" varchar(80) NOT NULL,
	"model" varchar(80) NOT NULL,
	"plate" varchar(20) NOT NULL,
	"color" varchar(40) NOT NULL,
	"vehicle_class" varchar(40) NOT NULL,
	"category_label" varchar(80) NOT NULL,
	"capacity_kg" integer,
	"year" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."wallet_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_account_id" text NOT NULL,
	"type" "angoleva"."wallet_transaction_type" NOT NULL,
	"title" varchar(160) NOT NULL,
	"amount_kz" integer NOT NULL,
	"status" "angoleva"."wallet_transaction_status" DEFAULT 'pending' NOT NULL,
	"service_type" "angoleva"."service_type",
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."wallets" (
	"provider_account_id" text PRIMARY KEY NOT NULL,
	"balance_kz" integer DEFAULT 0 NOT NULL,
	"payout_account" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."zones" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"lat" numeric(9, 6) NOT NULL,
	"lng" numeric(9, 6) NOT NULL,
	"radius_km" numeric(6, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."admin_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_account_id" text NOT NULL,
	"action" varchar(160) NOT NULL,
	"target_module" varchar(80),
	"target_id" text,
	"target_label" varchar(160),
	"reason" text,
	"changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sensitive" boolean DEFAULT false NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."platform_settings" (
	"key" varchar(120) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by_account_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."pricing_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"service_type" varchar(40) NOT NULL,
	"zone_id" text,
	"base_kz" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."crm_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text,
	"type" varchar(40) NOT NULL,
	"owner" varchar(120),
	"zone" varchar(80),
	"date" timestamp with time zone NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."crm_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_account_id" text,
	"action" varchar(200) NOT NULL,
	"target_module" varchar(80),
	"target_id" text,
	"target_label" varchar(160),
	"company_id" text,
	"sensitive" boolean DEFAULT false NOT NULL,
	"changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."crm_automations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"status" varchar(20) DEFAULT 'Rascunho' NOT NULL,
	"trigger" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enrolled" integer DEFAULT 0 NOT NULL,
	"completed" integer DEFAULT 0 NOT NULL,
	"activated_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."crm_campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"channel" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'Rascunho' NOT NULL,
	"template_id" varchar(80),
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"audience" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recipients" integer DEFAULT 0 NOT NULL,
	"scheduled_at" timestamp with time zone,
	"test_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."crm_companies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"zone" varchar(80),
	"owner" varchar(120),
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."crm_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"name" varchar(160) NOT NULL,
	"role" varchar(80),
	"phone" varchar(32),
	"whatsapp" varchar(32),
	"email" varchar(254),
	"contactability" varchar(20) DEFAULT 'Válido' NOT NULL,
	"consent" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."crm_conversation_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"direction" varchar(10) NOT NULL,
	"body" text NOT NULL,
	"author" varchar(120),
	"status" varchar(20),
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."crm_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"channel" varchar(20) NOT NULL,
	"unread" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."crm_discount_offers" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"percent" integer NOT NULL,
	"scope" varchar(40) NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'Por apresentar' NOT NULL,
	"origin" varchar(80),
	"owner" varchar(120),
	"automation_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."crm_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" varchar(60) NOT NULL,
	"mime" varchar(100) NOT NULL,
	"size" integer NOT NULL,
	"url" text,
	"removed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."crm_opportunities" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"contact_name" varchar(160),
	"stage" varchar(40) NOT NULL,
	"value_kz" integer DEFAULT 0 NOT NULL,
	"probability" integer DEFAULT 0 NOT NULL,
	"expected_close_date" timestamp with time zone,
	"owner" varchar(120),
	"loss_reason" varchar(160),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."crm_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text,
	"title" varchar(160) NOT NULL,
	"assignee" varchar(120),
	"due_date" timestamp with time zone,
	"status" varchar(20) DEFAULT 'Por Fazer' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "angoleva"."crm_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text,
	"subject" varchar(200) NOT NULL,
	"status" varchar(20) DEFAULT 'Aberto' NOT NULL,
	"priority" varchar(20),
	"owner" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."admin_sessions" ADD CONSTRAINT "admin_sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."devices" ADD CONSTRAINT "devices_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."otp_codes" ADD CONSTRAINT "otp_codes_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."chat_messages" ADD CONSTRAINT "chat_messages_thread_id_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "angoleva"."chat_threads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."chat_threads" ADD CONSTRAINT "chat_threads_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "angoleva"."service_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."client_addresses" ADD CONSTRAINT "client_addresses_client_account_id_clients_account_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "angoleva"."clients"("account_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."client_payment_methods" ADD CONSTRAINT "client_payment_methods_client_account_id_clients_account_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "angoleva"."clients"("account_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."clients" ADD CONSTRAINT "clients_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."payments" ADD CONSTRAINT "payments_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "angoleva"."service_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."provider_applications" ADD CONSTRAINT "provider_applications_reviewed_by_account_id_accounts_id_fk" FOREIGN KEY ("reviewed_by_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."provider_applications" ADD CONSTRAINT "provider_applications_created_provider_account_id_accounts_id_fk" FOREIGN KEY ("created_provider_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."provider_documents" ADD CONSTRAINT "provider_documents_provider_account_id_providers_account_id_fk" FOREIGN KEY ("provider_account_id") REFERENCES "angoleva"."providers"("account_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."providers" ADD CONSTRAINT "providers_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."service_request_events" ADD CONSTRAINT "service_request_events_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "angoleva"."service_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."service_requests" ADD CONSTRAINT "service_requests_client_account_id_clients_account_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "angoleva"."clients"("account_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."service_requests" ADD CONSTRAINT "service_requests_provider_account_id_providers_account_id_fk" FOREIGN KEY ("provider_account_id") REFERENCES "angoleva"."providers"("account_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."sos_alerts" ADD CONSTRAINT "sos_alerts_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "angoleva"."service_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."sos_alerts" ADD CONSTRAINT "sos_alerts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."support_tickets" ADD CONSTRAINT "support_tickets_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "angoleva"."service_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."support_tickets" ADD CONSTRAINT "support_tickets_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."vehicles" ADD CONSTRAINT "vehicles_provider_account_id_providers_account_id_fk" FOREIGN KEY ("provider_account_id") REFERENCES "angoleva"."providers"("account_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."wallet_transactions" ADD CONSTRAINT "wallet_transactions_provider_account_id_providers_account_id_fk" FOREIGN KEY ("provider_account_id") REFERENCES "angoleva"."providers"("account_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."wallets" ADD CONSTRAINT "wallets_provider_account_id_providers_account_id_fk" FOREIGN KEY ("provider_account_id") REFERENCES "angoleva"."providers"("account_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."admin_audit_log" ADD CONSTRAINT "admin_audit_log_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."platform_settings" ADD CONSTRAINT "platform_settings_updated_by_account_id_accounts_id_fk" FOREIGN KEY ("updated_by_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."crm_activities" ADD CONSTRAINT "crm_activities_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "angoleva"."crm_companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."crm_audit_log" ADD CONSTRAINT "crm_audit_log_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "angoleva"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."crm_contacts" ADD CONSTRAINT "crm_contacts_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "angoleva"."crm_companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."crm_conversation_messages" ADD CONSTRAINT "crm_conversation_messages_conversation_id_crm_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "angoleva"."crm_conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."crm_conversations" ADD CONSTRAINT "crm_conversations_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "angoleva"."crm_contacts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."crm_discount_offers" ADD CONSTRAINT "crm_discount_offers_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "angoleva"."crm_companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."crm_discount_offers" ADD CONSTRAINT "crm_discount_offers_automation_id_crm_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "angoleva"."crm_automations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."crm_documents" ADD CONSTRAINT "crm_documents_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "angoleva"."crm_companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."crm_opportunities" ADD CONSTRAINT "crm_opportunities_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "angoleva"."crm_companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."crm_tasks" ADD CONSTRAINT "crm_tasks_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "angoleva"."crm_companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "angoleva"."crm_tickets" ADD CONSTRAINT "crm_tickets_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "angoleva"."crm_companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_email_kind_unique" ON "angoleva"."accounts" USING btree ("email","kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_sessions_account_idx" ON "angoleva"."admin_sessions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "devices_account_idx" ON "angoleva"."devices" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "otp_codes_email_purpose_idx" ON "angoleva"."otp_codes" USING btree ("email","purpose");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refresh_tokens_account_idx" ON "angoleva"."refresh_tokens" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_thread_idx" ON "angoleva"."chat_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_request_idx" ON "angoleva"."payments" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_documents_provider_idx" ON "angoleva"."provider_documents" USING btree ("provider_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_request_events_request_idx" ON "angoleva"."service_request_events" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_requests_client_idx" ON "angoleva"."service_requests" USING btree ("client_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_requests_provider_idx" ON "angoleva"."service_requests" USING btree ("provider_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_requests_status_idx" ON "angoleva"."service_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_transactions_provider_idx" ON "angoleva"."wallet_transactions" USING btree ("provider_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_activities_company_idx" ON "angoleva"."crm_activities" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_contacts_company_idx" ON "angoleva"."crm_contacts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_conversation_messages_conversation_idx" ON "angoleva"."crm_conversation_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_opportunities_company_idx" ON "angoleva"."crm_opportunities" USING btree ("company_id");