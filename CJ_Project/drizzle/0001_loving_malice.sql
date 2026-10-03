CREATE TABLE `exams` (
	`id` text PRIMARY KEY NOT NULL,
	`week_start` text NOT NULL,
	`day_index` integer NOT NULL,
	`title` text NOT NULL,
	`time` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_exams_week_day` ON `exams` (`week_start`,`day_index`);--> statement-breakpoint
ALTER TABLE `subjects` ADD `period` integer DEFAULT 1 NOT NULL;