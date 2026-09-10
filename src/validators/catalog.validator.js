import { z } from 'zod';
import {
  idSchema,
  paginationSchema,
  searchSchema,
  optionalBooleanSchema,
  sortOrderSchema,
} from './common.js';

/** Aturan pemeriksaan query untuk katalog kantin, menu, dan kategori. */

export const canteenListQuerySchema = paginationSchema.extend({
  search: searchSchema,
  isOpen: optionalBooleanSchema,
  sortBy: z.enum(['name', 'menuCount', 'createdAt']).optional(),
  sortOrder: sortOrderSchema,
});

/** Aturan pencarian dan penyaringan menu dari seluruh kantin. */
export const menuListQuerySchema = paginationSchema.extend({
  search: searchSchema,
  categoryId: idSchema.optional(),
  canteenId: idSchema.optional(),
  isAvailable: optionalBooleanSchema,
  sortBy: z.enum(['name', 'price', 'createdAt']).optional(),
  sortOrder: sortOrderSchema,
});

/** Aturan pencarian menu pada satu kantin; kantin diambil dari alamat. */
export const canteenMenuQuerySchema = paginationSchema.extend({
  search: searchSchema,
  categoryId: idSchema.optional(),
  isAvailable: optionalBooleanSchema,
  sortBy: z.enum(['name', 'price', 'createdAt']).optional(),
  sortOrder: sortOrderSchema,
});

export const canteenIdParamSchema = z.object({ id: idSchema });

/** Aturan pembuatan kategori oleh penjual. */
export const createCategorySchema = z
  .object({
    name: z
      .string({ message: 'Nama kategori wajib diisi' })
      .trim()
      .min(1, 'Nama kategori wajib diisi')
      .max(100, 'Nama kategori maksimal 100 karakter'),
  })
  .strict('Terdapat data yang tidak dikenali');
