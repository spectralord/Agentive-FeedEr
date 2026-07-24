CREATE TABLE "topic_clusters" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_matched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reels" ADD COLUMN "is_primary" boolean;--> statement-breakpoint
ALTER TABLE "reels" ADD CONSTRAINT "reels_topic_cluster_id_topic_clusters_id_fk" FOREIGN KEY ("topic_cluster_id") REFERENCES "public"."topic_clusters"("id") ON DELETE no action ON UPDATE no action;