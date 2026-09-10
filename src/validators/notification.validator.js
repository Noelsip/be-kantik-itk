import { z } from 'zod';
import { paginationSchema, optionalBooleanSchema } from './common.js';

/**
 * Aturan pemeriksaan untuk notifikasi dan perangkat penerimanya.
 * Pemilik notifikasi selalu diambil dari akun yang sedang masuk.
 */

export const notificationListQuerySchema = paginationSchema.extend({
  unreadOnly: optionalBooleanSchema,
});

export const registerDeviceSchema = z
  .object({
    token: z
      .string({ message: 'Token perangkat wajib diisi' })
      .trim()
      .min(1, 'Token perangkat wajib diisi')
      .max(255, 'Token perangkat maksimal 255 karakter'),
    platform: z.enum(['android', 'ios', 'web']).default('android'),
  })
  .strict('Terdapat data yang tidak dikenali');

export const deviceTokenParamSchema = z.object({
  token: z.string().trim().min(1).max(255),
});
