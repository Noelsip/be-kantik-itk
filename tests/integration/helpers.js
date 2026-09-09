import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Perlengkapan pengujian terpadu.
 *
 * Pengujian ini berjalan di atas database MySQL sungguhan yang terpisah dari
 * data pengembangan. Database bernama TEST_DB_NAME dihapus lalu dibangun ulang
 * dari berkas migrasi sebelum tiap berkas pengujian, sehingga hasilnya konsisten.
 *
 * Nilai environment disiapkan sebelum modul konfigurasi diimpor, karena
 * konfigurasi dibekukan saat modul pertama kali dimuat.
 */

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const TEST_DB_NAME = process.env.TEST_DB_NAME || 'kantin_itk_test';

process.env.NODE_ENV = 'test';
process.env.DB_NAME = TEST_DB_NAME;
// Nilai DATABASE_URL milik proyek lain akan memunculkan peringatan pada setiap
// kali dijalankan, sehingga dikosongkan agar keluaran pengujian tetap bersih.
delete process.env.DATABASE_URL;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-yang-cukup-panjang-untuk-validasi-zod';
process.env.ENABLE_DEV_LOGIN = 'true';
process.env.ALLOWED_EMAIL_DOMAINS = 'student.itk.ac.id,lecture.itk.ac.id,itk.ac.id';
process.env.SELLER_EMAILS = 'penjual.a@itk.ac.id,penjual.b@itk.ac.id';

/** Membangun ulang skema database pengujian dari awal. */
export function resetSchema() {
  const result = spawnSync(process.execPath, ['scripts/migrate.js', '--fresh'], {
    cwd: projectRoot,
    env: { ...process.env, DB_NAME: TEST_DB_NAME },
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(
      `Gagal menyiapkan database test "${TEST_DB_NAME}".\n` +
        `${result.stdout ?? ''}\n${result.stderr ?? ''}\n` +
        'Pastikan MySQL berjalan dan kredensial DB_* pada .env benar.',
    );
  }
}

/**
 * Menyiapkan data awal berupa dua penjual dengan satu kantin masing-masing,
 * serta dua pembeli. Nilai id yang dikembalikan dipakai pada pemeriksaan.
 */
export async function seedFixtures() {
  const { withTransaction } = await import('../../src/config/database.js');

  return withTransaction(async (connection) => {
    const insertUser = async (campusId, name, email, role) => {
      const [result] = await connection.execute(
        'INSERT INTO users (campus_id, name, email, role) VALUES (?, ?, ?, ?)',
        [campusId, name, email, role],
      );
      return Number(result.insertId);
    };

    const sellerA = await insertUser('penjual-a', 'Penjual A', 'penjual.a@itk.ac.id', 'penjual');
    const sellerB = await insertUser('penjual-b', 'Penjual B', 'penjual.b@itk.ac.id', 'penjual');
    const buyer = await insertUser('10231001', 'Budi', 'budi@student.itk.ac.id', 'pembeli');
    const buyerTwo = await insertUser('10231002', 'Siti', 'siti@student.itk.ac.id', 'pembeli');

    const [catResult] = await connection.execute('INSERT INTO categories (name) VALUES (?)', ['Makanan']);
    const categoryId = Number(catResult.insertId);
    const [cat2Result] = await connection.execute('INSERT INTO categories (name) VALUES (?)', ['Minuman']);
    const categoryMinuman = Number(cat2Result.insertId);

    const insertCanteen = async (ownerId, name, isOpen = 1) => {
      const [result] = await connection.execute(
        'INSERT INTO canteens (owner_id, name, location, is_open) VALUES (?, ?, ?, ?)',
        [ownerId, name, 'Gedung A', isOpen],
      );
      return Number(result.insertId);
    };

    const canteenA = await insertCanteen(sellerA, 'Kantin FSTI');
    const canteenB = await insertCanteen(sellerB, 'Kantin Teknik');

    const insertMenu = async (canteenId, name, price, isAvailable = 1, catId = categoryId) => {
      const [result] = await connection.execute(
        `INSERT INTO menu_items (canteen_id, category_id, name, price, is_available)
         VALUES (?, ?, ?, ?, ?)`,
        [canteenId, catId, name, price, isAvailable],
      );
      return Number(result.insertId);
    };

    return {
      sellerA,
      sellerB,
      buyer,
      buyerTwo,
      categoryId,
      categoryMinuman,
      canteenA,
      canteenB,
      menu: {
        nasiGoreng: await insertMenu(canteenA, 'Nasi Goreng', '15000.00'),
        esTeh: await insertMenu(canteenA, 'Es Teh', '5000.00', 1, categoryMinuman),
        habis: await insertMenu(canteenA, 'Ayam Geprek', '18000.00', 0),
        mieGorengB: await insertMenu(canteenB, 'Mie Goreng', '14000.00'),
      },
    };
  });
}

/** Menyalakan API pada porta acak dan mengembalikan pemanggil sederhana. */
export async function startTestServer() {
  const { createApp } = await import('../../src/app.js');
  const app = createApp();

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  /** Membungkus pemanggilan HTTP agar pemeriksaan hasil tetap ringkas. */
  async function request(method, endpoint, { token, body } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text };
    }
    return { status: response.status, body: parsed };
  }

  /** Mengambil kunci akses akun contoh melalui jalur masuk pengembangan. */
  async function login(email) {
    const { status, body } = await request('POST', '/api/auth/dev-login', { body: { email } });
    if (status !== 200) {
      throw new Error(`Dev login gagal untuk ${email}: ${status} ${JSON.stringify(body)}`);
    }
    return body.data.accessToken;
  }

  async function close() {
    await new Promise((resolve) => server.close(resolve));
    const { closePool } = await import('../../src/config/database.js');
    await closePool();
  }

  return { baseUrl, request, login, close };
}

/**
 * Menyiapkan seluruh kebutuhan satu berkas pengujian: skema baru, data awal,
 * server yang berjalan, dan kunci akses tiap peran.
 */
export async function setupTestContext() {
  resetSchema();
  const fixtures = await seedFixtures();
  const client = await startTestServer();

  const tokens = {
    buyer: await client.login('budi@student.itk.ac.id'),
    buyerTwo: await client.login('siti@student.itk.ac.id'),
    sellerA: await client.login('penjual.a@itk.ac.id'),
    sellerB: await client.login('penjual.b@itk.ac.id'),
  };

  return { ...client, fixtures, tokens };
}
