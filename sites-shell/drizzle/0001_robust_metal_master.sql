CREATE TABLE `share_members` (
	`id` text PRIMARY KEY NOT NULL,
	`room_code` text NOT NULL,
	`member_id` text NOT NULL,
	`secret_hash` text NOT NULL,
	`nickname` text NOT NULL,
	`status` text NOT NULL,
	`is_host` integer DEFAULT false NOT NULL,
	`joined_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `share_rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_members_room_member_idx` ON `share_members` (`room_code`,`member_id`);--> statement-breakpoint
CREATE INDEX `share_members_room_idx` ON `share_members` (`room_code`);--> statement-breakpoint
CREATE INDEX `share_members_last_seen_idx` ON `share_members` (`last_seen_at`);--> statement-breakpoint
CREATE TABLE `share_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`window_started_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `share_rate_limits_expires_at_idx` ON `share_rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `share_rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`host_member_id` text NOT NULL,
	`approval_required` integer DEFAULT false NOT NULL,
	`max_members` integer NOT NULL,
	`file_recipients` text DEFAULT 'selected' NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `share_rooms_expires_at_idx` ON `share_rooms` (`expires_at`);--> statement-breakpoint
CREATE TABLE `share_signals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_code` text NOT NULL,
	`from_member_id` text NOT NULL,
	`to_member_id` text,
	`type` text NOT NULL,
	`payload_json` text NOT NULL,
	`nonce` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `share_rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_signals_nonce_idx` ON `share_signals` (`nonce`);--> statement-breakpoint
CREATE INDEX `share_signals_room_id_idx` ON `share_signals` (`room_code`,`id`);--> statement-breakpoint
CREATE INDEX `share_signals_expires_at_idx` ON `share_signals` (`expires_at`);