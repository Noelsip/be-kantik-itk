import rateLimit from 'express-rate-limit';
import config from '../config/env.js';
import ERROR_CODES from '../constants/errorCodes.js';

/**
 * Fungsi untuk membatasi jumlah permintaan yang boleh masuk dalam rentang waktu
 * tertentu, sebagai pengaman dari percobaan tebak-menebak dan banjir permintaan.
 */

const sharedOptions = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Pembatasan dilewati saat pengujian agar tidak mengganggu jalannya tes.
  skip: () => config.isTest,
  handler: (_req, res, _next, options) =>
    res.status(options.statusCode).json({
      success: false,
      message: 'Terlalu banyak permintaan. Silakan coba beberapa saat lagi.',
      error: { code: ERROR_CODES.RATE_LIMITED },
    }),
};

/** Membatasi permintaan untuk seluruh API secara umum. */
export const globalLimiter = rateLimit({
  ...sharedOptions,
  windowMs: config.http.rateLimitWindowMs,
  limit: config.http.rateLimitMax,
});

/** Membatasi permintaan pada jalur masuk yang paling rawan disalahgunakan. */
export const authLimiter = rateLimit({
  ...sharedOptions,
  windowMs: config.http.rateLimitWindowMs,
  limit: config.http.authRateLimitMax,
});

/** Membatasi permintaan yang mengubah data, seperti keranjang dan pesanan. */
export const writeLimiter = rateLimit({
  ...sharedOptions,
  windowMs: 60 * 1000,
  limit: 60,
});
