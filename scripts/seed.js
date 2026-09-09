import { pool, withTransaction, queryOne } from '../src/config/database.js';
import { ROLES } from '../src/constants/roles.js';
import logger from '../src/utils/logger.js';
import config from '../src/config/env.js';

/**
 * Data contoh untuk keperluan pengembangan.
 *
 * Seluruh akun di bawah ini merupakan data uji coba. Tidak ada kata sandi yang
 * dibuat karena sistem ini memang tidak menyimpannya. Setiap akun hasil seed
 * memiliki `google_id` kosong, dan akan tertaut ke akun Google yang sebenarnya
 * pada saat alamat tersebut pertama kali masuk.
 *
 * Skrip ini aman dijalankan berulang kali.
 */

const DEV_MARKER = '[DEV]';

const CATEGORIES = ['Makanan', 'Minuman', 'Snack'];

const SELLERS = [
  {
    campusId: 'dev-penjual-fsti',
    name: `${DEV_MARKER} Penjual Kantin FSTI`,
    email: 'penjual.fsti@itk.ac.id',
    canteen: {
      name: 'Kantin FSTI',
      description: 'Kantin Fakultas Sains dan Teknologi Informasi',
      location: 'Gedung A, Lantai 1',
      isOpen: true,
    },
    menu: [
      { name: 'Nasi Goreng', category: 'Makanan', price: 15000, description: 'Nasi goreng spesial dengan telur dan acar' },
      { name: 'Ayam Geprek', category: 'Makanan', price: 18000, description: 'Ayam goreng tepung dengan sambal bawang' },
      { name: 'Es Teh', category: 'Minuman', price: 5000, description: 'Es teh manis dingin' },
      { name: 'Pisang Goreng', category: 'Snack', price: 8000, description: 'Pisang goreng crispy, isi 3 potong' },
    ],
  },
  {
    campusId: 'dev-penjual-teknik',
    name: `${DEV_MARKER} Penjual Kantin Teknik`,
    email: 'penjual.teknik@itk.ac.id',
    canteen: {
      name: 'Kantin Teknik',
      description: 'Kantin di area Fakultas Teknik',
      location: 'Gedung B, Lantai 1',
      isOpen: true,
    },
    menu: [
      { name: 'Mie Goreng', category: 'Makanan', price: 14000, description: 'Mie goreng dengan sayur dan telur' },
      { name: 'Nasi Ayam', category: 'Makanan', price: 17000, description: 'Nasi dengan ayam bumbu kecap' },
      { name: 'Kopi Susu', category: 'Minuman', price: 10000, description: 'Kopi susu gula aren' },
    ],
  },
  {
    campusId: 'dev-penjual-kampus',
    name: `${DEV_MARKER} Penjual Kantin Kampus`,
    email: 'penjual.kampus@itk.ac.id',
    canteen: {
      name: 'Kantin Kampus',
      description: 'Kantin pusat kampus ITK',
      location: 'Gedung Serbaguna',
      isOpen: false,
    },
    menu: [
      { name: 'Soto Ayam', category: 'Makanan', price: 16000, description: 'Soto ayam kuah bening' },
      { name: 'Es Jeruk', category: 'Minuman', price: 6000, description: 'Es jeruk peras segar' },
    ],
  },
];

const BUYERS = [
  { campusId: '10231001', name: `${DEV_MARKER} Budi Santoso`, email: 'budi.santoso@student.itk.ac.id' },
  { campusId: '10231002', name: `${DEV_MARKER} Siti Rahayu`, email: 'siti.rahayu@student.itk.ac.id' },
  { campusId: 'dosen001', name: `${DEV_MARKER} Dr. Andi Wijaya`, email: 'andi.wijaya@lecture.itk.ac.id' },
];

/** Menyisipkan pengguna bila belum ada, lalu mengembalikan idnya. */
async function upsertUser(connection, { campusId, name, email, role }) {
  await connection.execute(
    `INSERT INTO users (campus_id, name, email, role)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role)`,
    [campusId, name, email, role],
  );
  const [rows] = await connection.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  return Number(rows[0].id);
}

/** Menyisipkan kategori bila belum ada, lalu mengembalikan idnya. */
async function upsertCategory(connection, name) {
  await connection.execute(
    'INSERT INTO categories (name) VALUES (?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
    [name],
  );
  const [rows] = await connection.execute('SELECT id FROM categories WHERE name = ? LIMIT 1', [name]);
  return Number(rows[0].id);
}

/** Menyisipkan atau memperbarui kantin milik seorang penjual. */
async function upsertCanteen(connection, ownerId, canteen) {
  const [existing] = await connection.execute(
    'SELECT id FROM canteens WHERE owner_id = ? LIMIT 1',
    [ownerId],
  );

  if (existing.length > 0) {
    const id = Number(existing[0].id);
    await connection.execute(
      'UPDATE canteens SET name = ?, description = ?, location = ?, is_open = ? WHERE id = ?',
      [canteen.name, canteen.description, canteen.location, canteen.isOpen ? 1 : 0, id],
    );
    return id;
  }

  const [result] = await connection.execute(
    `INSERT INTO canteens (owner_id, name, description, location, is_open)
     VALUES (?, ?, ?, ?, ?)`,
    [ownerId, canteen.name, canteen.description, canteen.location, canteen.isOpen ? 1 : 0],
  );
  return Number(result.insertId);
}

/** Menyisipkan atau memperbarui satu menu pada sebuah kantin. */
async function upsertMenuItem(connection, canteenId, categoryIds, item) {
  const [existing] = await connection.execute(
    'SELECT id FROM menu_items WHERE canteen_id = ? AND name = ? LIMIT 1',
    [canteenId, item.name],
  );

  const categoryId = categoryIds.get(item.category) ?? null;
  const description = item.description;
  const price = item.price.toFixed(2);
  const isAvailable = item.isAvailable === false ? 0 : 1;

  if (existing.length > 0) {
    const id = Number(existing[0].id);
    await connection.execute(
      `UPDATE menu_items
          SET category_id = ?, description = ?, price = ?, is_available = ?, deleted_at = NULL
        WHERE id = ?`,
      [categoryId, description, price, isAvailable, id],
    );
    return id;
  }

  const [result] = await connection.execute(
    `INSERT INTO menu_items (canteen_id, category_id, name, description, price, is_available)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [canteenId, categoryId, item.name, description, price, isAvailable],
  );
  return Number(result.insertId);
}

/** Mengisi database dengan data contoh. */
async function seed() {
  logger.info('Mengisi data contoh untuk pengembangan...');

  await withTransaction(async (connection) => {
    const categoryIds = new Map();
    for (const name of CATEGORIES) {
      categoryIds.set(name, await upsertCategory(connection, name));
    }
    logger.info(`  Kategori: ${CATEGORIES.join(', ')}`);

    for (const seller of SELLERS) {
      const ownerId = await upsertUser(connection, {
        campusId: seller.campusId,
        name: seller.name,
        email: seller.email,
        role: ROLES.PENJUAL,
      });

      const canteenId = await upsertCanteen(connection, ownerId, seller.canteen);

      for (const item of seller.menu) {
        await upsertMenuItem(connection, canteenId, categoryIds, item);
      }

      logger.info(`  Penjual ${seller.email} -> ${seller.canteen.name} (${seller.menu.length} menu)`);
    }

    for (const buyer of BUYERS) {
      await upsertUser(connection, { ...buyer, role: ROLES.PEMBELI });
      logger.info(`  Pembeli ${buyer.email}`);
    }
  });

  const totals = await queryOne('SELECT COUNT(*) AS total FROM users');
  logger.info(`Selesai. Total pengguna: ${totals.total}`);

  // Akun penjual hasil seed hanya mempertahankan perannya saat masuk melalui
  // Google apabila alamatnya tercantum pada SELLER_EMAILS.
  const missing = SELLERS.map((seller) => seller.email).filter(
    (email) => !config.auth.sellerEmails.includes(email),
  );

  if (missing.length > 0) {
    logger.warn('');
    logger.warn('Email penjual berikut belum tercantum pada SELLER_EMAILS:');
    for (const email of missing) logger.warn(`  - ${email}`);
    logger.warn('Tambahkan baris berikut pada berkas .env agar perannya tetap penjual:');
    logger.warn(`  SELLER_EMAILS=${SELLERS.map((seller) => seller.email).join(',')}`);
  }
}

seed()
  .catch((error) => {
    logger.error('Pengisian data contoh gagal:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
