import ERROR_CODES from '../constants/errorCodes.js';
import { NotFoundError } from '../utils/errors.js';
import { buildPaginationMeta } from '../utils/response.js';
import { toNotificationResponse } from '../utils/presenters.js';
import logger from '../utils/logger.js';
import * as notificationRepository from '../repositories/notification.repository.js';
import * as deviceTokenRepository from '../repositories/deviceToken.repository.js';
import { sendToTokens } from './fcm.service.js';

/**
 * Fungsi untuk menyimpan dan menyampaikan notifikasi.
 * Riwayat selalu tersimpan lebih dulu, sedangkan pesan push menyusul dan
 * kegagalannya tidak pernah membatalkan alur yang memicunya.
 */

/** Mengambil daftar notifikasi milik pengguna. */
export async function listNotifications(userId, filters = {}) {
  const { rows, total, pagination } = await notificationRepository.findAllByUser(userId, filters);
  const unreadCount = await notificationRepository.countUnread(userId);

  return {
    notifications: rows.map(toNotificationResponse),
    unreadCount,
    meta: buildPaginationMeta({ page: pagination.page, limit: pagination.limit, total }),
  };
}

/** Menghitung notifikasi yang belum dibaca. */
export async function countUnread(userId) {
  return notificationRepository.countUnread(userId);
}

/** Menandai satu notifikasi sebagai sudah dibaca. */
export async function markAsRead(userId, notificationId) {
  const notification = await notificationRepository.findByIdAndUser(notificationId, userId);
  if (!notification) {
    throw new NotFoundError('Notifikasi tidak ditemukan', ERROR_CODES.NOT_FOUND);
  }

  await notificationRepository.markAsRead(notificationId, userId);
  const terbaru = await notificationRepository.findByIdAndUser(notificationId, userId);
  return toNotificationResponse(terbaru);
}

/** Menandai seluruh notifikasi sebagai sudah dibaca. */
export async function markAllAsRead(userId) {
  const jumlah = await notificationRepository.markAllAsRead(userId);
  return { markedCount: jumlah, unreadCount: await notificationRepository.countUnread(userId) };
}

/** Mendaftarkan token perangkat agar dapat menerima pesan push. */
export async function registerDevice(userId, { token, platform }) {
  await deviceTokenRepository.register({ userId, token, platform });
  return { registered: true };
}

/** Mencabut pendaftaran sebuah token perangkat. */
export async function unregisterDevice(userId, token) {
  const tokens = await deviceTokenRepository.findTokensByUser(userId);
  if (!tokens.includes(token)) {
    throw new NotFoundError('Perangkat tidak ditemukan', ERROR_CODES.NOT_FOUND);
  }
  await deviceTokenRepository.remove(token);
  return { unregistered: true };
}

/**
 * Menyimpan notifikasi lalu mengirimkannya sebagai pesan push.
 *
 * Kegagalan pada tahap mana pun hanya dicatat, tidak dilempar, karena notifikasi
 * merupakan pelengkap dari tindakan yang memicunya. Pesanan tidak boleh gagal
 * hanya karena pemberitahuannya tidak terkirim.
 */
export async function notify({ userId, type, title, body, orderId = null, data = {} }) {
  try {
    const notification = await notificationRepository.create({ userId, type, title, body, orderId });

    const tokens = await deviceTokenRepository.findTokensByUser(userId);
    if (tokens.length === 0) return notification;

    const hasil = await sendToTokens(tokens, {
      title,
      body,
      data: { ...data, type, notificationId: notification.id, orderId: orderId ?? '' },
    });

    // Token yang ditolak Firebase dibersihkan agar tidak dicoba terus-menerus.
    if (hasil.staleTokens.length > 0) {
      await deviceTokenRepository.removeMany(hasil.staleTokens);
      logger.info(`${hasil.staleTokens.length} token perangkat kedaluwarsa dibersihkan.`);
    }

    return notification;
  } catch (error) {
    logger.error('Notifikasi gagal disampaikan:', error?.message ?? error);
    return null;
  }
}
