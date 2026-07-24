CREATE TABLE "user_progress" (
	"skill_node_id" integer PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'seen' NOT NULL,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_progress_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"skill_node_id" integer NOT NULL,
	"status" text NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_skill_node_id_skill_nodes_id_fk" FOREIGN KEY ("skill_node_id") REFERENCES "public"."skill_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress_notes" ADD CONSTRAINT "user_progress_notes_skill_node_id_skill_nodes_id_fk" FOREIGN KEY ("skill_node_id") REFERENCES "public"."skill_nodes"("id") ON DELETE no action ON UPDATE no action;