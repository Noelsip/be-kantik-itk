import { query, queryOne, execute } from '../config/database.js';
import { resolvePagination } from '../utils/pagination.js';

/**
 * Fungsi untuk mengakses data tabel `orders` dan `order_items`.
 *
 * Setiap pembacaan yang dapat dijangkau pembeli maupun penjual selalu menyertakan
 * id pemiliknya pada klausa WHERE, sehingga baris milik orang lain tidak pernah
 * ikut terambil sejak awal.
 */

const ORDER_COLUMNS = `
  o.id, o.user_id, o.canteen_id, o.order_number, o.status, o.note,
  o.reject_reason, o.total_amount, o.created_at, o.updated_at,
  c.name AS canteen_name, c.location AS canteen_location, c.image_url AS canteen_image_url,
  u.name AS buyer_name, u.campus_id AS buyer_campus_id, u.email AS buyer_email
`;

const ORDER_FROM = `
  FROM orders o
  JOIN canteens c ON c.id = o.canteen_id
  JOIN users u    ON u.id = o.user_id
`;

/** Mengambil satu pesanan berdasarkan id. */
export async function findById(id, connection) {
  return queryOne(`SELECT ${ORDER_COLUMNS} ${ORDER_FROM} WHERE o.id = ? LIMIT 1`, [id], connection);
}

/** Mengambil pesanan hanya bila milik pembeli yang bersangkutan. */
export async function findByIdAndUser(id, userId, connection) {
  return queryOne(
    `SELECT ${ORDER_COLUMNS} ${ORDER_FROM} WHERE o.id = ? AND o.user_id = ? LIMIT 1`,
    [id, userId],
    connection,
  );
}

/** Mengambil pesanan hanya bila masuk ke kantin milik penjual yang bersangkutan. */
export async function findByIdAndCanteenOwner(id, ownerId, connection) {
  return queryOne(
    `SELECT ${ORDER_COLUMNS} ${ORDER_FROM} WHERE o.id = ? AND c.owner_id = ? LIMIT 1`,
    [id, ownerId],
    connection,
  );
}

/**
 * Mengambil sekaligus mengunci baris pesanan untuk perubahan status.
 * Cakupan ditentukan oleh `userId` untuk pembeli atau `ownerId` untuk penjual.
 */
export async function findForStatusUpdate(id, scope, connection) {
  if (scope.ownerId !== undefined) {
    return queryOne(
      `SELECT o.id, o.status, o.user_id, o.canteen_id
         FROM orders o
         JOIN canteens c ON c.id = o.canteen_id
        WHERE o.id = ? AND c.owner_id = ?
        FOR UPDATE`,
      [id, scope.ownerId],
      connection,
    );
  }

  return queryOne(
    `SELECT o.id, o.status, o.user_id, o.canteen_id
       FROM orders o
      WHERE o.id = ? AND o.user_id = ?
      FOR UPDATE`,
    [id, scope.userId],
    connection,
  );
}

/** Mengambil seluruh baris item dari satu pesanan. */
export async function findItemsByOrderId(orderId, connection) {
  return query(
    `SELECT id, order_id, menu_item_id, menu_name, price, quantity, subtotal, created_at
       FROM order_items
      WHERE order_id = ?
      ORDER BY id ASC`,
    [orderId],
    connection,
  );
}

/** Mengambil item dari banyak pesanan sekaligus, menghindari kueri berulang. */
export async function findItemsByOrderIds(orderIds, connection) {
  if (orderIds.length === 0) return [];
  const placeholders = orderIds.map(() => '?').join(', ');
  return query(
    `SELECT id, order_id, menu_item_id, menu_name, price, quantity, subtotal, created_at
       FROM order_items
      WHERE order_id IN (${placeholders})
      ORDER BY order_id ASC, id ASC`,
    orderIds,
    connection,
  );
}

/** Mengambil daftar pesanan untuk cakupan pembeli maupun penjual. */
export async function findAll(filters = {}, connection) {
  const { userId, ownerId, canteenId, statuses } = filters;
  const pagination = resolvePagination(filters);

  const conditions = [];
  const params = [];

  if (userId !== undefined) {
    conditions.push('o.user_id = ?');
    params.push(userId);
  }
  if (ownerId !== undefined) {
    conditions.push('c.owner_id = ?');
    params.push(ownerId);
  }
  if (canteenId !== undefined) {
    conditions.push('o.canteen_id = ?');
    params.push(canteenId);
  }
  if (statuses?.length) {
    conditions.push(`o.status IN (${statuses.map(() => '?').join(', ')})`);
    params.push(...statuses);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const totalRow = await queryOne(
    `SELECT COUNT(*) AS total ${ORDER_FROM} ${where}`,
    params,
    connection,
  );

  const rows = await query(
    `SELECT ${ORDER_COLUMNS} ${ORDER_FROM} ${where}
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
    params,
    connection,
  );

  return { rows, total: Number(totalRow?.total ?? 0), pagination };
}

/** Memeriksa apakah sebuah nomor pesanan sudah terpakai. */
export async function orderNumberExists(orderNumber, connection) {
  const row = await queryOne('SELECT id FROM orders WHERE order_number = ? LIMIT 1', [orderNumber], connection);
  return row !== null;
}

/** Membuat baris pesanan baru. */
export async function createOrder(
  { userId, canteenId, orderNumber, note = null, totalAmount },
  connection,
) {
  const result = await execute(
    `INSERT INTO orders (user_id, canteen_id, order_number, note, total_amount)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, canteenId, orderNumber, note, totalAmount],
    connection,
  );
  return result.insertId;
}

/**
 * Membuat baris-baris item pesanan sekaligus.
 * Setiap baris menyimpan salinan nama dan harga menu saat pesanan dibuat,
 * sehingga perubahan menu di kemudian hari tidak mengubah riwayat.
 */
export async function createOrderItems(orderId, items, connection) {
  if (items.length === 0) return 0;

  const placeholders = items.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
  const params = items.flatMap((item) => [
    orderId,
    item.menuItemId,
    item.menuName,
    item.price,
    item.quantity,
    item.subtotal,
  ]);

  const result = await execute(
    `INSERT INTO order_items (order_id, menu_item_id, menu_name, price, quantity, subtotal)
     VALUES ${placeholders}`,
    params,
    connection,
  );
  return result.affectedRows;
}

/** Mengubah status pesanan, beserta alasan penolakan bila ada. */
export async function updateStatus(id, status, { rejectReason } = {}, connection) {
  if (rejectReason !== undefined) {
    await execute(
      'UPDATE orders SET status = ?, reject_reason = ? WHERE id = ?',
      [status, rejectReason, id],
      connection,
    );
  } else {
    await execute('UPDATE orders SET status = ? WHERE id = ?', [status, id], connection);
  }
  return findById(id, connection);
}

/** Menghitung jumlah pesanan per status untuk dasbor penjual. */
export async function countByStatusForOwner(ownerId, connection) {
  const rows = await query(
    `SELECT o.status, COUNT(*) AS total
       FROM orders o
       JOIN canteens c ON c.id = o.canteen_id
      WHERE c.owner_id = ?
      GROUP BY o.status`,
    [ownerId],
    connection,
  );

  return rows.reduce((counts, row) => {
    counts[row.status] = Number(row.total);
    return counts;
  }, {});
}
