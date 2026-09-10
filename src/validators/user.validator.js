import { z } from 'zod';
import { nullableImageUrlSchema, nullableWhatsappSchema } from './common.js';

/**
 * Aturan pemeriksaan untuk pengubahan profil.
 * Hanya field tampilan yang diterima; kiriman berisi `role`, `email`,
 * `campusId`, atau `id` ditolak, bukan diabaikan.
 */
export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Nama wajib diisi')
      .max(100, 'Nama maksimal 100 karakter')
      .optional(),
    profileImage: nullableImageUrlSchema,
    whatsapp: nullableWhatsappSchema,
  })
  .strict('Data tersebut tidak dapat diubah. Email dan peran akun berasal dari akun Google Anda.')
  .refine((value) => Object.keys(value).length > 0, 'Tidak ada data yang diubah');
