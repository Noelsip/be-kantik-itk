import { query, queryOne, execute } from '../config/database.js';
import { resolvePagination } from '../utils/pagination.js';

/**
 * Fungsi untuk mengakses data tabel `notifications`.
 * Setiap pembacaan selalu dibatasi id pemiliknya pada klausa WHERE.
 */

const SELECT_COLUMNS = `
  n.id, n.user_id, n.type, n.title, n.body, n.order_id, n.read_at, n.created_at,
  o.order_number, o.status AS order_status
`;

const FROM_CLAUSE = `
  FROM notifications n
  LEFT JOIN orders o ON o.id = n.order_id
`;

/** Mengambil satu notifikasi milik pengguna yang bersangkutan. */
export async function findByIdAndUser(id, userId, connection) {
  return queryOne(
    `SELECT ${SELECT_COLUMNS} ${FROM_CLAUSE} WHERE n.id = ? AND n.user_id = ? LIMIT 1`,
    [id, userId],
    connection,
  );
}

/** Mengambil daftar notifikasi, terbaru lebih dahulu. */
export async function findAllByUser(userId, filters = {}, connection) {
  const pagination = resolvePagination(filters);
  const conditions = ['n.user_id = ?'];
  const params = [userId];

  if (filters.unreadOnly) conditions.push('n.read_at IS NULL');

  const where = `WHERE ${conditions.join(' AND ')}`;

  const totalRow = await queryOne(
    `SELECT COUNT(*) AS total FROM notifications n ${where}`,
    params,
    connection,
  );

  const rows = await query(
    `SELECT ${SELECT_COLUMNS} ${FROM_CLAUSE} ${where}
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
    params,
    connection,
  );

  return { rows, total: Number(totalRow?.total ?? 0), pagination };
}

/** Menghitung notifikasi yang belum dibaca. */
export async function countUnread(userId, connection) {
  const row = await queryOne(
    'SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND read_at IS NULL',
    [userId],
    connection,
  );
  return Number(row?.total ?? 0);
}

/** Membuat satu baris notifikasi. */
export async function create(
  { userId, type, title, body, orderId = null },
  connection,
) {
  const result = await execute(
    `INSERT INTO notifications (user_id, type, title, body, order_id)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, type, title, body, orderId],
    connection,
  );
  return findByIdAndUser(result.insertId, userId, connection);
}

/** Menandai satu notifikasi sebagai sudah dibaca. */
export async function markAsRead(id, userId, connection) {
  const result = await execute(
    'UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND read_at IS NULL',
    [id, userId],
    connection,
  );
  return result.affectedRows > 0;
}

/** Menandai seluruh notifikasi pengguna sebagai sudah dibaca. */
export async function markAllAsRead(userId, connection) {
  const result = await execute(
    'UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL',
    [userId],
    connection,
  );
  return result.affectedRows;
}
