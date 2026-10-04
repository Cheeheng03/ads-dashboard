CREATE TABLE `meta_connections` (
	`owner` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`account_id` text NOT NULL,
	`api_version` text NOT NULL,
	`encrypted_credentials` text NOT NULL,
	`has_app_secret` integer DEFAULT 0 NOT NULL,
	`revision` text NOT NULL,
	`updated_at` text NOT NULL,
	`tested_at` text,
	`test_result` text
);
