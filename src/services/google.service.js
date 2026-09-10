import { OAuth2Client } from 'google-auth-library';
import config from '../config/env.js';
import { AuthenticationError } from '../utils/errors.js';
import ERROR_CODES from '../constants/errorCodes.js';
import logger from '../utils/logger.js';

/**
 * Fungsi untuk memeriksa identitas Google yang dikirim aplikasi.
 * Pemeriksaan dilakukan ke kunci publik Google, mencakup tanda tangan, penerbit,
 * masa berlaku, dan kesesuaiannya dengan aplikasi ini.
 */

const client = new OAuth2Client();

/** Memeriksa identitas Google dan mengembalikan data pengguna yang terverifikasi. */
export async function verifyGoogleIdToken(idToken) {
  if (!config.auth.googleClientId) {
    // Menolak di sini lebih aman daripada memeriksa tanpa penanda aplikasi,
    // yang akan membuat identitas dari aplikasi Google lain ikut diterima.
    throw new AuthenticationError(
      'Masuk dengan Google belum tersedia saat ini. Silakan hubungi pengelola aplikasi.',
      ERROR_CODES.INVALID_GOOGLE_TOKEN,
    );
  }

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience: config.auth.googleClientId,
    });
  } catch (error) {
    logger.warn('Pemeriksaan identitas Google gagal:', error?.message);
    throw new AuthenticationError(
      'Akun Google Anda tidak dapat diverifikasi. Silakan masuk kembali.',
      ERROR_CODES.INVALID_GOOGLE_TOKEN,
    );
  }

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload?.email) {
    throw new AuthenticationError(
      'Data akun Google Anda tidak lengkap. Silakan masuk kembali.',
      ERROR_CODES.INVALID_GOOGLE_TOKEN,
    );
  }

  // Alamat email yang belum diverifikasi Google dapat dikuasai pihak lain,
  // sehingga tidak boleh dipakai untuk mencocokkan maupun membuat akun.
  if (payload.email_verified === false) {
    throw new AuthenticationError(
      'Email Google Anda belum terverifikasi.',
      ERROR_CODES.EMAIL_NOT_VERIFIED,
    );
  }

  return {
    googleId: payload.sub,
    email: String(payload.email).toLowerCase(),
    emailVerified: payload.email_verified !== false,
    name: payload.name ?? null,
    picture: payload.picture ?? null,
  };
}

export default verifyGoogleIdToken;
