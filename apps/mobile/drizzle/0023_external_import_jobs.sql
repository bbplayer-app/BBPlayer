CREATE TABLE `external_import_items` (
	`item_id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`original_index` integer NOT NULL,
	`original_track` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`matched_video` text,
	`error_type` text,
	`error_message` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `external_import_jobs`(`job_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `external_import_items_job_idx` ON `external_import_items` (`job_id`);--> statement-breakpoint
CREATE INDEX `external_import_items_job_index_idx` ON `external_import_items` (`job_id`,`original_index`);--> statement-breakpoint
CREATE INDEX `external_import_items_job_fingerprint_idx` ON `external_import_items` (`job_id`,`fingerprint`);--> statement-breakpoint
CREATE TABLE `external_import_jobs` (
	`job_id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`source_playlist_id` text NOT NULL,
	`playlist_metadata` text NOT NULL,
	`total_count` integer DEFAULT 0 NOT NULL,
	`processed_count` integer DEFAULT 0 NOT NULL,
	`matched_count` integer DEFAULT 0 NOT NULL,
	`unmatched_count` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`saved_playlist_id` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_processed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `external_import_jobs_source_playlist_unq` ON `external_import_jobs` (`source`,`source_playlist_id`);--> statement-breakpoint
CREATE INDEX `external_import_jobs_status_idx` ON `external_import_jobs` (`status`);--> statement-breakpoint
CREATE TABLE `external_track_mappings` (
	`track_id` integer PRIMARY KEY NOT NULL,
	`playlist_id` integer NOT NULL,
	`job_id` text,
	`item_id` text,
	`source` text NOT NULL,
	`source_playlist_id` text NOT NULL,
	`source_track_id` text,
	`original_index` integer DEFAULT 0 NOT NULL,
	`track_fingerprint` text NOT NULL,
	`original_title` text NOT NULL,
	`original_translated_title` text,
	`original_artists_json` text NOT NULL,
	`original_album` text NOT NULL,
	`original_duration` integer DEFAULT 0 NOT NULL,
	`original_cover_url` text,
	`match_status` text DEFAULT 'pending' NOT NULL,
	`matched_bvid` text,
	`matched_cid` integer,
	`matched_title` text,
	`matched_author` text,
	`matched_mid` integer,
	`matched_pic` text,
	`matched_duration` text,
	`matched_video_json` text,
	`error_type` text,
	`error_message` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `external_track_mappings_playlist_idx` ON `external_track_mappings` (`playlist_id`);--> statement-breakpoint
CREATE INDEX `external_track_mappings_status_idx` ON `external_track_mappings` (`playlist_id`,`match_status`);