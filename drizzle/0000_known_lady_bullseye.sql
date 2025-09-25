CREATE TABLE "site_stats" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"total_generations" integer DEFAULT 0,
	"daily_generations" integer DEFAULT 0,
	"last_reset_date" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
