-- Menambahkan catatan pada tiap baris menu, di samping catatan tingkat pesanan.
-- Catatan pada keranjang disalin ke baris pesanan saat pesanan dibuat, sehingga
-- riwayatnya tetap terbaca meski isi keranjang sudah berganti.

ALTER TABLE `cart_items`
  ADD COLUMN `note` VARCHAR(255) NULL AFTER `quantity`;

ALTER TABLE `order_items`
  ADD COLUMN `note` VARCHAR(255) NULL AFTER `quantity`;
