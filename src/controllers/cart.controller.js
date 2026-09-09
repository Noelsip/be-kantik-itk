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
  const { menuItemId, quantity, replaceCanteen } = req.body;
  const cart = await cartService.addItem(req.user.id, { menuItemId, quantity }, { replaceCanteen });
  return sendCreated(res, { message: 'Menu ditambahkan ke keranjang', data: cart });
});

/** Menangani perubahan jumlah item keranjang. */
export const updateItem = asyncHandler(async (req, res) => {
  const cart = await cartService.updateItemQuantity(req.user.id, req.params.id, req.body.quantity);
  return sendSuccess(res, { message: 'Jumlah menu diperbarui', data: cart });
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
