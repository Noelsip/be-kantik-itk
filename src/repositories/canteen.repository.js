import { query, queryOne, execute } from '../config/database.js';
import { resolvePagination } from '../utils/pagination.js';

/** Fungsi untuk mengakses data tabel `canteens`. */

const SELECT_COLUMNS = `
  c.id, c.owner_id, c.name, c.description, c.location, c.image_url, c.whatsapp,
  c.is_open, c.created_at, c.updated_at
`;

/** Mengambil satu kantin berdasarkan id. */
export async function findById(id, connection) {
  return queryOne(`SELECT ${SELECT_COLUMNS} FROM canteens c WHERE c.id = ? LIMIT 1`, [id], connection);
}

/** Mengambil kantin hanya bila dimiliki oleh penjual yang bersangkutan. */
export async function findByIdAndOwner(id, ownerId, connection) {
  return queryOne(
    `SELECT ${SELECT_COLUMNS} FROM canteens c WHERE c.id = ? AND c.owner_id = ? LIMIT 1`,
    [id, ownerId],
    connection,
  );
}

/** Mengambil kantin milik seorang penjual. */
export async function findByOwnerId(ownerId, connection) {
  return queryOne(
    `SELECT ${SELECT_COLUMNS} FROM canteens c WHERE c.owner_id = ? ORDER BY c.id LIMIT 1`,
    [ownerId],
    connection,
  );
}

/** Mengambil daftar kantin dengan pencarian, penyaringan, dan pembagian halaman. */
// Kolom pengurutan dipetakan dari nilai yang sudah dibatasi skema, sehingga
// tidak ada teks dari pengguna yang masuk ke perintah SQL.
const CANTEEN_SORT_COLUMNS = Object.freeze({
  name: 'c.name',
  menuCount: 'menu_count',
  createdAt: 'c.created_at',
});

export async function findAll({ search, isOpen, page, limit, sortBy, sortOrder = 'asc' }, connection) {
  const pagination = resolvePagination({ page, limit });

  const conditions = [];
  const params = [];

  if (search) {
    conditions.push('(c.name LIKE ? OR c.location LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term);
  }
  if (isOpen !== undefined) {
    conditions.push('c.is_open = ?');
    params.push(isOpen ? 1 : 0);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const totalRow = await queryOne(
    `SELECT COUNT(*) AS total FROM canteens c ${where}`,
    params,
    connection,
  );

  // Kantin yang buka tetap didahulukan, lalu menyusul urutan pilihan pengguna.
  const column = CANTEEN_SORT_COLUMNS[sortBy];
  const direction = sortOrder === 'desc' ? 'DESC' : 'ASC';
  const orderBy = column ? `c.is_open DESC, ${column} ${direction}, c.id ASC` : 'c.is_open DESC, c.name ASC';

  // Nilai limit dan offset berasal dari resolvePagination, bukan langsung dari pengguna.
  const rows = await query(
    `SELECT ${SELECT_COLUMNS},
            (SELECT COUNT(*) FROM menu_items m
              WHERE m.canteen_id = c.id AND m.deleted_at IS NULL) AS menu_count
       FROM canteens c
       ${where}
       ORDER BY ${orderBy}
       LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
    params,
    connection,
  );

  return { rows, total: Number(totalRow?.total ?? 0), pagination };
}

/** Membuat kantin baru untuk seorang penjual. */
export async function create(
  {
    ownerId,
    name,
    description = null,
    location = null,
    imageUrl = null,
    whatsapp = null,
    isOpen = true,
  },
  connection,
) {
  const result = await execute(
    `INSERT INTO canteens (owner_id, name, description, location, image_url, whatsapp, is_open)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [ownerId, name, description, location, imageUrl, whatsapp, isOpen ? 1 : 0],
    connection,
  );
  return findById(result.insertId, connection);
}

/** Memperbarui sebagian data kantin. */
export async function update(id, changes, connection) {
  const columnMap = {
    name: 'name',
    description: 'description',
    location: 'location',
    imageUrl: 'image_url',
    whatsapp: 'whatsapp',
    isOpen: 'is_open',
  };

  const fields = [];
  const params = [];

  for (const [key, column] of Object.entries(columnMap)) {
    if (changes[key] === undefined) continue;
    fields.push(`${column} = ?`);
    params.push(key === 'isOpen' ? (changes[key] ? 1 : 0) : changes[key]);
  }

  if (fields.length === 0) return findById(id, connection);

  params.push(id);
  await execute(`UPDATE canteens SET ${fields.join(', ')} WHERE id = ?`, params, connection);
  return findById(id, connection);
}
