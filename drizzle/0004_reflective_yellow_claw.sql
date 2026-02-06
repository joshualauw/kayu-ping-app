ALTER TABLE `invoices` ADD `code` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_code_unique` ON `invoices` (`code`);