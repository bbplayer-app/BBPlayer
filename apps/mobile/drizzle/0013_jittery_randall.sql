ALTER TABLE `playlist_tracks` ADD `sort_key` text NOT NULL DEFAULT '';--> statement-breakpoint
CREATE INDEX `playlist_tracks_sort_key_idx` ON `playlist_tracks` (`playlist_id`,`sort_key`);