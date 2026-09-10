import { withTransaction } from '../config/database.js';
import ERROR_CODES from '../constants/errorCodes.js';
import { BusinessRuleError, NotFoundError } from '../utils/errors.js';
import {
  ORDER_STATUS,
  ORDER_ACTIVE_STATUSES,
  ORDER_HISTORY_STATUSES,
  BUYER_CANCELLABLE_STATUSES,
  canTransition,
  formatStatus,
} from '../constants/orderStatus.js';
import { calculateSubtotalMinor, sumMinor, toDecimalString, toMinorUnits } from '../utils/money.js';
import { generateOrderNumber } from '../utils/orderNumber.js';
import { buildPaginationMeta } from '../utils/response.js';
import { toOrderResponse } from '../utils/presenters.js';
import * as cartRepository from '../repositories/cart.repository.js';
import * as orderRepository from '../repositories/order.repository.js';
import * as canteenRepository from '../repositories/canteen.repository.js';
import * as notificationService from './notification.service.js';
import {
  NOTIFICATION_TYPES,
  buildSellerNewOrderMessage,
  buildSellerCancelMessage,
} from '../constants/notificationTypes.js';

/** Fungsi untuk menangani pesanan dari sisi pembeli. */

const MAX_ORDER_NUMBER_ATTEMPTS = 5;

/**
 * Menyiapkan nomor pesanan yang belum terpakai.
 * Keunikan sesungguhnya dijamin indeks unik di database.
 */
async function allocateOrderNumber(connection) {
  for (let attempt = 0; attempt < MAX_ORDER_NUMBER_ATTEMPTS; attempt += 1) {
    const candidate = generateOrderNumber();
    if (!(await orderRepository.orderNumberExists(candidate, connection))) {
      return candidate;
    }
  }
  throw new BusinessRuleError('Gagal membuat nomor pesanan. Silakan coba lagi.', ERROR_CODES.CONFLICT);
}

/**
 * Mengubah isi keranjang menjadi pesanan.
 *
 * Keranjang boleh memuat menu dari beberapa kantin, sehingga isinya dipecah
 * menjadi satu pesanan untuk tiap kantin. Seluruhnya berjalan dalam satu
 * transaksi, sehingga kegagalan pada salah satu kantin membatalkan semuanya.
 *
 * Harga dan total dihitung di sini, bukan diambil dari permintaan.
 */
export async function checkout(userId, { note = null } = {}) {
  const { orders, pemberitahuan } = await withTransaction(async (connection) => {
    const cart = await cartRepository.findOrCreateCartByUserId(userId, connection);

    // Penguncian baris menjaga harga dan ketersediaan tidak berubah antara
    // pemeriksaan dan penyimpanan.
    const items = await cartRepository.findItemsByCartIdForUpdate(cart.id, connection);

    if (items.length === 0) {
      throw new BusinessRuleError('Keranjang masih kosong', ERROR_CODES.CART_EMPTY, { statusCode: 422 });
    }

    const deletedItem = items.find((item) => item.deleted_at !== null);
    if (deletedItem) {
      throw new BusinessRuleError(
        `Menu "${deletedItem.menu_name}" sudah tidak tersedia. Perbarui keranjang Anda.`,
        ERROR_CODES.MENU_NOT_FOUND,
        { statusCode: 422 },
      );
    }

    const unavailableItem = items.find((item) => !Number(item.is_available));
    if (unavailableItem) {
      throw new BusinessRuleError(
        `Menu "${unavailableItem.menu_name}" sedang tidak tersedia. Perbarui keranjang Anda.`,
        ERROR_CODES.MENU_UNAVAILABLE,
        { statusCode: 422 },
      );
    }

    // Isi keranjang dikelompokkan per kantin, lalu tiap kelompok menjadi satu
    // pesanan tersendiri.
    const grouped = new Map();
    for (const item of items) {
      const canteenId = Number(item.canteen_id);
      if (!grouped.has(canteenId)) grouped.set(canteenId, []);
      grouped.get(canteenId).push(item);
    }

    const orders = [];
    const pemberitahuan = [];

    for (const [canteenId, groupItems] of grouped) {
      const canteen = await canteenRepository.findById(canteenId, connection);
      if (!canteen) {
        throw new NotFoundError('Kantin tidak ditemukan', ERROR_CODES.CANTEEN_NOT_FOUND);
      }
      if (!Number(canteen.is_open)) {
        throw new BusinessRuleError(
          `${canteen.name} sedang tutup. Pesanan tidak dapat dibuat saat ini.`,
          ERROR_CODES.CANTEEN_CLOSED,
          { statusCode: 422 },
        );
      }

      // Menyalin nama dan harga menu apa adanya saat ini, lalu menghitung setiap
      // subtotal dan totalnya di sisi server.
      const orderItems = groupItems.map((item) => {
        const quantity = Number(item.quantity);
        const priceMinor = toMinorUnits(item.price);
        const subtotalMinor = calculateSubtotalMinor(item.price, quantity);
        return {
          menuItemId: Number(item.menu_item_id),
          menuName: item.menu_name,
          price: toDecimalString(priceMinor),
          quantity,
          // Catatan per menu ikut disalin agar riwayat pesanan tetap lengkap.
          note: item.note ?? null,
          subtotal: toDecimalString(subtotalMinor),
          subtotalMinor,
        };
      });

      const totalMinor = sumMinor(orderItems.map((item) => item.subtotalMinor));

      const orderNumber = await allocateOrderNumber(connection);
      const orderId = await orderRepository.createOrder(
        {
          userId,
          canteenId,
          orderNumber,
          note,
          totalAmount: toDecimalString(totalMinor),
        },
        connection,
      );

      await orderRepository.createOrderItems(orderId, orderItems, connection);

      const order = await orderRepository.findById(orderId, connection);
      const savedItems = await orderRepository.findItemsByOrderId(orderId, connection);
      orders.push(toOrderResponse(order, savedItems));
      pemberitahuan.push({ ownerId: Number(canteen.owner_id), order });
    }

    // Keranjang baru dikosongkan setelah seluruh pesanan tersimpan.
    await cartRepository.clearCart(cart.id, connection);

    return { orders, pemberitahuan };
  });

  // Pemberitahuan dikirim sesudah transaksi disimpan, sehingga tidak pernah
  // merujuk pesanan yang ternyata batal tersimpan.
  for (const { ownerId, order } of pemberitahuan) {
    await notificationService.notify({
      userId: ownerId,
      type: NOTIFICATION_TYPES.ORDER_CREATED,
      orderId: Number(order.id),
      ...buildSellerNewOrderMessage(order, order.buyer_name),
    });
  }

  return orders;
}

/** Mengambil daftar pesanan milik seorang pembeli. */
export async function listBuyerOrders(userId, filters = {}) {
  const statuses = filters.status
    ? [filters.status]
    : filters.scope === 'active'
      ? [...ORDER_ACTIVE_STATUSES]
      : filters.scope === 'history'
        ? [...ORDER_HISTORY_STATUSES]
        : undefined;

  const { rows, total, pagination } = await orderRepository.findAll({
    userId,
    statuses,
    page: filters.page,
    limit: filters.limit,
  });

  const itemRows = await orderRepository.findItemsByOrderIds(rows.map((row) => Number(row.id)));
  const itemsByOrder = groupItemsByOrder(itemRows);

  return {
    orders: rows.map((row) => toOrderResponse(row, itemsByOrder.get(Number(row.id)) ?? [])),
    meta: buildPaginationMeta({ page: pagination.page, limit: pagination.limit, total }),
  };
}

/** Mengelompokkan baris item berdasarkan pesanan asalnya. */
export function groupItemsByOrder(itemRows) {
  const map = new Map();
  for (const item of itemRows) {
    const key = Number(item.order_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

/** Mengambil satu pesanan milik pembeli yang bersangkutan. */
export async function getBuyerOrder(userId, orderId) {
  const order = await orderRepository.findByIdAndUser(orderId, userId);
  if (!order) {
    throw new NotFoundError('Pesanan tidak ditemukan', ERROR_CODES.ORDER_NOT_FOUND);
  }
  const items = await orderRepository.findItemsByOrderId(order.id);
  return toOrderResponse(order, items);
}

/**
 * Membatalkan pesanan milik pembeli sendiri.
 * Pembatalan hanya mungkin selama pesanan belum diterima penjual.
 */
export async function cancelOrder(userId, orderId) {
  const { hasil, pemberitahuan } = await withTransaction(async (connection) => {
    const order = await orderRepository.findForStatusUpdate(orderId, { userId }, connection);
    if (!order) {
      throw new NotFoundError('Pesanan tidak ditemukan', ERROR_CODES.ORDER_NOT_FOUND);
    }

    if (!BUYER_CANCELLABLE_STATUSES.includes(order.status)) {
      throw new BusinessRuleError(
        `Pesanan dengan status ${formatStatus(order.status)} tidak dapat dibatalkan`,
        ERROR_CODES.ORDER_NOT_CANCELLABLE,
      );
    }

    // Pemeriksaan tambahan lewat aturan perpindahan status yang sama.
    if (!canTransition(order.status, ORDER_STATUS.DIBATALKAN)) {
      throw new BusinessRuleError(
        `Pesanan tidak dapat diubah dari ${formatStatus(order.status)} menjadi ${formatStatus(ORDER_STATUS.DIBATALKAN)}`,
        ERROR_CODES.INVALID_ORDER_STATUS_TRANSITION,
      );
    }

    const updated = await orderRepository.updateStatus(orderId, ORDER_STATUS.DIBATALKAN, {}, connection);
    const items = await orderRepository.findItemsByOrderId(orderId, connection);

    const canteen = await canteenRepository.findById(updated.canteen_id, connection);

    return {
      hasil: toOrderResponse(updated, items),
      pemberitahuan: canteen ? { ownerId: Number(canteen.owner_id), order: updated } : null,
    };
  });

  if (pemberitahuan) {
    await notificationService.notify({
      userId: pemberitahuan.ownerId,
      type: NOTIFICATION_TYPES.ORDER_CANCELLED,
      orderId: Number(pemberitahuan.order.id),
      ...buildSellerCancelMessage(pemberitahuan.order, pemberitahuan.order.buyer_name),
    });
  }

  return hasil;
}
