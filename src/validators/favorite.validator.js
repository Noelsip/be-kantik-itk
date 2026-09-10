import { z } from 'zod';
import { idSchema, paginationSchema } from './common.js';

/**
 * Aturan pemeriksaan untuk menu favorit.
 * Hanya id menu yang diterima; pemilik favorit diambil dari akun yang masuk.
 */

export const addFavoriteSchema = z
  .object({
    menuItemId: idSchema,
  })
  .strict('Terdapat data yang tidak dikenali');

export const favoriteParamSchema = z.object({ menuItemId: idSchema });

export const favoriteListQuerySchema = paginationSchema;
