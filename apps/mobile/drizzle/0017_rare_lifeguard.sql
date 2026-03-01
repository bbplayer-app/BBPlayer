CREATE INDEX `playlist_sync_queue_status_idx` ON `playlist_sync_queue` (`status`);--> statement-breakpoint
CREATE INDEX `playlist_sync_queue_playlist_id_idx` ON `playlist_sync_queue` (`playlist_id`);--> statement-breakpoint
CREATE INDEX `playlists_share_id_idx` ON `playlists` (`share_id`);