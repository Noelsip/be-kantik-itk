-- Menambahkan riwayat notifikasi beserta daftar perangkat penerimanya.
--
-- Riwayat disimpan agar halaman notifikasi tetap terisi walau pesan push gagal
-- terkirim atau aplikasi sedang tertutup. Pengiriman push hanyalah pelengkap.

CREATE TABLE IF NOT EXISTS `notifications` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    BIGINT UNSIGNED NOT NULL,
  `type`       VARCHAR(50)     NOT NULL,
  `title`      VARCHAR(150)    NOT NULL,
  `body`       VARCHAR(500)    NOT NULL,
  `order_id`   BIGINT UNSIGNED NULL,
  `read_at`    TIMESTAMP       NULL DEFAULT NULL,
  `created_at` TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user_created` (`user_id`, `created_at`),
  KEY `idx_notifications_user_unread`  (`user_id`, `read_at`),
  CONSTRAINT `fk_notifications_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  -- Notifikasi ikut terhapus bila pesanannya dihapus, sementara pesanan sendiri
  -- dilindungi RESTRICT sehingga hal itu praktis tidak terjadi.
  CONSTRAINT `fk_notifications_order`
    FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `device_tokens` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    BIGINT UNSIGNED NOT NULL,
  `token`      VARCHAR(255)    NOT NULL,
  `platform`   ENUM('android','ios','web') NOT NULL DEFAULT 'android',
  `created_at` TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  -- Satu token hanya boleh dimiliki satu akun. Perangkat yang berpindah akun
  -- membuat tokennya berpindah pula, sehingga pesan tidak salah alamat.
  UNIQUE KEY `uq_device_tokens_token` (`token`),
  KEY `idx_device_tokens_user` (`user_id`),
  CONSTRAINT `fk_device_tokens_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
