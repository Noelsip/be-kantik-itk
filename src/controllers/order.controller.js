import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import * as orderService from '../services/order.service.js';

/** Fungsi untuk menangani permintaan pesanan dari sisi pembeli. */

/**
 * Menangani pembuatan pesanan dari isi keranjang.
 * Keranjang yang memuat beberapa kantin menghasilkan satu pesanan untuk tiap
 * kantin, sehingga jawabannya selalu berupa daftar.
 */
export const createOrder = asyncHandler(async (req, res) => {
  const orders = await orderService.checkout(req.user.id, { note: req.body.note });
  const message =
    orders.length === 1 ? 'Pesanan berhasil dibuat' : `${orders.length} pesanan berhasil dibuat`;
  return sendCreated(res, { message, data: orders });
});

/** Menangani permintaan daftar pesanan. */
export const listOrders = asyncHandler(async (req, res) => {
  const { orders, meta } = await orderService.listBuyerOrders(req.user.id, req.validatedQuery);
  return sendSuccess(res, { message: 'Daftar pesanan', data: orders, meta });
});

/** Menangani permintaan detail pesanan. */
export const getOrder = asyncHandler(async (req, res) => {
  const order = await orderService.getBuyerOrder(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Detail pesanan', data: order });
});

/** Menangani pembatalan pesanan. */
export const cancelOrder = asyncHandler(async (req, res) => {
  const order = await orderService.cancelOrder(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Pesanan berhasil dibatalkan', data: order });
});
