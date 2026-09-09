import ERROR_CODES from '../constants/errorCodes.js';
import { NotFoundError } from '../utils/errors.js';
import { buildPaginationMeta } from '../utils/response.js';
import { toCanteenResponse, toMenuResponse } from '../utils/presenters.js';
import * as canteenRepository from '../repositories/canteen.repository.js';
import * as menuRepository from '../repositories/menu.repository.js';

/** Fungsi untuk menyajikan data kantin kepada pembeli. */

/** Mengambil daftar kantin beserta informasi halamannya. */
export async function listCanteens(filters = {}) {
  const { rows, total, pagination } = await canteenRepository.findAll(filters);
  return {
    canteens: rows.map(toCanteenResponse),
    meta: buildPaginationMeta({ page: pagination.page, limit: pagination.limit, total }),
  };
}

/** Mengambil detail satu kantin. */
export async function getCanteen(canteenId) {
  const canteen = await canteenRepository.findById(canteenId);
  if (!canteen) {
    throw new NotFoundError('Kantin tidak ditemukan', ERROR_CODES.CANTEEN_NOT_FOUND);
  }
  return toCanteenResponse(canteen);
}

/** Mengambil menu sebuah kantin dengan pencarian dan penyaringan kategori. */
export async function getCanteenMenu(canteenId, filters = {}) {
  const canteen = await canteenRepository.findById(canteenId);
  if (!canteen) {
    throw new NotFoundError('Kantin tidak ditemukan', ERROR_CODES.CANTEEN_NOT_FOUND);
  }

  const { rows, total, pagination } = await menuRepository.findAll({
    ...filters,
    canteenId: Number(canteen.id),
  });

  return {
    canteen: toCanteenResponse(canteen),
    menu: rows.map(toMenuResponse),
    meta: buildPaginationMeta({ page: pagination.page, limit: pagination.limit, total }),
  };
}
