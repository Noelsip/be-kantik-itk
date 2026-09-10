import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import * as cartService from '../services/cart.service.js';

/** Fungsi untuk menangani permintaan keranjang belanja. */

/** Menangani permintaan isi keranjang. */
export const getCart = asyncHandler(async (req, res) => {
  const cart = await cartService.getCart(req.user.id);
  return sendSuccess(res, { message: 'Isi keranjang', data: cart });
});

/** Menangani penambahan menu ke keranjang. */
export const addItem = asyncHandler(async (req, res) => {
  const { menuItemId, quantity, note } = req.body;
  const cart = await cartService.addItem(req.user.id, { menuItemId, quantity, note });
  return sendCreated(res, { message: 'Menu ditambahkan ke keranjang', data: cart });
});

/** Menangani perubahan jumlah maupun catatan item keranjang. */
export const updateItem = asyncHandler(async (req, res) => {
  const { quantity, note } = req.body;
  const cart = await cartService.updateItem(req.user.id, req.params.id, { quantity, note });
  return sendSuccess(res, { message: 'Item keranjang diperbarui', data: cart });
});

/** Menangani penghapusan item dari keranjang. */
export const removeItem = asyncHandler(async (req, res) => {
  const cart = await cartService.removeItem(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Menu dihapus dari keranjang', data: cart });
});

/** Menangani pengosongan keranjang. */
export const clearCart = asyncHandler(async (req, res) => {
  const cart = await cartService.clearCart(req.user.id);
  return sendSuccess(res, { message: 'Keranjang dikosongkan', data: cart });
});
