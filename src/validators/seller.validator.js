import { z } from 'zod';
import {
  idSchema,
  paginationSchema,
  searchSchema,
  optionalBooleanSchema,
  priceSchema,
  nullableImageUrlSchema,
  nullableWhatsappSchema,
} from './common.js';

/**
 * Aturan pemeriksaan untuk kebutuhan penjual.
 * Field `canteenId` sengaja tidak diterima; kantin selalu ditentukan dari akun
 * yang sedang masuk.
 */

/** Menyusun aturan teks opsional dengan batas panjang tertentu. */
const optionalText = (max, label) =>
  z
    .string()
    .trim()
    .max(max, `${label} maksimal ${max} karakter`)
    .nullish()
    .transform((value) => (value ? value : null));

export const createMenuSchema = z
  .object({
    name: z
      .string({ message: 'Nama menu wajib diisi' })
      .trim()
      .min(1, 'Nama menu wajib diisi')
      .max(150, 'Nama menu maksimal 150 karakter'),
    description: optionalText(1000, 'Deskripsi'),
    price: priceSchema,
    categoryId: idSchema.nullish().transform((value) => value ?? null),
    imageUrl: nullableImageUrlSchema.transform((value) => value ?? null),
    isAvailable: z.boolean().default(true),
  })
  .strict('Terdapat data yang tidak dikenali');

/** Aturan pengubahan menu; seluruh field opsional namun tidak boleh kosong semua. */
export const updateMenuSchema = z
  .object({
    name: z.string().trim().min(1, 'Nama menu wajib diisi').max(150).optional(),
    description: optionalText(1000, 'Deskripsi').optional(),
    price: priceSchema.optional(),
    categoryId: idSchema.nullish().optional(),
    imageUrl: nullableImageUrlSchema,
    isAvailable: z.boolean().optional(),
  })
  .strict('Terdapat data yang tidak dikenali')
  .refine((value) => Object.keys(value).length > 0, 'Tidak ada data yang diubah');

export const sellerMenuQuerySchema = paginationSchema.extend({
  search: searchSchema,
  categoryId: idSchema.optional(),
  isAvailable: optionalBooleanSchema,
});

export const createCanteenSchema = z
  .object({
    name: z
      .string({ message: 'Nama kantin wajib diisi' })
      .trim()
      .min(1, 'Nama kantin wajib diisi')
      .max(100, 'Nama kantin maksimal 100 karakter'),
    description: optionalText(1000, 'Deskripsi'),
    location: optionalText(255, 'Lokasi'),
    imageUrl: nullableImageUrlSchema.transform((value) => value ?? null),
    whatsapp: nullableWhatsappSchema.transform((value) => value ?? null),
    isOpen: z.boolean().default(true),
  })
  .strict('Terdapat data yang tidak dikenali');

export const updateCanteenSchema = z
  .object({
    name: z.string().trim().min(1, 'Nama kantin wajib diisi').max(100).optional(),
    description: optionalText(1000, 'Deskripsi').optional(),
    location: optionalText(255, 'Lokasi').optional(),
    imageUrl: nullableImageUrlSchema,
    whatsapp: nullableWhatsappSchema,
    isOpen: z.boolean().optional(),
  })
  .strict('Terdapat data yang tidak dikenali')
  .refine((value) => Object.keys(value).length > 0, 'Tidak ada data yang diubah');
