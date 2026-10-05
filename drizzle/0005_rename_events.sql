ALTER TYPE "public"."event_type" ADD VALUE 'rename';--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "old_title" text;