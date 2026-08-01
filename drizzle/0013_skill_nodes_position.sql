ALTER TABLE "skill_nodes" ADD COLUMN "position_x" real;--> statement-breakpoint
ALTER TABLE "skill_nodes" ADD COLUMN "position_y" real;--> statement-breakpoint
ALTER TABLE "skill_nodes" ADD COLUMN "position_locked" boolean DEFAULT false NOT NULL;