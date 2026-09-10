-- Skema awal database Kantin ITK untuk MySQL 8.0 ke atas.
-- Disusun dari db.sql dan ERD proyek ini. Rincian penyesuaiannya tercatat pada
-- README bagian "Keputusan Skema Database".

CREATE TABLE IF NOT EXISTS `users` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `google_id`     VARCHAR(64)     NULL,
  `campus_id`     VARCHAR(50)     NOT NULL,
  `name`          VARCHAR(100)    NOT NULL,
  `email`         VARCHAR(150)    NOT NULL,
  -- Berkas db.sql awal memberi nama nilai ini 'mahasiswa', sementara dokumen
  -- kebutuhan menyebut peran pembeli sebagai 'pembeli'. Nilai 'pembeli' yang
  -- dipakai di seluruh aplikasi.
  `role`          ENUM('pembeli','penjual') NOT NULL DEFAULT 'pembeli',
  `profile_image` VARCHAR(255)    NULL,
  `token_version` INT UNSIGNED    NOT NULL DEFAULT 0,
  `created_at`    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email`     (`email`),
  UNIQUE KEY `uq_users_campus_id` (`campus_id`),
  UNIQUE KEY `uq_users_google_id` (`google_id`),
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `canteens` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `owner_id`    BIGINT UNSIGNED NOT NULL,
  `name`        VARCHAR(100)    NOT NULL,
  `description` TEXT            NULL,
  `location`    VARCHAR(255)    NULL,
  `image_url`   VARCHAR(255)    NULL,
  `is_open`     BOOLEAN         NOT NULL DEFAULT TRUE,
  `created_at`  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_canteens_owner_id` (`owner_id`),
  KEY `idx_canteens_is_open`  (`is_open`),
  CONSTRAINT `fk_canteens_owner`
    FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `categories` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(100)    NOT NULL,
  `created_at` TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categories_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `menu_items` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `canteen_id`   BIGINT UNSIGNED NOT NULL,
  `category_id`  BIGINT UNSIGNED NULL,
  `name`         VARCHAR(150)    NOT NULL,
  `description`  TEXT            NULL,
  `price`        DECIMAL(12,2)   NOT NULL,
  `image_url`    VARCHAR(255)    NULL,
  `is_available` BOOLEAN         NOT NULL DEFAULT TRUE,
  `deleted_at`   TIMESTAMP       NULL DEFAULT NULL,
  `created_at`   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_menu_items_canteen`   (`canteen_id`, `deleted_at`),
  KEY `idx_menu_items_category`  (`category_id`),
  KEY `idx_menu_items_available` (`is_available`),
  KEY `idx_menu_items_name`      (`name`),
  CONSTRAINT `chk_menu_items_price` CHECK (`price` >= 0),
  CONSTRAINT `fk_menu_items_canteen`
    FOREIGN KEY (`canteen_id`) REFERENCES `canteens` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_items_category`
    FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `carts` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_carts_user_id` (`user_id`),
  CONSTRAINT `fk_carts_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cart_items` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `cart_id`      BIGINT UNSIGNED NOT NULL,
  `menu_item_id` BIGINT UNSIGNED NOT NULL,
  `quantity`     INT UNSIGNED    NOT NULL,
  `created_at`   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  -- Satu baris untuk tiap menu dalam sebuah keranjang, sehingga penambahan menu
  -- yang sama hanya menambah jumlahnya.
  UNIQUE KEY `uq_cart_items_cart_menu` (`cart_id`, `menu_item_id`),
  KEY `idx_cart_items_menu_item` (`menu_item_id`),
  CONSTRAINT `chk_cart_items_quantity` CHECK (`quantity` >= 1),
  CONSTRAINT `fk_cart_items_cart`
    FOREIGN KEY (`cart_id`) REFERENCES `carts` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cart_items_menu_item`
    FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `orders` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`       BIGINT UNSIGNED NOT NULL,
  `canteen_id`    BIGINT UNSIGNED NOT NULL,
  `order_number`  VARCHAR(30)     NOT NULL,
  `status`        ENUM('menunggu_konfirmasi','diterima','ditolak','diproses','siap_diambil','selesai','dibatalkan')
                  NOT NULL DEFAULT 'menunggu_konfirmasi',
  `note`          TEXT            NULL,
  `reject_reason` VARCHAR(255)    NULL,
  `total_amount`  DECIMAL(12,2)   NOT NULL,
  `created_at`    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_orders_order_number` (`order_number`),
  KEY `idx_orders_user_status`    (`user_id`, `status`),
  KEY `idx_orders_canteen_status` (`canteen_id`, `status`),
  KEY `idx_orders_created_at`     (`created_at`),
  CONSTRAINT `chk_orders_total_amount` CHECK (`total_amount` >= 0),
  -- RESTRICT dipilih agar riwayat pesanan tidak ikut hilang ketika data pengguna
  -- atau kantin dihapus.
  CONSTRAINT `fk_orders_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_orders_canteen`
    FOREIGN KEY (`canteen_id`) REFERENCES `canteens` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `order_items` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id`     BIGINT UNSIGNED NOT NULL,
  `menu_item_id` BIGINT UNSIGNED NOT NULL,
  `menu_name`    VARCHAR(150)    NOT NULL,
  `price`        DECIMAL(12,2)   NOT NULL,
  `quantity`     INT UNSIGNED    NOT NULL,
  `subtotal`     DECIMAL(12,2)   NOT NULL,
  `created_at`   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_items_order`     (`order_id`),
  KEY `idx_order_items_menu_item` (`menu_item_id`),
  CONSTRAINT `chk_order_items_quantity` CHECK (`quantity` >= 1),
  CONSTRAINT `chk_order_items_price`    CHECK (`price` >= 0),
  CONSTRAINT `fk_order_items_order`
    FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  -- RESTRICT membuat baris menu yang dirujuk riwayat tidak dapat dihapus permanen.
  -- Penghapusan menu oleh penjual dilakukan lewat penandaan `menu_items.deleted_at`.
  CONSTRAINT `fk_order_items_menu_item`
    FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
