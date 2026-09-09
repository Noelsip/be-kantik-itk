import { extractBearerToken, verifyAccessToken } from '../utils/jwt.js';
import { AuthenticationError } from '../utils/errors.js';
import ERROR_CODES from '../constants/errorCodes.js';
import asyncHandler from '../utils/asyncHandler.js';
import * as userRepository from '../repositories/user.repository.js';

/**
 * Pemeriksaan kunci akses sekaligus pengambilan data pengguna terkini.
 *
 * Data pengguna dibaca ulang dari database pada setiap permintaan, bukan
 * dipercaya dari isi kunci. Dengan begitu perubahan peran dan proses keluar
 * langsung berlaku, dan tidak ada keputusan hak akses yang bersumber dari data
 * kiriman klien.
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    throw new AuthenticationError('Anda belum masuk. Silakan masuk terlebih dahulu.');
  }

  const payload = verifyAccessToken(token);
  const userId = Number(payload.sub);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new AuthenticationError(
      'Sesi Anda tidak berlaku. Silakan masuk kembali.',
      ERROR_CODES.INVALID_TOKEN,
    );
  }

  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AuthenticationError('Akun tidak ditemukan.', ERROR_CODES.INVALID_TOKEN);
  }

  // Versi sesi yang berbeda menandakan kunci diterbitkan sebelum pengguna keluar.
  if (Number(payload.tv) !== Number(user.token_version)) {
    throw new AuthenticationError(
      'Sesi Anda sudah tidak berlaku. Silakan masuk kembali.',
      ERROR_CODES.INVALID_TOKEN,
    );
  }

  req.user = user;
  next();
});

export default authenticate;
