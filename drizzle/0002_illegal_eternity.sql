CREATE TABLE `analysis_models` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`company_id` text NOT NULL,
	`model_json` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analysis_models_owner_company` ON `analysis_models` (`owner`,`company_id`);