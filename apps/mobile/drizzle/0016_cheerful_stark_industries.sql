ALTER TABLE `playlist_sync_queue` DROP COLUMN `attempts`;--> statement-breakpoint
ALTER TABLE `playlist_sync_queue` DROP COLUMN `last_attempt_at`;--> statement-breakpoint
ALTER TABLE `playlist_sync_queue` DROP COLUMN `failure_reason`;