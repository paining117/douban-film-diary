CREATE TABLE `film_records` (
	`user_id` text NOT NULL,
	`film_id` text NOT NULL,
	`watched` integer DEFAULT 0 NOT NULL,
	`wishlist` integer DEFAULT 0 NOT NULL,
	`watch_date` text DEFAULT '' NOT NULL,
	`rating` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `film_id`)
);
