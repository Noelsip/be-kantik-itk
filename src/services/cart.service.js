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
 *
 * Aturan bahwa satu keranjang hanya boleh memuat menu dari satu kantin
 * ditegakkan di sini, di dalam transaksi, tanpa mengandalkan pemeriksaan di
 * sisi aplikasi.
 */

/** Menyusun tampilan keranjang lengkap dengan kantin asal dan total harga. */
async function buildCartPayload(cart, connection) {
  const items = await cartRepository.findItemsByCartId(cart.id, connection);

  const totalMinor = sumMinor(
    items.map((item) => calculateSubtotalMinor(item.price, Number(item.quantity))),
  );
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity), 0);

  let canteen = null;
  if (items.length > 0) {
    canteen = await canteenRepository.findById(items[0].canteen_id, connection);
  }

  return {
    id: Number(cart.id),
    canteen: toCanteenResponse(canteen),
    items: items.map(toCartItemResponse),
    itemCount: items.length,
    totalQuantity,
    totalAmount: totalMinor / 100,
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
 *
 * Pilihan `replaceCanteen` mewakili konfirmasi ganti kantin: bila bernilai
 * benar, keranjang dikosongkan lebih dulu ketika menu berasal dari kantin lain.
 */
export async function addItem(userId, { menuItemId, quantity }, { replaceCanteen = false } = {}) {
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
    const existingCanteenId = await cartRepository.findCartCanteenId(cart.id, connection);
    const menuCanteenId = Number(menu.canteen_id);

    if (existingCanteenId !== null && existingCanteenId !== menuCanteenId) {
      if (!replaceCanteen) {
        const currentCanteen = await canteenRepository.findById(existingCanteenId, connection);
        throw new BusinessRuleError(
          `Keranjang berisi menu dari ${currentCanteen?.name ?? 'kantin lain'}. ` +
            'Kosongkan keranjang terlebih dahulu untuk memesan dari kantin berbeda.',
          ERROR_CODES.CART_DIFFERENT_CANTEEN,
          {
            details: {
              currentCanteen: toCanteenResponse(currentCanteen),
              newCanteen: { id: menuCanteenId, name: menu.canteen_name },
            },
          },
        );
      }
      await cartRepository.clearCart(cart.id, connection);
    }

    await cartRepository.addItem({ cartId: cart.id, menuItemId, quantity }, connection);
    return buildCartPayload(cart, connection);
  });
}

/**
 * Mengubah jumlah salah satu item keranjang.
 * Pencarian item dibatasi pada keranjang milik pengguna sendiri, sehingga id
 * milik pengguna lain akan dianggap tidak ditemukan.
 */
export async function updateItemQuantity(userId, cartItemId, quantity) {
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

    await cartRepository.updateItemQuantity(item.id, quantity, connection);
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
