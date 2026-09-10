import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as favoriteService from '../services/favorite.service.js';

/**
 * Fungsi untuk menangani permintaan menu favorit.
 * Pemilik favorit selalu diambil dari akun yang sedang masuk.
 */

/** Menangani permintaan daftar menu favorit. */
export const listFavorites = asyncHandler(async (req, res) => {
  const { menu, meta } = await favoriteService.listFavorites(req.user.id, req.validatedQuery);
  return sendSuccess(res, { message: 'Daftar menu favorit', data: menu, meta });
});

/** Menangani penandaan sebuah menu sebagai favorit. */
export const addFavorite = asyncHandler(async (req, res) => {
  const menu = await favoriteService.addFavorite(req.user.id, req.body.menuItemId);
  return sendSuccess(res, { statusCode: 201, message: 'Menu ditambahkan ke favorit', data: menu });
});

/** Menangani pembatalan penandaan favorit sebuah menu. */
export const removeFavorite = asyncHandler(async (req, res) => {
  const menu = await favoriteService.removeFavorite(req.user.id, req.params.menuItemId);
  return sendSuccess(res, { message: 'Menu dikeluarkan dari favorit', data: menu });
});
