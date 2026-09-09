import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import * as orderService from '../services/order.service.js';

/** Fungsi untuk menangani permintaan pesanan dari sisi pembeli. */

/** Menangani pembuatan pesanan dari isi keranjang. */
export const createOrder = asyncHandler(async (req, res) => {
  const order = await orderService.checkout(req.user.id, { note: req.body.note });
  return sendCreated(res, { message: 'Pesanan berhasil dibuat', data: order });
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
