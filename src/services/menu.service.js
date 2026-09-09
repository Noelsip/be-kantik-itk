import ERROR_CODES from '../constants/errorCodes.js';
import { NotFoundError } from '../utils/errors.js';
import { buildPaginationMeta } from '../utils/response.js';
import { toMenuResponse } from '../utils/presenters.js';
import * as menuRepository from '../repositories/menu.repository.js';

/**
 * Fungsi untuk menyajikan menu kepada pembeli.
 *
 * Pencarian dan penyaringan dikerjakan pada kueri database, sehingga aplikasi
 * tidak perlu mengunduh seluruh menu lalu menyaringnya sendiri.
 */

/** Mengambil daftar menu sesuai pencarian dan penyaringan. */
export async function listMenu(filters = {}) {
  const { rows, total, pagination } = await menuRepository.findAll(filters);
  return {
    menu: rows.map(toMenuResponse),
    meta: buildPaginationMeta({ page: pagination.page, limit: pagination.limit, total }),
  };
}

/** Mengambil detail satu menu. */
export async function getMenuItem(menuId) {
  const menu = await menuRepository.findById(menuId);
  if (!menu) {
    throw new NotFoundError('Menu tidak ditemukan', ERROR_CODES.MENU_NOT_FOUND);
  }
  return toMenuResponse(menu);
}
