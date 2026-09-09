import { z } from 'zod';
import { idSchema, quantitySchema } from './common.js';

/**
 * Aturan pemeriksaan untuk keranjang.
 *
 * Tidak ada field harga, subtotal, maupun total di sini. Seluruh nilai tersebut
 * dihitung dari data di database saat pesanan dibuat.
 */

export const addCartItemSchema = z
  .object({
    menuItemId: idSchema,
    quantity: quantitySchema.default(1),
    /**
     * Penanda persetujuan ganti kantin. Aplikasi mengirim ulang permintaan yang
     * sama dengan nilai benar setelah pengguna setuju mengosongkan keranjang.
     */
    replaceCanteen: z.boolean().default(false),
  })
  .strict('Terdapat data yang tidak dikenali');

export const updateCartItemSchema = z
  .object({
    quantity: quantitySchema,
  })
  .strict('Terdapat data yang tidak dikenali');

export const cartItemParamSchema = z.object({ id: idSchema });
