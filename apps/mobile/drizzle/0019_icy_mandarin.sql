CREATE TABLE `dynamic_playlist_sources` (
	`playlist_id` integer NOT NULL,
	`source_playlist_id` integer NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`playlist_id`, `source_playlist_id`),
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dynamic_playlist_sources_playlist_idx` ON `dynamic_playlist_sources` (`playlist_id`);--> statement-breakpoint
CREATE INDEX `dynamic_playlist_sources_source_idx` ON `dynamic_playlist_sources` (`source_playlist_id`);