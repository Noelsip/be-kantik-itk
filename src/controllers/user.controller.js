import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as userService from '../services/user.service.js';

/** Fungsi untuk menangani permintaan profil pengguna. */

/** Menangani permintaan data profil. */
export const getProfile = asyncHandler(async (req, res) => {
  const user = await userService.getProfile(req.user.id);
  return sendSuccess(res, { message: 'Profil pengguna', data: user });
});

/** Menangani permintaan ringkasan angka pada halaman profil. */
export const getStats = asyncHandler(async (req, res) => {
  const stats = await userService.getStats(req.user);
  return sendSuccess(res, { message: 'Ringkasan profil', data: stats });
});

/** Menangani perubahan data profil. */
export const updateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user.id, req.body);
  return sendSuccess(res, { message: 'Profil berhasil diperbarui', data: user });
});
