-- Menambahkan daftar menu favorit milik pembeli.
-- Satu baris untuk tiap pasangan pengguna dan menu, dijaga oleh indeks unik
-- sehingga penandaan berulang tidak menghasilkan baris ganda.

CREATE TABLE IF NOT EXISTS `favorites` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`      BIGINT UNSIGNED NOT NULL,
  `menu_item_id` BIGINT UNSIGNED NOT NULL,
  `created_at`   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_favorites_user_menu` (`user_id`, `menu_item_id`),
  KEY `idx_favorites_menu_item` (`menu_item_id`),
  KEY `idx_favorites_user_created` (`user_id`, `created_at`),
  CONSTRAINT `fk_favorites_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  -- Menu yang dihapus permanen ikut membuang penandaan favoritnya. Penghapusan
  -- oleh penjual memakai penandaan `deleted_at`, sehingga baris favorit tetap
  -- ada namun disaring pada setiap pembacaan.
  CONSTRAINT `fk_favorites_menu_item`
    FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
