PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone_number` text,
	`category` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
INSERT INTO `__new_contacts`("id", "name", "phone_number", "category", "notes", "created_at") SELECT "id", "name", "phone_number", "category", "notes", "created_at" FROM `contacts`;--> statement-breakpoint
DROP TABLE `contacts`;--> statement-breakpoint
ALTER TABLE `__new_contacts` RENAME TO `contacts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `contacts_phone_number_unique` ON `contacts` (`phone_number`);--> statement-breakpoint
CREATE INDEX `contacts_category_index` ON `contacts` (`category`);--> statement-breakpoint
CREATE INDEX `invoices_type_index` ON `invoices` (`type`);--> statement-breakpoint
CREATE INDEX `invoices_contact_type_index` ON `invoices` (`contact_id`,`type`);--> statement-breakpoint
CREATE INDEX `payments_type_index` ON `payments` (`type`);--> statement-breakpoint
CREATE INDEX `payments_contact_type_index` ON `payments` (`contact_id`,`type`);