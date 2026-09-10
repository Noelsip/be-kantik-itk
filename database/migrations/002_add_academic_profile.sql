-- Menambahkan data akademik pembeli pada tabel `users`.
--
-- `affiliation` selalu terisi selama alamatnya dikenali, sedangkan fakultas dan
-- program studi hanya terisi untuk mahasiswa yang alamatnya berupa NIM.

ALTER TABLE `users`
  ADD COLUMN `affiliation`        VARCHAR(100) NULL AFTER `role`,
  ADD COLUMN `faculty`            VARCHAR(100) NULL AFTER `affiliation`,
  ADD COLUMN `study_program`      VARCHAR(100) NULL AFTER `faculty`,
  ADD COLUMN `study_program_code` CHAR(2)      NULL AFTER `study_program`;

-- Indeks dipakai untuk menyaring pengguna berdasarkan asal program studi.
CREATE INDEX `idx_users_study_program_code` ON `users` (`study_program_code`);
