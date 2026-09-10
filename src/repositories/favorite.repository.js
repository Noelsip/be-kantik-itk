import { query, queryOne, execute } from '../config/database.js';
import { resolvePagination } from '../utils/pagination.js';

/**
 * Fungsi untuk mengakses data tabel `favorites`.
 * Menu yang sudah ditandai terhapus tidak pernah ikut terbawa pada pembacaan.
 */

const MENU_COLUMNS = `
  m.id, m.canteen_id, m.category_id, m.name, m.description, m.price,
  m.image_url, m.is_available, m.created_at, m.updated_at,
  cat.name  AS category_name,
  c.name    AS canteen_name,
  c.is_open AS canteen_is_open,
  1         AS is_favorite,
  f.created_at AS favorited_at
`;

const FROM_CLAUSE = `
  FROM favorites f
  JOIN menu_items m ON m.id = f.menu_item_id
  JOIN canteens c   ON c.id = m.canteen_id
  LEFT JOIN categories cat ON cat.id = m.category_id
`;

const ACTIVE_ONLY = 'WHERE f.user_id = ? AND m.deleted_at IS NULL';

/**
 * Menambahkan menu ke daftar favorit.
 * Penandaan berulang bersandar pada indeks unik dan tidak dianggap kesalahan.
 */
export async function add(userId, menuItemId, connection) {
  const result = await execute(
    `INSERT INTO favorites (user_id, menu_item_id)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE id = id`,
    [userId, menuItemId],
    connection,
  );
  return result.affectedRows > 0;
}

/** Menghapus menu dari daftar favorit. */
export async function remove(userId, menuItemId, connection) {
  const result = await execute(
    'DELETE FROM favorites WHERE user_id = ? AND menu_item_id = ?',
    [userId, menuItemId],
    connection,
  );
  return result.affectedRows > 0;
}

/** Memeriksa apakah sebuah menu sudah ditandai favorit oleh pengguna. */
export async function exists(userId, menuItemId, connection) {
  const row = await queryOne(
    'SELECT id FROM favorites WHERE user_id = ? AND menu_item_id = ? LIMIT 1',
    [userId, menuItemId],
    connection,
  );
  return row !== null;
}

/** Menghitung jumlah menu favorit yang masih aktif. */
export async function countByUser(userId, connection) {
  const row = await queryOne(
    `SELECT COUNT(*) AS total ${FROM_CLAUSE} ${ACTIVE_ONLY}`,
    [userId],
    connection,
  );
  return Number(row?.total ?? 0);
}

/** Mengambil daftar menu favorit, terbaru lebih dahulu. */
export async function findAllByUser(userId, filters = {}, connection) {
  const pagination = resolvePagination(filters);

  const total = await countByUser(userId, connection);
  const rows = await query(
    `SELECT ${MENU_COLUMNS} ${FROM_CLAUSE} ${ACTIVE_ONLY}
      ORDER BY f.created_at DESC, f.id DESC
      LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
    [userId],
    connection,
  );

  return { rows, total, pagination };
}
