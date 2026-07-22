CREATE TABLE "experience_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"author_type" text NOT NULL,
	"author_label" text NOT NULL,
	"important" boolean DEFAULT false NOT NULL,
	"relevance_score" integer,
	"skill" text,
	"lifecycle_state" text DEFAULT 'active' NOT NULL,
	"lifecycle_reason" text,
	"superseded_by_report_id" integer,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
