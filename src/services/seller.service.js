import { withTransaction } from '../config/database.js';
import ERROR_CODES from '../constants/errorCodes.js';
import { BusinessRuleError, ConflictError, NotFoundError } from '../utils/errors.js';
import { ORDER_STATUS, ORDER_ACTIVE_STATUSES, canTransition, formatStatus } from '../constants/orderStatus.js';
import { toDecimalString, toMinorUnits } from '../utils/money.js';
import { buildPaginationMeta } from '../utils/response.js';
import { toMenuResponse, toOwnedCanteenResponse, toSellerOrderResponse } from '../utils/presenters.js';
import * as canteenRepository from '../repositories/canteen.repository.js';
import * as menuRepository from '../repositories/menu.repository.js';
import * as orderRepository from '../repositories/order.repository.js';
import * as categoryRepository from '../repositories/category.repository.js';
import { groupItemsByOrder } from './order.service.js';

/**
 * Fungsi untuk menangani kebutuhan penjual.
 *
 * Setiap fungsi menerima id penjual yang sedang masuk dan meneruskannya ke
 * klausa WHERE, sehingga penjual yang menebak id milik orang lain hanya akan
 * menerima jawaban tidak ditemukan.
 */

/** Mengambil kantin milik penjual, atau menolak bila penjual belum memilikinya. */
export async function requireOwnCanteen(ownerId, connection) {
  const canteen = await canteenRepository.findByOwnerId(ownerId, connection);
  if (!canteen) {
    throw new NotFoundError(
      'Anda belum memiliki kantin. Silakan buat kantin Anda terlebih dahulu.',
      ERROR_CODES.SELLER_HAS_NO_CANTEEN,
    );
  }
  return canteen;
}

/** Mengambil data kantin milik penjual. */
export async function getOwnCanteen(ownerId) {
  const canteen = await requireOwnCanteen(ownerId);
  return toOwnedCanteenResponse(canteen);
}

/**
 * Membuat kantin milik penjual sendiri.
 *
 * Sistem tidak memiliki peran admin yang dapat membuatkan kantin, sehingga
 * penjual menyiapkannya sendiri, dibatasi satu kantin per penjual.
 */
export async function createOwnCanteen(ownerId, input) {
  return withTransaction(async (connection) => {
    const existing = await canteenRepository.findByOwnerId(ownerId, connection);
    if (existing) {
      throw new ConflictError('Anda sudah memiliki kantin. Silakan ubah data kantin yang sudah ada.');
    }
    const canteen = await canteenRepository.create({ ownerId, ...input }, connection);
    return toOwnedCanteenResponse(canteen);
  });
}

/** Memperbarui data kantin milik penjual. */
export async function updateOwnCanteen(ownerId, input) {
  return withTransaction(async (connection) => {
    const canteen = await requireOwnCanteen(ownerId, connection);
    const updated = await canteenRepository.update(canteen.id, input, connection);
    return toOwnedCanteenResponse(updated);
  });
}

/** Mengambil daftar menu milik kantin penjual. */
export async function listOwnMenu(ownerId, filters = {}) {
  const canteen = await requireOwnCanteen(ownerId);

  const { rows, total, pagination } = await menuRepository.findAll({
    ...filters,
    canteenId: Number(canteen.id),
  });

  return {
    canteen: toOwnedCanteenResponse(canteen),
    menu: rows.map(toMenuResponse),
    meta: buildPaginationMeta({ page: pagination.page, limit: pagination.limit, total }),
  };
}

/** Mengambil satu menu milik kantin penjual. */
export async function getOwnMenuItem(ownerId, menuId) {
  const menu = await menuRepository.findByIdAndOwner(menuId, ownerId);
  if (!menu) {
    throw new NotFoundError('Menu tidak ditemukan', ERROR_CODES.MENU_NOT_FOUND);
  }
  return toMenuResponse(menu);
}

/** Memastikan kategori yang dirujuk memang ada. */
async function assertCategoryExists(categoryId, connection) {
  if (categoryId === undefined || categoryId === null) return;
  const category = await categoryRepository.findById(categoryId, connection);
  if (!category) {
    throw new NotFoundError('Kategori tidak ditemukan', ERROR_CODES.CATEGORY_NOT_FOUND);
  }
}

/**
 * Membuat menu baru pada kantin penjual.
 * Kantin tujuan diambil dari akun penjual, bukan dari isi permintaan.
 */
export async function createMenuItem(ownerId, input) {
  return withTransaction(async (connection) => {
    const canteen = await requireOwnCanteen(ownerId, connection);
    await assertCategoryExists(input.categoryId, connection);

    const menu = await menuRepository.create(
      {
        ...input,
        canteenId: Number(canteen.id),
        price: toDecimalString(toMinorUnits(input.price)),
      },
      connection,
    );
    return toMenuResponse(menu);
  });
}

/** Memperbarui menu milik kantin penjual. */
export async function updateMenuItem(ownerId, menuId, input) {
  return withTransaction(async (connection) => {
    const existing = await menuRepository.findByIdAndOwner(menuId, ownerId, connection);
    if (!existing) {
      throw new NotFoundError('Menu tidak ditemukan', ERROR_CODES.MENU_NOT_FOUND);
    }
    await assertCategoryExists(input.categoryId, connection);

    const changes = { ...input };
    if (changes.price !== undefined) {
      changes.price = toDecimalString(toMinorUnits(changes.price));
    }

    const menu = await menuRepository.update(existing.id, changes, connection);
    return toMenuResponse(menu);
  });
}

/**
 * Menghapus menu milik kantin penjual.
 *
 * Penghapusan dilakukan dengan penandaan, sehingga riwayat pesanan tetap dapat
 * dibaca sementara menu hilang dari seluruh daftar dan keranjang.
 */
export async function deleteMenuItem(ownerId, menuId) {
  return withTransaction(async (connection) => {
    const existing = await menuRepository.findByIdAndOwner(menuId, ownerId, connection);
    if (!existing) {
      throw new NotFoundError('Menu tidak ditemukan', ERROR_CODES.MENU_NOT_FOUND);
    }

    await menuRepository.softDelete(existing.id, connection);
    const removedFromCarts = await menuRepository.removeFromAllCarts(existing.id, connection);

    return { id: Number(existing.id), name: existing.name, removedFromCarts };
  });
}

/** Mengambil daftar pesanan yang masuk ke kantin penjual. */
export async function listIncomingOrders(ownerId, filters = {}) {
  const statuses = filters.status
    ? [filters.status]
    : filters.scope === 'active'
      ? [...ORDER_ACTIVE_STATUSES]
      : undefined;

  const { rows, total, pagination } = await orderRepository.findAll({
    ownerId,
    statuses,
    page: filters.page,
    limit: filters.limit,
  });

  const itemRows = await orderRepository.findItemsByOrderIds(rows.map((row) => Number(row.id)));
  const itemsByOrder = groupItemsByOrder(itemRows);

  return {
    orders: rows.map((row) => toSellerOrderResponse(row, itemsByOrder.get(Number(row.id)) ?? [])),
    meta: buildPaginationMeta({ page: pagination.page, limit: pagination.limit, total }),
  };
}

/** Mengambil satu pesanan yang masuk ke kantin penjual. */
export async function getIncomingOrder(ownerId, orderId) {
  const order = await orderRepository.findByIdAndCanteenOwner(orderId, ownerId);
  if (!order) {
    throw new NotFoundError('Pesanan tidak ditemukan', ERROR_CODES.ORDER_NOT_FOUND);
  }
  const items = await orderRepository.findItemsByOrderId(order.id);
  return toSellerOrderResponse(order, items);
}

/**
 * Mengubah status pesanan sebagai satu-satunya jalur bagi seluruh tindakan
 * penjual, sehingga keputusan boleh atau tidaknya perpindahan hanya berasal
 * dari satu aturan.
 */
export async function transitionOrderStatus(ownerId, orderId, nextStatus, options = {}) {
  return withTransaction(async (connection) => {
    // Pencarian dibatasi pemilik sekaligus mengunci baris, sehingga dua penjual
    // tidak dapat mengubah pesanan yang sama secara bersamaan.
    const order = await orderRepository.findForStatusUpdate(orderId, { ownerId }, connection);
    if (!order) {
      throw new NotFoundError('Pesanan tidak ditemukan', ERROR_CODES.ORDER_NOT_FOUND);
    }

    if (!canTransition(order.status, nextStatus)) {
      throw new BusinessRuleError(
        `Pesanan tidak dapat diubah dari ${formatStatus(order.status)} menjadi ${formatStatus(nextStatus)}`,
        ERROR_CODES.INVALID_ORDER_STATUS_TRANSITION,
        { details: { currentStatus: order.status, requestedStatus: nextStatus } },
      );
    }

    const updateOptions =
      nextStatus === ORDER_STATUS.DITOLAK ? { rejectReason: options.rejectReason ?? null } : {};

    const updated = await orderRepository.updateStatus(orderId, nextStatus, updateOptions, connection);
    const items = await orderRepository.findItemsByOrderId(orderId, connection);
    return toSellerOrderResponse(updated, items);
  });
}

/** Menyusun ringkasan dasbor penjual beserta pesanan terbaru. */
export async function getDashboard(ownerId) {
  const canteen = await requireOwnCanteen(ownerId);
  const counts = await orderRepository.countByStatusForOwner(ownerId);

  const { rows } = await orderRepository.findAll({ ownerId, page: 1, limit: 10 });
  const itemRows = await orderRepository.findItemsByOrderIds(rows.map((row) => Number(row.id)));
  const itemsByOrder = groupItemsByOrder(itemRows);

  return {
    canteen: toOwnedCanteenResponse(canteen),
    summary: {
      pesananBaru: counts[ORDER_STATUS.MENUNGGU_KONFIRMASI] ?? 0,
      diterima: counts[ORDER_STATUS.DITERIMA] ?? 0,
      diproses: counts[ORDER_STATUS.DIPROSES] ?? 0,
      siapDiambil: counts[ORDER_STATUS.SIAP_DIAMBIL] ?? 0,
      selesai: counts[ORDER_STATUS.SELESAI] ?? 0,
      ditolak: counts[ORDER_STATUS.DITOLAK] ?? 0,
      dibatalkan: counts[ORDER_STATUS.DIBATALKAN] ?? 0,
    },
    recentOrders: rows.map((row) => toSellerOrderResponse(row, itemsByOrder.get(Number(row.id)) ?? [])),
  };
}
