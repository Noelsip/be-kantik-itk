import { withTransaction } from '../config/database.js';
import ERROR_CODES from '../constants/errorCodes.js';
import { BusinessRuleError, NotFoundError } from '../utils/errors.js';
import { calculateSubtotalMinor, sumMinor } from '../utils/money.js';
import { toCartItemResponse, toCanteenResponse } from '../utils/presenters.js';
import * as cartRepository from '../repositories/cart.repository.js';
import * as menuRepository from '../repositories/menu.repository.js';
import * as canteenRepository from '../repositories/canteen.repository.js';

/**
 * Fungsi untuk mengatur isi keranjang belanja.
 * Keranjang boleh memuat menu dari beberapa kantin, dan isinya dikelompokkan
 * per kantin karena satu pesanan hanya memuat menu dari satu kantin.
 */

/** Menjumlahkan harga sekumpulan item keranjang dalam satuan terkecil. */
function sumItemsMinor(items) {
  return sumMinor(items.map((item) => calculateSubtotalMinor(item.price, Number(item.quantity))));
}

/** Menghitung jumlah porsi pada sekumpulan item keranjang. */
function sumQuantity(items) {
  return items.reduce((sum, item) => sum + Number(item.quantity), 0);
}

/** Menyusun tampilan keranjang, lengkap dengan pengelompokan per kantin. */
async function buildCartPayload(cart, connection) {
  const items = await cartRepository.findItemsByCartId(cart.id, connection);

  const grouped = new Map();
  for (const item of items) {
    const canteenId = Number(item.canteen_id);
    if (!grouped.has(canteenId)) grouped.set(canteenId, []);
    grouped.get(canteenId).push(item);
  }

  const canteens = [...grouped.entries()].map(([canteenId, groupItems]) => ({
    canteen: {
      id: canteenId,
      name: groupItems[0].canteen_name ?? null,
      isOpen: Boolean(Number(groupItems[0].canteen_is_open)),
    },
    items: groupItems.map(toCartItemResponse),
    itemCount: groupItems.length,
    totalQuantity: sumQuantity(groupItems),
    totalAmount: sumItemsMinor(groupItems) / 100,
  }));

  let singleCanteen = null;
  if (canteens.length === 1) {
    singleCanteen = await canteenRepository.findById(canteens[0].canteen.id, connection);
  }

  return {
    id: Number(cart.id),
    // Berisi kantin tunggal bila keranjang hanya memuat satu kantin, dan null
    // ketika kosong maupun bercampur. Pengelompokan lengkapnya ada di `canteens`.
    canteen: toCanteenResponse(singleCanteen),
    canteenCount: canteens.length,
    canteens,
    items: items.map(toCartItemResponse),
    itemCount: items.length,
    totalQuantity: sumQuantity(items),
    totalAmount: sumItemsMinor(items) / 100,
    // Menandai menu yang berubah menjadi tidak tersedia setelah dimasukkan,
    // agar aplikasi dapat memperingatkan sebelum pesanan dibuat.
    hasUnavailableItem: items.some((item) => !Number(item.is_available)),
  };
}

/** Mengambil isi keranjang milik seorang pembeli. */
export async function getCart(userId) {
  const cart = await cartRepository.findOrCreateCartByUserId(userId);
  return buildCartPayload(cart);
}

/**
 * Menambahkan menu ke keranjang.
 * Menu dari kantin mana pun boleh bercampur, dan pemisahannya menjadi beberapa
 * pesanan dikerjakan pada saat pesanan dibuat.
 */
export async function addItem(userId, { menuItemId, quantity, note = null }) {
  return withTransaction(async (connection) => {
    const menu = await menuRepository.findById(menuItemId, connection);
    if (!menu) {
      throw new NotFoundError('Menu tidak ditemukan', ERROR_CODES.MENU_NOT_FOUND);
    }
    if (!Number(menu.is_available)) {
      throw new BusinessRuleError(
        `Menu "${menu.name}" sedang tidak tersedia`,
        ERROR_CODES.MENU_UNAVAILABLE,
      );
    }

    const cart = await cartRepository.findOrCreateCartByUserId(userId, connection);
    await cartRepository.addItem({ cartId: cart.id, menuItemId, quantity, note }, connection);
    return buildCartPayload(cart, connection);
  });
}

/**
 * Mengubah jumlah maupun catatan salah satu item keranjang.
 * Pencarian dibatasi pada keranjang milik pengguna sendiri.
 */
export async function updateItem(userId, cartItemId, { quantity, note }) {
  return withTransaction(async (connection) => {
    const cart = await cartRepository.findOrCreateCartByUserId(userId, connection);
    const item = await cartRepository.findItemByIdAndCart(cartItemId, cart.id, connection);
    if (!item) {
      throw new NotFoundError('Item keranjang tidak ditemukan', ERROR_CODES.CART_ITEM_NOT_FOUND);
    }

    const menu = await menuRepository.findById(item.menu_item_id, connection);
    if (!menu) {
      // Menu telah dihapus saat masih berada di keranjang, sehingga barisnya ikut dibersihkan.
      await cartRepository.removeItem(item.id, connection);
      throw new NotFoundError(
        'Menu sudah tidak tersedia dan dihapus dari keranjang',
        ERROR_CODES.MENU_NOT_FOUND,
      );
    }
    if (!Number(menu.is_available)) {
      throw new BusinessRuleError(
        `Menu "${menu.name}" sedang tidak tersedia`,
        ERROR_CODES.MENU_UNAVAILABLE,
      );
    }

    await cartRepository.updateItem(item.id, { quantity, note }, connection);
    return buildCartPayload(cart, connection);
  });
}

/** Menghapus satu item dari keranjang. */
export async function removeItem(userId, cartItemId) {
  return withTransaction(async (connection) => {
    const cart = await cartRepository.findOrCreateCartByUserId(userId, connection);
    const item = await cartRepository.findItemByIdAndCart(cartItemId, cart.id, connection);
    if (!item) {
      throw new NotFoundError('Item keranjang tidak ditemukan', ERROR_CODES.CART_ITEM_NOT_FOUND);
    }

    await cartRepository.removeItem(item.id, connection);
    return buildCartPayload(cart, connection);
  });
}

/** Mengosongkan seluruh isi keranjang. */
export async function clearCart(userId) {
  return withTransaction(async (connection) => {
    const cart = await cartRepository.findOrCreateCartByUserId(userId, connection);
    await cartRepository.clearCart(cart.id, connection);
    return buildCartPayload(cart, connection);
  });
}
