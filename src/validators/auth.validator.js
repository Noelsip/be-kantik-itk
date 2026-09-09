import { z } from 'zod';

/**
 * Aturan pemeriksaan untuk proses masuk.
 *
 * Bentuk yang ketat penting di sini: aplikasi tidak dapat menyisipkan `role`,
 * `email`, atau `userId` ke badan permintaan masuk, karena seluruh identitas
 * hanya berasal dari hasil pemeriksaan identitas Google.
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
