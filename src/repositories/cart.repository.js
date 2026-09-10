import { query, queryOne, execute } from '../config/database.js';

/**
 * Fungsi untuk mengakses data tabel `carts` dan `cart_items`.
 * Satu pembeli hanya punya satu keranjang, dijamin batasan unik `carts.user_id`.
 */

/** Mengambil keranjang milik seorang pembeli. */
export async function findCartByUserId(userId, connection) {
  return queryOne(
    'SELECT id, user_id, created_at, updated_at FROM carts WHERE user_id = ? LIMIT 1',
    [userId],
    connection,
  );
}

/**
 * Mengambil keranjang pembeli, dan membuatnya bila belum ada.
 * Penyisipan aman diulang sehingga permintaan bersamaan tidak bertabrakan.
 */
export async function findOrCreateCartByUserId(userId, connection) {
  const existing = await findCartByUserId(userId, connection);
  if (existing) return existing;

  await execute(
    'INSERT INTO carts (user_id) VALUES (?) ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP',
    [userId],
    connection,
  );
  return findCartByUserId(userId, connection);
}

/**
 * Mengambil isi keranjang beserta data menu dan kantin terkini.
 * Menu yang sudah ditandai terhapus tidak ikut terbawa.
 */
export async function findItemsByCartId(cartId, connection) {
  return query(
    `SELECT ci.id, ci.cart_id, ci.menu_item_id, ci.quantity, ci.created_at, ci.updated_at,
            m.name AS menu_name, m.price, m.image_url, m.is_available, m.canteen_id,
            ci.note, m.category_id, cat.name AS category_name,
            c.name AS canteen_name, c.is_open AS canteen_is_open
       FROM cart_items ci
       JOIN menu_items m ON m.id = ci.menu_item_id AND m.deleted_at IS NULL
       JOIN canteens c   ON c.id = m.canteen_id
       LEFT JOIN categories cat ON cat.id = m.category_id
      WHERE ci.cart_id = ?
      ORDER BY ci.created_at ASC, ci.id ASC`,
    [cartId],
    connection,
  );
}

/**
 * Mengambil sekaligus mengunci isi keranjang untuk proses pembuatan pesanan,
 * sehingga harga dan ketersediaan menu tidak berubah di tengah transaksi.
 */
export async function findItemsByCartIdForUpdate(cartId, connection) {
  return query(
    `SELECT ci.id, ci.menu_item_id, ci.quantity, ci.note,
            m.name AS menu_name, m.price, m.is_available, m.canteen_id, m.deleted_at
       FROM cart_items ci
       JOIN menu_items m ON m.id = ci.menu_item_id
      WHERE ci.cart_id = ?
      ORDER BY ci.id ASC
      FOR UPDATE`,
    [cartId],
    connection,
  );
}

/**
 * Mengambil id kantin asal isi keranjang, atau null bila keranjang kosong.
 * Nilai inilah yang menjadi dasar aturan satu keranjang satu kantin.
 */
export async function findCartCanteenId(cartId, connection) {
  const row = await queryOne(
    `SELECT m.canteen_id
       FROM cart_items ci
       JOIN menu_items m ON m.id = ci.menu_item_id AND m.deleted_at IS NULL
      WHERE ci.cart_id = ?
      LIMIT 1`,
    [cartId],
    connection,
  );
  return row ? Number(row.canteen_id) : null;
}

/** Mengambil satu item keranjang berdasarkan id. */
export async function findItemById(id, connection) {
  return queryOne(
    'SELECT id, cart_id, menu_item_id, quantity FROM cart_items WHERE id = ? LIMIT 1',
    [id],
    connection,
  );
}

/** Mengambil item keranjang hanya bila berada di keranjang yang bersangkutan. */
export async function findItemByIdAndCart(id, cartId, connection) {
  return queryOne(
    'SELECT id, cart_id, menu_item_id, quantity FROM cart_items WHERE id = ? AND cart_id = ? LIMIT 1',
    [id, cartId],
    connection,
  );
}

/** Mengambil item keranjang berdasarkan menu yang dirujuk. */
export async function findItemByMenu(cartId, menuItemId, connection) {
  return queryOne(
    'SELECT id, cart_id, menu_item_id, quantity FROM cart_items WHERE cart_id = ? AND menu_item_id = ? LIMIT 1',
    [cartId, menuItemId],
    connection,
  );
}

/**
 * Menambahkan menu ke keranjang, atau menambah jumlahnya bila menu tersebut
 * sudah ada. Perilaku ini bersandar pada indeks unik (cart_id, menu_item_id).
 */
export async function addItem({ cartId, menuItemId, quantity, note = null }, connection) {
  // Catatan yang dikirim menimpa catatan sebelumnya, sedangkan pengiriman tanpa
  // catatan membiarkan catatan lama tetap ada.
  await execute(
    `INSERT INTO cart_items (cart_id, menu_item_id, quantity, note)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       quantity = quantity + VALUES(quantity),
       note = COALESCE(VALUES(note), note)`,
    [cartId, menuItemId, quantity, note],
    connection,
  );
  return findItemByMenu(cartId, menuItemId, connection);
}

/** Mengubah jumlah pada satu item keranjang. */
export async function updateItem(id, { quantity, note }, connection) {
  const fields = [];
  const params = [];

  if (quantity !== undefined) {
    fields.push('quantity = ?');
    params.push(quantity);
  }
  if (note !== undefined) {
    fields.push('note = ?');
    params.push(note);
  }

  if (fields.length === 0) return findItemById(id, connection);

  params.push(id);
  await execute(`UPDATE cart_items SET ${fields.join(', ')} WHERE id = ?`, params, connection);
  return findItemById(id, connection);
}

/** Menghapus satu item dari keranjang. */
export async function removeItem(id, connection) {
  const result = await execute('DELETE FROM cart_items WHERE id = ?', [id], connection);
  return result.affectedRows > 0;
}

/** Mengosongkan seluruh isi keranjang. */
export async function clearCart(cartId, connection) {
  const result = await execute('DELETE FROM cart_items WHERE cart_id = ?', [cartId], connection);
  return result.affectedRows;
}

/** Menghitung jumlah baris dan total porsi di dalam keranjang. */
export async function countItems(cartId, connection) {
  const row = await queryOne(
    `SELECT COUNT(*) AS item_count, COALESCE(SUM(ci.quantity), 0) AS total_quantity
       FROM cart_items ci
       JOIN menu_items m ON m.id = ci.menu_item_id AND m.deleted_at IS NULL
      WHERE ci.cart_id = ?`,
    [cartId],
    connection,
  );
  return {
    itemCount: Number(row?.item_count ?? 0),
    totalQuantity: Number(row?.total_quantity ?? 0),
  };
}
