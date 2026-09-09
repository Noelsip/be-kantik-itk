import { query, queryOne, execute } from '../config/database.js';

/** Fungsi untuk mengakses data tabel `categories`. */

const SELECT_COLUMNS = 'id, name, created_at, updated_at';

/** Mengambil seluruh kategori, diurutkan menurut nama. */
export async function findAll(connection) {
  return query(`SELECT ${SELECT_COLUMNS} FROM categories ORDER BY name ASC`, [], connection);
}

/** Mengambil satu kategori berdasarkan id. */
export async function findById(id, connection) {
  return queryOne(`SELECT ${SELECT_COLUMNS} FROM categories WHERE id = ? LIMIT 1`, [id], connection);
}

/** Mengambil satu kategori berdasarkan nama. */
export async function findByName(name, connection) {
  return queryOne(`SELECT ${SELECT_COLUMNS} FROM categories WHERE name = ? LIMIT 1`, [name], connection);
}

/** Membuat kategori baru. */
export async function create({ name }, connection) {
  const result = await execute('INSERT INTO categories (name) VALUES (?)', [name], connection);
  return findById(result.insertId, connection);
}
