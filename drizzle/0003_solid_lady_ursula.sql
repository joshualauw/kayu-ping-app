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
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_invoices`("id", "entry_date", "contact_id", "amount", "type", "notes", "status", "media_uri", "created_at") SELECT "id", "entry_date", "contact_id", "amount", "type", "notes", "status", "media_uri", "created_at" FROM `invoices`;--> statement-breakpoint
DROP TABLE `invoices`;--> statement-breakpoint
ALTER TABLE `__new_invoices` RENAME TO `invoices`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_payment_allocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`payment_id` integer,
	`invoice_id` integer,
	`amount` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_payment_allocations`("id", "payment_id", "invoice_id", "amount", "created_at") SELECT "id", "payment_id", "invoice_id", "amount", "created_at" FROM `payment_allocations`;--> statement-breakpoint
DROP TABLE `payment_allocations`;--> statement-breakpoint
ALTER TABLE `__new_payment_allocations` RENAME TO `payment_allocations`;--> statement-breakpoint
CREATE TABLE `__new_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`payment_date` text NOT NULL,
	`contact_id` integer,
	`amount` integer NOT NULL,
	`method` text NOT NULL,
	`type` text NOT NULL,
	`notes` text,
	`media_uri` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_payments`("id", "payment_date", "contact_id", "amount", "method", "type", "notes", "media_uri", "created_at") SELECT "id", "payment_date", "contact_id", "amount", "method", "type", "notes", "media_uri", "created_at" FROM `payments`;--> statement-breakpoint
DROP TABLE `payments`;--> statement-breakpoint
ALTER TABLE `__new_payments` RENAME TO `payments`;--> statement-breakpoint
CREATE UNIQUE INDEX `contacts_phone_number_unique` ON `contacts` (`phone_number`);