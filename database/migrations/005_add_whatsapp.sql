-- Menambahkan nomor WhatsApp pada akun pengguna dan pada kantin.
-- Nomor disimpan dalam bentuk baku berawalan kode negara tanpa tanda tambah,
-- misalnya 6281234567890, agar dapat langsung dipakai pada tautan wa.me.

ALTER TABLE `users`
  ADD COLUMN `whatsapp` VARCHAR(20) NULL AFTER `profile_image`;

ALTER TABLE `canteens`
  ADD COLUMN `whatsapp` VARCHAR(20) NULL AFTER `image_url`;
