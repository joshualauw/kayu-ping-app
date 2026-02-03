CREATE TABLE `contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone_number` text NOT NULL,
	`category` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
