import { z } from 'zod';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../utils/pagination.js';

/**
 * Potongan aturan pemeriksaan yang dipakai berulang.
 * Nilai pada query selalu berupa teks, sehingga dikonversi di sini.
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
 * Teks kosong diubah menjadi tidak terisi agar tidak menambah kondisi kueri.
 */
export const searchSchema = z
  .string()
  .trim()
  .max(100, 'Kata kunci pencarian maksimal 100 karakter')
  .optional()
  .transform((value) => (value ? value : undefined));

/**
 * Alamat gambar yang diterima.
 * Dibatasi pada http dan https agar nilainya tidak dapat menjalankan skrip.
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

/**
 * Nomor WhatsApp Indonesia, disimpan dalam bentuk baku berawalan 62.
 * Bentuk 08xx, 8xx, 62xx, maupun +62xx diterima, sedangkan spasi, tanda hubung,
 * dan tanda kurung diabaikan.
 */
export const whatsappSchema = z
  .string()
  .trim()
  .max(25, 'Nomor WhatsApp terlalu panjang')
  .transform((value) => value.replace(/[\s\-().]/g, ''))
  .refine((value) => /^(\+?62|0)?8\d+$/.test(value), 'Nomor WhatsApp tidak valid')
  .transform((value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.startsWith('62')) return digits;
    if (digits.startsWith('0')) return `62${digits.slice(1)}`;
    return `62${digits}`;
  })
  .refine(
    (value) => value.length >= 10 && value.length <= 15,
    'Nomor WhatsApp harus terdiri dari 10 sampai 15 angka',
  );

export const nullableWhatsappSchema = whatsappSchema.nullable().optional();

/** Catatan singkat untuk satu baris menu, misalnya tingkat kepedasan. */
export const itemNoteSchema = z
  .string()
  .trim()
  .max(255, 'Catatan maksimal 255 karakter')
  .nullable()
  .optional()
  .transform((value) => (value ? value : null));

/** Arah pengurutan daftar. */
export const sortOrderSchema = z.enum(['asc', 'desc']).default('asc');
