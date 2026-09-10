import ERROR_CODES from '../constants/errorCodes.js';
import { NotFoundError } from '../utils/errors.js';
import { buildPaginationMeta } from '../utils/response.js';
import { toMenuResponse } from '../utils/presenters.js';
import * as favoriteRepository from '../repositories/favorite.repository.js';
import * as menuRepository from '../repositories/menu.repository.js';

/**
 * Fungsi untuk mengatur menu favorit milik pembeli.
 * Penandaan bersifat idempoten, sehingga penekanan tombol berulang dari aplikasi
 * tidak menimbulkan kesalahan maupun baris ganda.
 */

/** Memastikan menu yang dirujuk masih ada dan belum dihapus. */
async function assertMenuExists(menuItemId) {
  const menu = await menuRepository.findById(menuItemId);
  if (!menu) {
    throw new NotFoundError('Menu tidak ditemukan', ERROR_CODES.MENU_NOT_FOUND);
  }
  return menu;
}

/** Menambahkan menu ke daftar favorit pembeli. */
export async function addFavorite(userId, menuItemId) {
  await assertMenuExists(menuItemId);
  await favoriteRepository.add(userId, menuItemId);

  const menu = await menuRepository.findByIdForViewer(menuItemId, userId);
  return toMenuResponse(menu);
}

/** Menghapus menu dari daftar favorit pembeli. */
export async function removeFavorite(userId, menuItemId) {
  await assertMenuExists(menuItemId);
  await favoriteRepository.remove(userId, menuItemId);

  const menu = await menuRepository.findByIdForViewer(menuItemId, userId);
  return toMenuResponse(menu);
}

/** Mengambil daftar menu favorit milik pembeli. */
export async function listFavorites(userId, filters = {}) {
  const { rows, total, pagination } = await favoriteRepository.findAllByUser(userId, filters);
  return {
    menu: rows.map(toMenuResponse),
    meta: buildPaginationMeta({ page: pagination.page, limit: pagination.limit, total }),
  };
}
