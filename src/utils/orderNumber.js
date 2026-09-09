import { randomInt } from 'node:crypto';

/**
 * Pembuatan nomor pesanan dengan format ORD-YYYYMMDD-XXXX.
 *
 * Empat digit terakhir diacak agar nomor tidak mudah ditebak berurutan.
 * Keunikan nomor tetap dijamin oleh batasan unik pada kolom `order_number`.
 */
export function generateOrderNumber(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const suffix = String(randomInt(0, 10000)).padStart(4, '0');
  return `ORD-${year}${month}${day}-${suffix}`;
}

export default generateOrderNumber;
