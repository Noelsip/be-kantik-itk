import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as canteenService from '../services/canteen.service.js';
import * as menuService from '../services/menu.service.js';
import * as categoryService from '../services/category.service.js';

/**
 * Fungsi untuk menangani permintaan katalog kantin, menu, dan kategori.
 * Nilai `req.validatedQuery` berasal dari lapisan pemeriksaan permintaan.
 */

/** Menangani permintaan daftar kantin. */
export const listCanteens = asyncHandler(async (req, res) => {
  const { canteens, meta } = await canteenService.listCanteens(req.validatedQuery);
  return sendSuccess(res, { message: 'Daftar kantin', data: canteens, meta });
});

/** Menangani permintaan detail kantin. */
export const getCanteen = asyncHandler(async (req, res) => {
  const canteen = await canteenService.getCanteen(req.params.id);
  return sendSuccess(res, { message: 'Detail kantin', data: canteen });
});

/** Menangani permintaan menu milik sebuah kantin. */
export const getCanteenMenu = asyncHandler(async (req, res) => {
  const { canteen, menu, meta } = await canteenService.getCanteenMenu(
    req.params.id,
    req.validatedQuery,
  );
  return sendSuccess(res, { message: 'Daftar menu kantin', data: { canteen, menu }, meta });
});

/** Menangani permintaan daftar menu dari seluruh kantin. */
export const listMenu = asyncHandler(async (req, res) => {
  const { menu, meta } = await menuService.listMenu(req.validatedQuery);
  return sendSuccess(res, { message: 'Daftar menu', data: menu, meta });
});

/** Menangani permintaan detail menu. */
export const getMenuItem = asyncHandler(async (req, res) => {
  const menu = await menuService.getMenuItem(req.params.id);
  return sendSuccess(res, { message: 'Detail menu', data: menu });
});

/** Menangani permintaan daftar kategori. */
export const listCategories = asyncHandler(async (_req, res) => {
  const categories = await categoryService.listCategories();
  return sendSuccess(res, { message: 'Daftar kategori', data: categories });
});
