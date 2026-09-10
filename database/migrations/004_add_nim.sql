-- Menambahkan kolom NIM pada tabel `users`.
-- Nilainya diambil dari bagian depan alamat email mahasiswa, dan dibiarkan
-- kosong untuk akun yang alamatnya tidak berbentuk NIM.

ALTER TABLE `users`
  ADD COLUMN `nim` VARCHAR(20) NULL AFTER `campus_id`;

CREATE INDEX `idx_users_nim` ON `users` (`nim`);
