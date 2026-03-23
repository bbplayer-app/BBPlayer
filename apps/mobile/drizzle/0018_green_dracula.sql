CREATE TABLE `play_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`track_id` integer NOT NULL,
	`start_time` integer NOT NULL,
	`duration_played` integer NOT NULL,
	`completed` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `play_history_track_idx` ON `play_history` (`track_id`);--> statement-breakpoint
CREATE INDEX `play_history_start_time_idx` ON `play_history` (`start_time`);
