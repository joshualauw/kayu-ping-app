ALTER TABLE `transactions` RENAME TO `invoices`;--> statement-breakpoint
CREATE TABLE `payment_allocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`payment_id` integer,
	`invoice_id` integer,
	`amount` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`payment_date` text NOT NULL,
	`contact_id` integer,
	`amount` integer NOT NULL,
	`method` text NOT NULL,
	`type` text NOT NULL,
	`notes` text,
	`media_uri` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `invoices` ADD `entry_date` text NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_date` text NOT NULL,
	`contact_id` integer,
	`amount` integer NOT NULL,
	`type` text NOT NULL,
	`notes` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`media_uri` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_invoices`("id", "entry_date", "contact_id", "amount", "type", "notes", "status", "media_uri", "created_at") SELECT "id", "entry_date", "contact_id", "amount", "type", "notes", "status", "media_uri", "created_at" FROM `invoices`;--> statement-breakpoint
DROP TABLE `invoices`;--> statement-breakpoint
ALTER TABLE `__new_invoices` RENAME TO `invoices`;--> statement-breakpoint
PRAGMA foreign_keys=ON;