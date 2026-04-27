CREATE TABLE `track_llm_tags` (
	`track_id` integer PRIMARY KEY NOT NULL,
	`tags` text NOT NULL,
	`confidence` real DEFAULT 0 NOT NULL,
	`reason` text,
	`model` text NOT NULL,
	`source_type` text,
	`source_id` text,
	`source_synced_at` integer,
	`indexed_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `track_llm_tags_source_idx` ON `track_llm_tags` (`source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `track_llm_tags_indexed_at_idx` ON `track_llm_tags` (`indexed_at`);
