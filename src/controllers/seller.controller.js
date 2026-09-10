import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { ORDER_STATUS } from '../constants/orderStatus.js';
import * as sellerService from '../services/seller.service.js';

/**
 * Fungsi untuk menangani permintaan dari penjual.
 * Kepemilikan selalu bersumber dari `req.user.id`, bukan dari isi permintaan.
 */

/** Menangani permintaan ringkasan dasbor. */
export const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await sellerService.getDashboard(req.user.id);
  return sendSuccess(res, { message: 'Dasbor penjual', data: dashboard });
});

/** Menangani permintaan data kantin sendiri. */
export const getCanteen = asyncHandler(async (req, res) => {
  const canteen = await sellerService.getOwnCanteen(req.user.id);
  return sendSuccess(res, { message: 'Kantin Anda', data: canteen });
});

/** Menangani pembuatan kantin sendiri. */
export const createCanteen = asyncHandler(async (req, res) => {
  const canteen = await sellerService.createOwnCanteen(req.user.id, req.body);
  return sendCreated(res, { message: 'Kantin berhasil dibuat', data: canteen });
});

/** Menangani perubahan data kantin sendiri. */
export const updateCanteen = asyncHandler(async (req, res) => {
  const canteen = await sellerService.updateOwnCanteen(req.user.id, req.body);
  return sendSuccess(res, { message: 'Kantin berhasil diperbarui', data: canteen });
});

/** Menangani permintaan daftar menu sendiri. */
export const listMenu = asyncHandler(async (req, res) => {
  const { canteen, menu, meta } = await sellerService.listOwnMenu(req.user.id, req.validatedQuery);
  return sendSuccess(res, { message: 'Daftar menu Anda', data: { canteen, menu }, meta });
});

/** Menangani permintaan detail menu sendiri. */
export const getMenuItem = asyncHandler(async (req, res) => {
  const menu = await sellerService.getOwnMenuItem(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Detail menu', data: menu });
});

/** Menangani penambahan menu baru. */
export const createMenuItem = asyncHandler(async (req, res) => {
  const menu = await sellerService.createMenuItem(req.user.id, req.body);
  return sendCreated(res, { message: 'Menu berhasil ditambahkan', data: menu });
});

/** Menangani perubahan data menu. */
export const updateMenuItem = asyncHandler(async (req, res) => {
  const menu = await sellerService.updateMenuItem(req.user.id, req.params.id, req.body);
  return sendSuccess(res, { message: 'Menu berhasil diperbarui', data: menu });
});

/** Menangani penghapusan menu. */
export const deleteMenuItem = asyncHandler(async (req, res) => {
  const result = await sellerService.deleteMenuItem(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Menu berhasil dihapus', data: result });
});

/** Menangani permintaan daftar pesanan masuk. */
export const listOrders = asyncHandler(async (req, res) => {
  const { orders, meta } = await sellerService.listIncomingOrders(req.user.id, req.validatedQuery);
  return sendSuccess(res, { message: 'Daftar pesanan masuk', data: orders, meta });
});

/** Menangani permintaan detail pesanan masuk. */
export const getOrder = asyncHandler(async (req, res) => {
  const order = await sellerService.getIncomingOrder(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Detail pesanan', data: order });
});

/**
 * Menyusun handler untuk satu tindakan perubahan status.
 * Kelima tindakan penjual memakai bentuk yang sama, hanya berbeda status tujuan.
 */
function statusAction(nextStatus, message, buildOptions) {
  return asyncHandler(async (req, res) => {
    const order = await sellerService.transitionOrderStatus(
      req.user.id,
      req.params.id,
      nextStatus,
      buildOptions ? buildOptions(req) : undefined,
    );
    return sendSuccess(res, { message, data: order });
  });
}

/**
 * Menangani penerimaan pesanan.
 * Status langsung berpindah ke `diproses`, sehingga pembeli melihat pesanannya
 * sedang disiapkan tanpa menunggu tindakan penjual berikutnya.
 */
export const acceptOrder = statusAction(ORDER_STATUS.DIPROSES, 'Pesanan diterima dan sedang disiapkan');

/** Menangani penolakan pesanan beserta alasannya. */
export const rejectOrder = statusAction(ORDER_STATUS.DITOLAK, 'Pesanan ditolak', (req) => ({
  rejectReason: req.body?.reason ?? null,
}));

/**
 * Menangani pemrosesan pesanan.
 * Hanya berlaku bagi pesanan lama yang masih berstatus `diterima`, karena alur
 * baru sudah berpindah ke `diproses` sejak pesanan diterima.
 */
export const processOrder = statusAction(ORDER_STATUS.DIPROSES, 'Pesanan sedang disiapkan');

/** Menangani penandaan pesanan siap diambil. */
export const readyOrder = statusAction(ORDER_STATUS.SIAP_DIAMBIL, 'Pesanan siap diambil');

/**
 * Menangani penyelesaian pesanan setelah pembeli mengambil dan membayar
 * langsung di kantin. Tidak ada data pembayaran yang dicatat.
 */
export const completeOrder = statusAction(ORDER_STATUS.SELESAI, 'Pesanan selesai');
