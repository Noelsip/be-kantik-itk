import { z } from 'zod';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../utils/pagination.js';

/**
 * Potongan aturan pemeriksaan yang dipakai berulang.
 *
 * Nilai pada query selalu berupa teks, sehingga setiap angka dan penanda benar
 * atau salah dikonversi di sini.
 */

/** Bilangan bulat positif untuk id data. */
export const idSchema = z.coerce
  .number({ message: 'ID harus berupa angka' })
  .int('ID harus bilangan bulat')
  .positive('ID harus lebih besar dari 0');

/** Aturan untuk parameter id pada alamat. */
export const idParamSchema = z.object({ id: idSchema });

/** Aturan halaman dan jumlah data per halaman. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

/** Penanda benar atau salah yang bersifat opsional pada query. */
export const optionalBooleanSchema = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1')
  .optional();

/**
 * Kata kunci pencarian.
 * Teks kosong diubah menjadi tidak terisi agar tidak menambah kondisi pencarian
 * yang tidak berguna pada kueri.
 */
export const searchSchema = z
  .string()
  .trim()
  .max(100, 'Kata kunci pencarian maksimal 100 karakter')
  .optional()
  .transform((value) => (value ? value : undefined));

/**
 * Alamat gambar yang diterima.
 * Dibatasi pada http dan https agar nilai tersimpan tidak dapat berubah menjadi
 * alamat yang menjalankan skrip pada aplikasi yang menampilkannya.
 */
export const imageUrlSchema = z
  .string()
  .trim()
  .max(255, 'URL gambar maksimal 255 karakter')
  .refine((value) => /^https?:\/\//i.test(value), 'URL gambar harus diawali http:// atau https://');

export const nullableImageUrlSchema = imageUrlSchema.nullable().optional();

/** Jumlah porsi menu pada keranjang. */
export const quantitySchema = z.coerce
  .number({ message: 'Jumlah harus berupa angka' })
  .int('Jumlah harus bilangan bulat')
  .min(1, 'Jumlah minimal 1')
  .max(99, 'Jumlah maksimal 99 per menu');

/** Nilai harga, dibatasi mengikuti kapasitas kolom di database. */
export const priceSchema = z.coerce
  .number({ message: 'Harga harus berupa angka' })
  .min(0, 'Harga tidak boleh negatif')
  .max(9_999_999_999, 'Harga melebihi batas yang diizinkan')
  .refine((value) => Number.isFinite(value), 'Harga tidak valid');
