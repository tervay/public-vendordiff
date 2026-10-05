CREATE TYPE "public"."webhook_type" AS ENUM('slack', 'discord', 'plaintext');--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "webhooks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"type" "webhook_type" NOT NULL,
	"url" text NOT NULL,
	"vendor_slugs" text[] NOT NULL,
	"event_types" "event_type"[] NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_event_id" integer NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"last_delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "webhooks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhooks_user_idx" ON "webhooks" USING btree ("user_id");