ALTER TYPE "public"."webhook_type" ADD VALUE 'json';--> statement-breakpoint
ALTER TABLE "webhooks" ADD COLUMN "json_version" integer;