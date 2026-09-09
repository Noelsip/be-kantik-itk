import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import { AuthenticationError } from './errors.js';
import ERROR_CODES from '../constants/errorCodes.js';

/**
 * Penerbitan dan pemeriksaan kunci akses aplikasi.
 *
 * Isi kunci dibuat seminimal mungkin: hanya id pengguna dan nomor versi sesi.
 * Peran pengguna sengaja tidak disertakan agar perubahan peran langsung berlaku
 * tanpa menunggu kunci lama kedaluwarsa.
 */

export function signAccessToken({ userId, tokenVersion }) {
  return jwt.sign({ tv: tokenVersion }, config.auth.jwtSecret, {
    subject: String(userId),
    issuer: config.auth.jwtIssuer,
    expiresIn: config.auth.jwtExpiresIn,
    algorithm: 'HS256',
  });
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.auth.jwtSecret, {
      issuer: config.auth.jwtIssuer,
      // Algoritma dikunci agar kunci dengan algoritma lain tidak ikut diterima.
      algorithms: ['HS256'],
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError(
        'Sesi Anda telah berakhir. Silakan masuk kembali.',
        ERROR_CODES.TOKEN_EXPIRED,
      );
    }
    throw new AuthenticationError(
      'Sesi Anda tidak berlaku. Silakan masuk kembali.',
      ERROR_CODES.INVALID_TOKEN,
    );
  }
}

/** Mengambil kunci akses dari header Authorization berformat Bearer. */
export function extractBearerToken(headerValue) {
  if (typeof headerValue !== 'string') return null;
  const [scheme, token] = headerValue.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') return null;
  return token.trim() || null;
}
