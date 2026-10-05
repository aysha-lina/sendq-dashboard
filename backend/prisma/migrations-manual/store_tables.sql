-- Store / e-commerce tables (Wave 5e). ADDITIVE ONLY — creates new sendq_* tables,
-- does not alter or touch any existing table. Safe to run against the shared DB.
-- Apply with: mysql ... < store_tables.sql   (or use `npm run prisma:push`).

CREATE TABLE IF NOT EXISTS `sendq_categories` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uid` CHAR(36) NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sendq_attributes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uid` CHAR(36) NULL,
  `category_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `status` VARCHAR(255) NULL,
  `description` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sendq_attributes_category_id_idx` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sendq_products` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uid` CHAR(36) NOT NULL,
  `customer_id` INT UNSIGNED NOT NULL,
  `source_id` INT UNSIGNED NULL,
  `title` VARCHAR(255) NULL,
  `description` MEDIUMTEXT NULL,
  `content` LONGTEXT NULL,
  `price` DECIMAL(16,2) NULL,
  `source_item_id` VARCHAR(255) NULL,
  `meta` LONGTEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sendq_products_customer_id_idx` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sendq_product_attributes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uid` CHAR(36) NULL,
  `product_id` INT UNSIGNED NOT NULL,
  `attribute_id` BIGINT UNSIGNED NOT NULL,
  `value` VARCHAR(255) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sendq_product_attributes_product_id_idx` (`product_id`),
  KEY `sendq_product_attributes_attribute_id_idx` (`attribute_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sendq_funnels` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uid` CHAR(36) NOT NULL,
  `customer_id` INT UNSIGNED NULL,
  `name` TEXT NULL,
  `message` TEXT NULL,
  `content` LONGTEXT NULL,
  `status` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sendq_orders` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uid` CHAR(36) NULL,
  `customer_id` INT UNSIGNED NULL,
  `source_id` INT UNSIGNED NULL,
  `name` TEXT NULL,
  `description` TEXT NULL,
  `content` LONGTEXT NULL,
  `price` VARCHAR(255) NULL,
  `meta` LONGTEXT NULL,
  `status` VARCHAR(255) NULL,
  `source_item_id` VARCHAR(255) NULL,
  `file` VARCHAR(255) NULL,
  `amount` INT NULL,
  `tax` INT NULL,
  `move` INT NULL,
  `total` INT NULL,
  `transport` INT NULL,
  `delivery` DATE NULL,
  `receive_name` VARCHAR(255) NULL,
  `receive_address` VARCHAR(255) NULL,
  `receive_phone` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sendq_orders_customer_id_idx` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sendq_media` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uid` CHAR(36) NULL,
  `customer_id` INT UNSIGNED NULL,
  `source` VARCHAR(255) NULL,
  `type` VARCHAR(255) NULL,
  `dir` VARCHAR(255) NULL,
  `ext` VARCHAR(255) NULL,
  `slug` VARCHAR(255) NULL,
  `thumes` VARCHAR(255) NULL,
  `status` VARCHAR(255) NULL,
  `author` VARCHAR(255) NULL,
  `caption` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sendq_media_customer_id_idx` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
