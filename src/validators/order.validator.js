import { z } from 'zod';
import { idSchema, paginationSchema } from './common.js';
import { ORDER_STATUS_VALUES } from '../constants/orderStatus.js';

/**
 * Aturan pemeriksaan untuk pesanan.
 *
 * Pembuatan pesanan hanya menerima catatan. Kantin, daftar item, salinan harga,
 * dan totalnya seluruhnya berasal dari keranjang serta data menu di server.
 */

export const createOrderSchema = z
  .object({
    note: z
      .string()
      .trim()
      .max(500, 'Catatan maksimal 500 karakter')
      .nullish()
      .transform((value) => (value ? value : null)),
  })
  .strict('Terdapat data yang tidak dikenali. Total pesanan dihitung otomatis oleh server.');

export const orderListQuerySchema = paginationSchema.extend({
  scope: z.enum(['active', 'history', 'all']).default('all'),
  status: z.enum(ORDER_STATUS_VALUES).optional(),
});

export const orderIdParamSchema = z.object({ id: idSchema });

/** Aturan alasan penolakan pesanan, bersifat opsional. */
export const rejectOrderSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .max(255, 'Alasan penolakan maksimal 255 karakter')
      .nullish()
      .transform((value) => (value ? value : null)),
  })
  .strict('Terdapat data yang tidak dikenali');
