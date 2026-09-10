import { AuthenticationError } from '../utils/errors.js';
import { toUserResponse } from '../utils/presenters.js';
import * as userRepository from '../repositories/user.repository.js';
import * as orderRepository from '../repositories/order.repository.js';
import * as menuRepository from '../repositories/menu.repository.js';
import * as favoriteRepository from '../repositories/favorite.repository.js';
import { ROLES } from '../constants/roles.js';
import {
  ORDER_STATUS,
  ORDER_ACTIVE_STATUSES,
  ORDER_HISTORY_STATUSES,
} from '../constants/orderStatus.js';

/**
 * Fungsi untuk membaca dan memperbarui profil pengguna.
 * Hanya nama dan foto profil yang dapat diubah; sisanya penentu hak akses.
 */

/** Mengambil profil pengguna yang sedang masuk. */
export async function getProfile(userId) {
  const user = await userRepository.findById(userId);
  if (!user) throw new AuthenticationError('Akun tidak ditemukan.');
  return toUserResponse(user);
}

/** Memperbarui profil pengguna yang sedang masuk. */
export async function updateProfile(userId, { name, profileImage, whatsapp }) {
  const user = await userRepository.updateProfile(userId, { name, profileImage, whatsapp });
  if (!user) throw new AuthenticationError('Akun tidak ditemukan.');
  return toUserResponse(user);
}

/** Menjumlahkan pesanan pada sekumpulan status. */
function jumlahkan(counts, statuses) {
  return statuses.reduce((total, status) => total + (counts[status] ?? 0), 0);
}

/**
 * Menyusun ringkasan angka untuk halaman profil.
 *
 * Dihitung langsung lewat COUNT di database, sehingga aplikasi tidak perlu
 * mengunduh seluruh pesanan hanya untuk menampilkan beberapa angka.
 */
export async function getStats(user) {
  const isPenjual = user.role === ROLES.PENJUAL;

  const counts = isPenjual
    ? await orderRepository.countByStatusForOwner(user.id)
    : await orderRepository.countByStatusForUser(user.id);

  const orders = {
    total: Object.values(counts).reduce((total, jumlah) => total + jumlah, 0),
    active: jumlahkan(counts, [...ORDER_ACTIVE_STATUSES]),
    completed: counts[ORDER_STATUS.SELESAI] ?? 0,
    rejected: counts[ORDER_STATUS.DITOLAK] ?? 0,
    cancelled: counts[ORDER_STATUS.DIBATALKAN] ?? 0,
    history: jumlahkan(counts, [...ORDER_HISTORY_STATUSES]),
  };

  if (isPenjual) {
    return { role: user.role, orders, menuCount: await menuRepository.countActiveByOwner(user.id) };
  }

  return { role: user.role, orders, favoriteCount: await favoriteRepository.countByUser(user.id) };
}
