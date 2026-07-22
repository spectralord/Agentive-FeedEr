CREATE TABLE "reels" (
	"id" serial PRIMARY KEY NOT NULL,
	"raw_item_id" integer NOT NULL,
	"summary" text NOT NULL,
	"category" text NOT NULL,
	"maturity" text NOT NULL,
	"experimental" boolean DEFAULT false NOT NULL,
	"relevance_score" integer NOT NULL,
	"quality_score" integer NOT NULL,
	"example" text,
	"action" text,
	"effort_tag" text,
	"skill" text,
	"topic_cluster_id" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reels_raw_item_id_unique" UNIQUE("raw_item_id")
);
--> statement-breakpoint
ALTER TABLE "reels" ADD CONSTRAINT "reels_raw_item_id_raw_items_id_fk" FOREIGN KEY ("raw_item_id") REFERENCES "public"."raw_items"("id") ON DELETE no action ON UPDATE no action;