CREATE TABLE `performance` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`company_id` text NOT NULL,
	`account_id` text NOT NULL,
	`ad_id` text NOT NULL,
	`ad_name` text NOT NULL,
	`date` text NOT NULL,
	`currency` text NOT NULL,
	`attribution` text NOT NULL,
	`source` text NOT NULL,
	`imported_at` text NOT NULL,
	`spend` real,
	`impressions` real,
	`reach` real,
	`clicks` real,
	`link_clicks` real,
	`landing_page_views` real,
	`add_to_cart` real,
	`checkouts` real,
	`purchases` real,
	`revenue` real,
	`leads` real,
	`video_plays` real
);
--> statement-breakpoint
CREATE INDEX `performance_owner_company` ON `performance` (`owner`,`company_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `performance_daily_scope` ON `performance` (`owner`,`account_id`,`ad_id`,`date`,`currency`,`attribution`);