CREATE TABLE `activity` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`message` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `activity_owner_date` ON `activity` (`owner`,`created_at`);--> statement-breakpoint
CREATE TABLE `ads` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`company_id` text NOT NULL,
	`library_id` text,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`format` text DEFAULT 'Image' NOT NULL,
	`status` text DEFAULT 'Unknown' NOT NULL,
	`start_date` text DEFAULT '' NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`landing_url` text DEFAULT '' NOT NULL,
	`image_url` text DEFAULT '' NOT NULL,
	`market` text DEFAULT 'MY' NOT NULL,
	`hook` text DEFAULT '' NOT NULL,
	`angle` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`hypothesis` text DEFAULT '' NOT NULL,
	`board` text DEFAULT '' NOT NULL,
	`pinned` integer DEFAULT 0 NOT NULL,
	`reach` integer,
	`spend` real,
	`currency` text DEFAULT 'MYR' NOT NULL,
	`metric_source` text DEFAULT '' NOT NULL,
	`frequency_low` real,
	`frequency_high` real,
	`cpm_low` real,
	`cpm_high` real,
	`first_seen` text NOT NULL,
	`last_seen` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ads_owner_company` ON `ads` (`owner`,`company_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ads_owner_library` ON `ads` (`owner`,`library_id`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`domain` text DEFAULT '' NOT NULL,
	`page_id` text DEFAULT '' NOT NULL,
	`market` text DEFAULT 'MY' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `companies_owner` ON `companies` (`owner`);--> statement-breakpoint
CREATE TABLE `observations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`ad_id` text NOT NULL,
	`status` text NOT NULL,
	`observed_at` text NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `observations_owner_ad` ON `observations` (`owner`,`ad_id`);