CREATE TABLE "actionable_completions" (
	"id" serial PRIMARY KEY NOT NULL,
	"reel_id" integer NOT NULL,
	"skill_node_id" integer NOT NULL,
	"action_text" text NOT NULL,
	"effort_tag" text,
	"note" text,
	"done_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "actionable_completions_reel_id_unique" UNIQUE("reel_id")
);
--> statement-breakpoint
ALTER TABLE "actionable_completions" ADD CONSTRAINT "actionable_completions_reel_id_reels_id_fk" FOREIGN KEY ("reel_id") REFERENCES "public"."reels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actionable_completions" ADD CONSTRAINT "actionable_completions_skill_node_id_skill_nodes_id_fk" FOREIGN KEY ("skill_node_id") REFERENCES "public"."skill_nodes"("id") ON DELETE no action ON UPDATE no action;