CREATE TABLE `playlist_sync_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`playlist_id` integer NOT NULL,
	`operation` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_attempt_at` integer,
	`failure_reason` text,
	`operation_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `playlists` ADD `share_id` text;--> statement-breakpoint
ALTER TABLE `playlists` ADD `share_role` text;--> statement-breakpoint
ALTER TABLE `playlists` ADD `last_share_sync_at` integer;