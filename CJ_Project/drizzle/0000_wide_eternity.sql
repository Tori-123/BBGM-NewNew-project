CREATE TABLE `cj_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`week_start` text NOT NULL,
	`day_index` integer NOT NULL,
	`period` integer NOT NULL,
	`subject_id` text NOT NULL,
	`ic` text DEFAULT '' NOT NULL,
	`hw` text DEFAULT '' NOT NULL,
	`announcement` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_cj_entry_slot` ON `cj_entries` (`week_start`,`day_index`,`period`,`subject_id`);--> statement-breakpoint
CREATE INDEX `idx_cj_entries_week_day` ON `cj_entries` (`week_start`,`day_index`);--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`color` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_subjects_name` ON `subjects` (`name`);