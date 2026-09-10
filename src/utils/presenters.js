import { toAmountNumber } from './money.js';
import { ORDER_STATUS_LABELS, BUYER_CANCELLABLE_STATUSES } from '../constants/orderStatus.js';
import { ROLE_LABELS } from '../constants/roles.js';

/**
 * Pengubah baris database menjadi bentuk respons API.
 * Pemusatan di satu berkas menjaga kolom internal seperti `token_version` dan
 * `google_id` tidak ikut terkirim, dan nilai uang selalu berupa angka.
 */

const toBoolean = (value) => Boolean(Number(value));
const toIsoString = (value) => (value instanceof Date ? value.toISOString() : (value ?? null));

export function toUserResponse(user) {
  if (!user) return null;
  return {
    id: Number(user.id),
    campusId: user.campus_id,
    nim: user.nim ?? null,
    name: user.name,
    email: user.email,
    role: user.role,
    roleLabel: ROLE_LABELS[user.role] ?? user.role,
    profileImage: user.profile_image,
    whatsapp: user.whatsapp ?? null,
    affiliation: user.affiliation ?? null,
    faculty: user.faculty ?? null,
    studyProgram: user.study_program ?? null,
    studyProgramCode: user.study_program_code ?? null,
    createdAt: toIsoString(user.created_at),
    updatedAt: toIsoString(user.updated_at),
  };
}

export function toCanteenResponse(canteen) {
  if (!canteen) return null;
  const isOpen = toBoolean(canteen.is_open);
  const response = {
    id: Number(canteen.id),
    name: canteen.name,
    description: canteen.description,
    location: canteen.location,
    imageUrl: canteen.image_url,
    whatsapp: canteen.whatsapp ?? null,
    isOpen,
    statusLabel: isOpen ? 'Buka' : 'Tutup',
    createdAt: toIsoString(canteen.created_at),
    updatedAt: toIsoString(canteen.updated_at),
  };
  if (canteen.menu_count !== undefined) response.menuCount = Number(canteen.menu_count);
  return response;
}

/** Menyusun bentuk kantin untuk penjual pemiliknya, disertai id pemilik. */
export function toOwnedCanteenResponse(canteen) {
  if (!canteen) return null;
  return { ...toCanteenResponse(canteen), ownerId: Number(canteen.owner_id) };
}

export function toCategoryResponse(category) {
  if (!category) return null;
  return {
    id: Number(category.id),
    name: category.name,
    createdAt: toIsoString(category.created_at),
    updatedAt: toIsoString(category.updated_at),
  };
}

export function toMenuResponse(menu) {
  if (!menu) return null;
  const response = {
    id: Number(menu.id),
    canteenId: Number(menu.canteen_id),
    canteenName: menu.canteen_name ?? null,
    canteenIsOpen: menu.canteen_is_open === undefined ? undefined : toBoolean(menu.canteen_is_open),
    category:
      menu.category_id === null || menu.category_id === undefined
        ? null
        : { id: Number(menu.category_id), name: menu.category_name ?? null },
    name: menu.name,
    description: menu.description,
    price: toAmountNumber(menu.price),
    imageUrl: menu.image_url,
    isAvailable: toBoolean(menu.is_available),
    createdAt: toIsoString(menu.created_at),
    updatedAt: toIsoString(menu.updated_at),
  };
  // Penanda favorit hanya ikut terkirim pada jalur yang membacanya untuk pembeli.
  if (menu.is_favorite !== undefined) response.isFavorite = toBoolean(menu.is_favorite);
  return response;
}

export function toCartItemResponse(item) {
  if (!item) return null;
  const price = toAmountNumber(item.price);
  const quantity = Number(item.quantity);
  return {
    id: Number(item.id),
    menuItemId: Number(item.menu_item_id),
    menuName: item.menu_name,
    price,
    quantity,
    subtotal: Number((price * quantity).toFixed(2)),
    note: item.note ?? null,
    imageUrl: item.image_url,
    isAvailable: toBoolean(item.is_available),
    category:
      item.category_id === null || item.category_id === undefined
        ? null
        : { id: Number(item.category_id), name: item.category_name ?? null },
  };
}

/** Menyusun baris pesanan dari salinan nama dan harga saat pesanan dibuat. */
export function toOrderItemResponse(item) {
  if (!item) return null;
  return {
    id: Number(item.id),
    menuItemId: Number(item.menu_item_id),
    menuName: item.menu_name,
    price: toAmountNumber(item.price),
    quantity: Number(item.quantity),
    note: item.note ?? null,
    subtotal: toAmountNumber(item.subtotal),
  };
}

export function toOrderResponse(order, items = []) {
  if (!order) return null;
  return {
    id: Number(order.id),
    orderNumber: order.order_number,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status] ?? order.status,
    isCancellable: BUYER_CANCELLABLE_STATUSES.includes(order.status),
    note: order.note,
    rejectReason: order.reject_reason ?? null,
    totalAmount: toAmountNumber(order.total_amount),
    canteen: {
      id: Number(order.canteen_id),
      name: order.canteen_name ?? null,
      location: order.canteen_location ?? null,
      imageUrl: order.canteen_image_url ?? null,
    },
    items: items.map(toOrderItemResponse),
    itemCount: items.length,
    createdAt: toIsoString(order.created_at),
    updatedAt: toIsoString(order.updated_at),
  };
}

/** Menyusun bentuk pesanan untuk penjual, dilengkapi identitas pemesan. */
export function toSellerOrderResponse(order, items = []) {
  const base = toOrderResponse(order, items);
  if (!base) return null;
  return {
    ...base,
    // Pembatalan merupakan tindakan pembeli, sehingga penanda ini tidak relevan.
    isCancellable: undefined,
    buyer: {
      id: Number(order.user_id),
      name: order.buyer_name ?? null,
      campusId: order.buyer_campus_id ?? null,
      email: order.buyer_email ?? null,
    },
  };
}

/** Menyusun bentuk notifikasi untuk aplikasi. */
export function toNotificationResponse(notification) {
  if (!notification) return null;
  return {
    id: Number(notification.id),
    type: notification.type,
    title: notification.title,
    body: notification.body,
    isRead: notification.read_at !== null,
    readAt: toIsoString(notification.read_at),
    order:
      notification.order_id === null || notification.order_id === undefined
        ? null
        : {
            id: Number(notification.order_id),
            orderNumber: notification.order_number ?? null,
            status: notification.order_status ?? null,
          },
    createdAt: toIsoString(notification.created_at),
  };
}
