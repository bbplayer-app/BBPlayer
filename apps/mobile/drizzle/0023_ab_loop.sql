CREATE TABLE `ab_loops` (
	`track_id` integer PRIMARY KEY NOT NULL,
	`start_point` real NOT NULL,
	`end_point` real NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ab_loop_range_check" CHECK(end_point > start_point)
);
