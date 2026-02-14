CREATE TABLE `agent_outputs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`agent_id` text NOT NULL,
	`type` text NOT NULL,
	`content` text,
	`tool` text,
	`args` text,
	`success` integer,
	`duration` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agent_processes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_agent_outputs_agent` ON `agent_outputs` (`agent_id`);--> statement-breakpoint
CREATE TABLE `agent_processes` (
	`id` text PRIMARY KEY NOT NULL,
	`type_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`work_dir` text,
	`pid` integer,
	`exit_code` integer,
	`created_at` integer NOT NULL,
	`stopped_at` integer,
	`config` text
);
--> statement-breakpoint
CREATE INDEX `idx_agent_status` ON `agent_processes` (`status`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`model_provider` text,
	`model_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`is_archived` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `credentials` (
	`key` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`encrypted_value` text NOT NULL,
	`iv` text NOT NULL,
	`auth_tag` text NOT NULL,
	`provider` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `file_transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text,
	`agent_id` text,
	`filename` text NOT NULL,
	`file_path` text NOT NULL,
	`file_size` integer NOT NULL,
	`direction` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_file_conversation` ON `file_transfers` (`conversation_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text,
	`thinking` text,
	`tool_calls` text,
	`content_blocks` text,
	`attachments` text,
	`token_usage` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_messages_conversation` ON `messages` (`conversation_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `skill_activations` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`user_id` text DEFAULT 'default' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_skill_activations_conversation` ON `skill_activations` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `idx_skill_activations_skill` ON `skill_activations` (`skill_id`);--> statement-breakpoint
CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`source` text NOT NULL,
	`git_url` text,
	`git_dir` text,
	`file_path` text NOT NULL,
	`conversation_id` text,
	`user_id` text DEFAULT 'default' NOT NULL,
	`is_global` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_skills_user` ON `skills` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_skills_source` ON `skills` (`source`);