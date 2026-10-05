CREATE TYPE "public"."stock_status" AS ENUM('in_stock', 'backorder', 'out_of_stock');--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE 'backorder';--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "stock" "stock_status";--> statement-breakpoint
ALTER TABLE "variants" ADD COLUMN "stock" "stock_status";--> statement-breakpoint
UPDATE "events" SET "stock" = CASE WHEN "available" THEN 'in_stock' ELSE 'out_of_stock' END::"stock_status";--> statement-breakpoint
UPDATE "variants" SET "stock" = CASE WHEN "available" THEN 'in_stock' ELSE 'out_of_stock' END::"stock_status";
