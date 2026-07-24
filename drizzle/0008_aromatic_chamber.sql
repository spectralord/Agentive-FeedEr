ALTER TABLE "topic_clusters" ADD COLUMN "confidence" text;--> statement-breakpoint
ALTER TABLE "topic_clusters" ADD COLUMN "independent_count" integer;--> statement-breakpoint
ALTER TABLE "topic_clusters" ADD COLUMN "lifecycle_state" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "topic_clusters" ADD COLUMN "superseded_by_cluster_id" integer;--> statement-breakpoint
ALTER TABLE "topic_clusters" ADD COLUMN "supersede_reason" text;--> statement-breakpoint
ALTER TABLE "topic_clusters" ADD COLUMN "knowledge_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "topic_clusters" ADD CONSTRAINT "topic_clusters_superseded_by_cluster_id_topic_clusters_id_fk" FOREIGN KEY ("superseded_by_cluster_id") REFERENCES "public"."topic_clusters"("id") ON DELETE no action ON UPDATE no action;