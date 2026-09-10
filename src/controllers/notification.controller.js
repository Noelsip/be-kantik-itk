import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import * as notificationService from '../services/notification.service.js';

/**
 * Fungsi untuk menangani permintaan notifikasi.
 * Pemilik notifikasi selalu diambil dari akun yang sedang masuk.
 */

/** Menangani permintaan daftar notifikasi. */
export const listNotifications = asyncHandler(async (req, res) => {
  const { notifications, unreadCount, meta } = await notificationService.listNotifications(
    req.user.id,
    req.validatedQuery,
  );
  return sendSuccess(res, {
    message: 'Daftar notifikasi',
    data: notifications,
    meta: { ...meta, unreadCount },
  });
});

/** Menangani permintaan jumlah notifikasi yang belum dibaca. */
export const getUnreadCount = asyncHandler(async (req, res) => {
  const unreadCount = await notificationService.countUnread(req.user.id);
  return sendSuccess(res, { message: 'Jumlah notifikasi belum dibaca', data: { unreadCount } });
});

/** Menangani penandaan satu notifikasi sebagai sudah dibaca. */
export const markAsRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markAsRead(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Notifikasi ditandai sudah dibaca', data: notification });
});

/** Menangani penandaan seluruh notifikasi sebagai sudah dibaca. */
export const markAllAsRead = asyncHandler(async (req, res) => {
  const hasil = await notificationService.markAllAsRead(req.user.id);
  return sendSuccess(res, { message: 'Seluruh notifikasi ditandai sudah dibaca', data: hasil });
});

/** Menangani pendaftaran perangkat penerima pesan push. */
export const registerDevice = asyncHandler(async (req, res) => {
  const hasil = await notificationService.registerDevice(req.user.id, req.body);
  return sendCreated(res, { message: 'Perangkat didaftarkan', data: hasil });
});

/** Menangani pencabutan pendaftaran perangkat. */
export const unregisterDevice = asyncHandler(async (req, res) => {
  const hasil = await notificationService.unregisterDevice(req.user.id, req.params.token);
  return sendSuccess(res, { message: 'Perangkat dicabut', data: hasil });
});
