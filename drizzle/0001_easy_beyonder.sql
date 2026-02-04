CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contact_id` integer,
	`amount` integer NOT NULL,
	`type` text NOT NULL,
	`notes` text,
	`media_uri` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
