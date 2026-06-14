CREATE TABLE `app_settings` (
	`key` varchar(100) NOT NULL,
	`value` text NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `invite_codes` (
	`id` varchar(36) NOT NULL,
	`code` varchar(50) NOT NULL,
	`role` enum('admin','user') NOT NULL DEFAULT 'user',
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invite_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `invite_codes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` varchar(36) NOT NULL,
	`user_phone` varchar(20) NOT NULL,
	`session_id` varchar(36),
	`content` json NOT NULL,
	`pdf_status` enum('pending','generating','completed','failed') NOT NULL DEFAULT 'pending',
	`pdf_url` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`invite_code` varchar(50) NOT NULL,
	`role` enum('admin','user') NOT NULL DEFAULT 'user',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_phone_unique` UNIQUE(`phone`)
);
--> statement-breakpoint
ALTER TABLE `leads` ADD `user_phone` varchar(20);--> statement-breakpoint
ALTER TABLE `sessions` ADD `user_phone` varchar(20);--> statement-breakpoint
ALTER TABLE `invite_codes` ADD CONSTRAINT `invite_codes_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reports` ADD CONSTRAINT `reports_session_id_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `reports_phone_idx` ON `reports` (`user_phone`,`created_at`);