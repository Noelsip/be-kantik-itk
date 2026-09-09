import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { toUserResponse } from '../utils/presenters.js';
import * as authService from '../services/auth.service.js';

/** Fungsi untuk menangani permintaan yang berkaitan dengan proses masuk. */

/** Menyusun isi respons sesi. */
function sessionPayload(session) {
  return {
    user: toUserResponse(session.user),
    accessToken: session.accessToken,
    tokenType: session.tokenType,
    expiresIn: session.expiresIn,
  };
}

/** Menangani masuk dengan akun Google. */
export const googleLogin = asyncHandler(async (req, res) => {
  const session = await authService.loginWithGoogle(req.body.idToken);
  return sendSuccess(res, { message: 'Berhasil masuk', data: sessionPayload(session) });
});

/** Menangani masuk cepat untuk keperluan pengembangan. */
export const devLogin = asyncHandler(async (req, res) => {
  const session = await authService.devLogin(req.body.email);
  return sendSuccess(res, {
    message: 'Berhasil masuk (mode pengembangan)',
    data: sessionPayload(session),
  });
});

/** Menangani permintaan data akun yang sedang masuk. */
export const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);
  return sendSuccess(res, { message: 'Profil pengguna', data: toUserResponse(user) });
});

/** Menangani proses keluar. */
export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user.id);
  return sendSuccess(res, { message: 'Berhasil keluar', data: null });
});
