/**
 * Perhitungan uang.
 *
 * Harga tersimpan sebagai DECIMAL(12,2) dan diterima dari driver dalam bentuk
 * teks. Seluruh perhitungan dilakukan pada satuan terkecil berupa bilangan bulat
 * agar total tidak terpengaruh pembulatan bilangan desimal.
 *
 * Respons API tetap mengirim angka biasa, misalnya 15000.
 */

const SCALE = 2;
const FACTOR = 10 ** SCALE;

/** Mengubah nilai desimal menjadi satuan terkecil, misalnya "15000.00" menjadi 1500000. */
export function toMinorUnits(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Nilai uang tidak valid');
    return Math.round(value * FACTOR);
  }

  const text = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) {
    throw new TypeError(`Nilai uang tidak valid: ${value}`);
  }

  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace('-', '').split('.');
  const normalisedFraction = fraction.padEnd(SCALE, '0').slice(0, SCALE);

  // Digit di luar dua angka desimal dibulatkan, bukan dibuang begitu saja.
  const remainder = fraction.slice(SCALE);
  let minor = Number(whole) * FACTOR + Number(normalisedFraction || '0');
  if (remainder && Number(remainder[0]) >= 5) minor += 1;

  return negative ? -minor : minor;
}

/** Mengubah satuan terkecil kembali menjadi teks desimal untuk disimpan. */
export function toDecimalString(minorUnits) {
  const negative = minorUnits < 0;
  const absolute = Math.abs(Math.trunc(minorUnits));
  const whole = Math.trunc(absolute / FACTOR);
  const fraction = String(absolute % FACTOR).padStart(SCALE, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/** Mengubah nilai desimal menjadi angka biasa untuk respons API. */
export function toAmountNumber(value) {
  if (value === null || value === undefined) return null;
  return toMinorUnits(value) / FACTOR;
}

/** Menghitung subtotal dari harga satuan dan jumlah, dalam satuan terkecil. */
export function calculateSubtotalMinor(price, quantity) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new TypeError('Kuantitas harus bilangan bulat minimal 1');
  }
  return toMinorUnits(price) * quantity;
}

/** Menjumlahkan sekumpulan nilai dalam satuan terkecil. */
export function sumMinor(amounts) {
  return amounts.reduce((total, amount) => total + amount, 0);
}
