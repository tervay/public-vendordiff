ALTER TABLE "events" ALTER COLUMN "stock" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "variants" ALTER COLUMN "stock" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "available";--> statement-breakpoint
ALTER TABLE "variants" DROP COLUMN "available";