import { z } from 'zod';
import { idSchema, quantitySchema, itemNoteSchema } from './common.js';

/**
 * Aturan pemeriksaan untuk keranjang.
 * Tidak ada field harga maupun total; seluruhnya dihitung dari data database.
 */

export const addCartItemSchema = z
  .object({
    menuItemId: idSchema,
    quantity: quantitySchema.default(1),
    note: itemNoteSchema,
  })
  .strict('Terdapat data yang tidak dikenali');

export const updateCartItemSchema = z
  .object({
    quantity: quantitySchema.optional(),
    note: itemNoteSchema,
  })
  .strict('Terdapat data yang tidak dikenali')
  .refine((value) => Object.keys(value).length > 0, 'Tidak ada data yang diubah');

export const cartItemParamSchema = z.object({ id: idSchema });
