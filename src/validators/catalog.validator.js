import { z } from 'zod';
import { idSchema, paginationSchema, searchSchema, optionalBooleanSchema } from './common.js';

/** Aturan pemeriksaan query untuk katalog kantin, menu, dan kategori. */

export const canteenListQuerySchema = paginationSchema.extend({
  search: searchSchema,
  isOpen: optionalBooleanSchema,
});

/** Aturan pencarian dan penyaringan menu dari seluruh kantin. */
export const menuListQuerySchema = paginationSchema.extend({
  search: searchSchema,
  categoryId: idSchema.optional(),
  canteenId: idSchema.optional(),
  isAvailable: optionalBooleanSchema,
});

/** Aturan pencarian menu pada satu kantin; kantin diambil dari alamat. */
export const canteenMenuQuerySchema = paginationSchema.extend({
  search: searchSchema,
  categoryId: idSchema.optional(),
  isAvailable: optionalBooleanSchema,
});

export const canteenIdParamSchema = z.object({ id: idSchema });
