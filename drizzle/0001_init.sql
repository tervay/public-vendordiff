CREATE TYPE "public"."event_type" AS ENUM('new', 'removed', 'out_of_stock', 'restock', 'price_change');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('ok', 'failed', 'rejected');--> statement-breakpoint
CREATE TABLE "events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"variant_id" integer NOT NULL,
	"vendor_slug" text NOT NULL,
	"run_id" integer NOT NULL,
	"type" "event_type" NOT NULL,
	"old_price_cents" integer,
	"price_cents" integer NOT NULL,
	"available" boolean NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vendor_slug" text NOT NULL,
	"external_id" text NOT NULL,
	"handle" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"image_url" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vendor_slug" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"status" "run_status" NOT NULL,
	"baseline" boolean DEFAULT false NOT NULL,
	"variant_count" integer DEFAULT 0 NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "variants_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_id" integer NOT NULL,
	"vendor_slug" text NOT NULL,
	"external_id" text NOT NULL,
	"sku" text,
	"title" text NOT NULL,
	"price_cents" integer NOT NULL,
	"compare_at_cents" integer,
	"available" boolean NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"missing_count" integer DEFAULT 0 NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_vendor_id_idx" ON "events" USING btree ("vendor_slug","id");--> statement-breakpoint
CREATE INDEX "events_type_id_idx" ON "events" USING btree ("type","id");--> statement-breakpoint
CREATE INDEX "events_variant_id_idx" ON "events" USING btree ("variant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_vendor_external_idx" ON "products" USING btree ("vendor_slug","external_id");--> statement-breakpoint
CREATE INDEX "products_vendor_handle_idx" ON "products" USING btree ("vendor_slug","handle");--> statement-breakpoint
CREATE INDEX "products_title_trgm_idx" ON "products" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "runs_vendor_started_idx" ON "runs" USING btree ("vendor_slug","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "variants_vendor_external_idx" ON "variants" USING btree ("vendor_slug","external_id");--> statement-breakpoint
CREATE INDEX "variants_product_idx" ON "variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "variants_sku_trgm_idx" ON "variants" USING gin ("sku" gin_trgm_ops);