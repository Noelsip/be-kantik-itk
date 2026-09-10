import { z } from 'zod';

/**
 * Aturan pemeriksaan untuk proses masuk.
 * Bentuk yang ketat menutup penyisipan `role`, `email`, atau `userId`, karena
 * identitas hanya berasal dari hasil pemeriksaan Google.
 */
export const googleLoginSchema = z
  .object({
    idToken: z
      .string({ message: 'Identitas Google wajib dikirim' })
      .trim()
      .min(1, 'Identitas Google wajib dikirim')
      .max(4096, 'Identitas Google tidak valid'),
  })
  .strict('Terdapat data yang tidak dikenali pada permintaan masuk');

/** Aturan pemeriksaan untuk jalur masuk cepat saat pengembangan. */
export const devLoginSchema = z
  .object({
    email: z
      .string({ message: 'Email wajib diisi' })
      .trim()
      .toLowerCase()
      .email('Format email tidak valid')
      .max(150),
  })
  .strict();
