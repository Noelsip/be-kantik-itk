import { query, queryOne, execute } from '../config/database.js';
import { resolvePagination } from '../utils/pagination.js';

/**
 * Fungsi untuk mengakses data tabel `menu_items`.
 *
 * Menu dihapus secara halus melalui kolom `deleted_at`, sehingga setiap
 * pembacaan menyaring baris yang sudah ditandai terhapus.
 */

const SELECT_COLUMNS = `
  m.id, m.canteen_id, m.category_id, m.name, m.description, m.price,
  m.image_url, m.is_available, m.created_at, m.updated_at,
  cat.name AS category_name,
  c.name   AS canteen_name,
  c.is_open AS canteen_is_open
`;

const FROM_CLAUSE = `
  FROM menu_items m
  JOIN canteens c ON c.id = m.canteen_id
  LEFT JOIN categories cat ON cat.id = m.category_id
`;

/** Mengambil satu menu yang masih aktif berdasarkan id. */
export async function findById(id, connection) {
  return queryOne(
    `SELECT ${SELECT_COLUMNS} ${FROM_CLAUSE} WHERE m.id = ? AND m.deleted_at IS NULL LIMIT 1`,
    [id],
    connection,
  );
}

/**
 * Mengambil sekaligus mengunci baris menu di dalam transaksi, agar harga dan
 * ketersediaannya tidak berubah selama pesanan sedang dibuat.
 */
export async function findByIdForUpdate(id, connection) {
  return queryOne(
    `SELECT m.id, m.canteen_id, m.name, m.price, m.is_available, m.deleted_at
       FROM menu_items m
      WHERE m.id = ?
      FOR UPDATE`,
    [id],
    connection,
  );
}

/** Mengambil menu hanya bila berada di kantin milik penjual yang bersangkutan. */
export async function findByIdAndOwner(id, ownerId, connection) {
  return queryOne(
    `SELECT ${SELECT_COLUMNS} ${FROM_CLAUSE}
      WHERE m.id = ? AND c.owner_id = ? AND m.deleted_at IS NULL
      LIMIT 1`,
    [id, ownerId],
    connection,
  );
}

/** Mengambil daftar menu dengan pencarian, penyaringan, dan pembagian halaman. */
export async function findAll(filters = {}, connection) {
  const { search, categoryId, canteenId, isAvailable, includeDeleted = false } = filters;
  const pagination = resolvePagination(filters);

  const conditions = [];
  const params = [];

  if (!includeDeleted) conditions.push('m.deleted_at IS NULL');

  if (search) {
    conditions.push('m.name LIKE ?');
    params.push(`%${search}%`);
  }
  if (categoryId !== undefined) {
    conditions.push('m.category_id = ?');
    params.push(categoryId);
  }
  if (canteenId !== undefined) {
    conditions.push('m.canteen_id = ?');
    params.push(canteenId);
  }
  if (isAvailable !== undefined) {
    conditions.push('m.is_available = ?');
    params.push(isAvailable ? 1 : 0);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const totalRow = await queryOne(
    `SELECT COUNT(*) AS total ${FROM_CLAUSE} ${where}`,
    params,
    connection,
  );

  const rows = await query(
    `SELECT ${SELECT_COLUMNS} ${FROM_CLAUSE} ${where}
      ORDER BY m.is_available DESC, m.name ASC
      LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
    params,
    connection,
  );

  return { rows, total: Number(totalRow?.total ?? 0), pagination };
}

/** Membuat menu baru pada sebuah kantin. */
export async function create(
  { canteenId, categoryId = null, name, description = null, price, imageUrl = null, isAvailable = true },
  connection,
) {
  const result = await execute(
    `INSERT INTO menu_items
       (canteen_id, category_id, name, description, price, image_url, is_available)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [canteenId, categoryId, name, description, price, imageUrl, isAvailable ? 1 : 0],
    connection,
  );
  return findById(result.insertId, connection);
}

/** Memperbarui sebagian data menu. */
export async function update(id, changes, connection) {
  const columnMap = {
    categoryId: 'category_id',
    name: 'name',
    description: 'description',
    price: 'price',
    imageUrl: 'image_url',
    isAvailable: 'is_available',
  };

  const fields = [];
  const params = [];

  for (const [key, column] of Object.entries(columnMap)) {
    if (changes[key] === undefined) continue;
    fields.push(`${column} = ?`);
    params.push(key === 'isAvailable' ? (changes[key] ? 1 : 0) : changes[key]);
  }

  if (fields.length === 0) return findById(id, connection);

  params.push(id);
  await execute(
    `UPDATE menu_items SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
    params,
    connection,
  );
  return findById(id, connection);
}

/**
 * Menandai menu sebagai terhapus tanpa membuang barisnya.
 *
 * Penghapusan permanen akan merusak riwayat pesanan yang merujuk menu tersebut,
 * sehingga penandaan inilah yang dipakai.
 */
export async function softDelete(id, connection) {
  const result = await execute(
    'UPDATE menu_items SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
    [id],
    connection,
  );
  return result.affectedRows > 0;
}

/** Mengeluarkan menu dari seluruh keranjang yang masih memuatnya. */
export async function removeFromAllCarts(menuItemId, connection) {
  const result = await execute('DELETE FROM cart_items WHERE menu_item_id = ?', [menuItemId], connection);
  return result.affectedRows;
}
