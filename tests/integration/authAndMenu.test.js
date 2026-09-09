import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestContext } from './helpers.js';

/**
 * Pengujian proses masuk, pembatasan peran, aturan profil, serta kepemilikan
 * menu oleh penjual.
 */

let ctx;

before(async () => {
  ctx = await setupTestContext();
});

after(async () => {
  await ctx.close();
});

test('jalur terlindungi menolak permintaan tanpa kunci akses', async () => {
  const { status, body } = await ctx.request('GET', '/api/canteens');
  assert.equal(status, 401);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'UNAUTHENTICATED');
});

test('menolak kunci akses yang rusak atau dipalsukan', async () => {
  for (const token of ['sampah', 'a.b.c', '']) {
    const { status } = await ctx.request('GET', '/api/canteens', { token });
    assert.equal(status, 401, `token "${token}" seharusnya ditolak`);
  }
});

test('kunci akses bertanda tangan salah ditolak', async () => {
  const jwt = (await import('jsonwebtoken')).default;
  const forged = jwt.sign({ tv: 0 }, 'secret-yang-salah-tapi-cukup-panjang-sekali', {
    subject: String(ctx.fixtures.buyer),
    issuer: 'kantin-itk-api',
    expiresIn: '1h',
  });
  const { status, body } = await ctx.request('GET', '/api/canteens', { token: forged });
  assert.equal(status, 401);
  assert.equal(body.error.code, 'INVALID_TOKEN');
});

test('kunci akses kedaluwarsa dilaporkan sebagai berakhir', async () => {
  const jwt = (await import('jsonwebtoken')).default;
  const expired = jwt.sign({ tv: 0 }, process.env.JWT_SECRET, {
    subject: String(ctx.fixtures.buyer),
    issuer: 'kantin-itk-api',
    expiresIn: '-1s',
  });
  const { status, body } = await ctx.request('GET', '/api/canteens', { token: expired });
  assert.equal(status, 401);
  assert.equal(body.error.code, 'TOKEN_EXPIRED');
});

test('proses keluar membatalkan kunci akses yang sudah diterbitkan', async () => {
  const token = await ctx.login('budi@student.itk.ac.id');
  assert.equal((await ctx.request('GET', '/api/auth/me', { token })).status, 200);

  await ctx.request('POST', '/api/auth/logout', { token });

  const after = await ctx.request('GET', '/api/auth/me', { token });
  assert.equal(after.status, 401);
  assert.equal(after.body.error.code, 'INVALID_TOKEN');
});

test('masuk mode pengembangan menolak akun yang tidak terdaftar', async () => {
  const { status } = await ctx.request('POST', '/api/auth/dev-login', {
    body: { email: 'tidak.ada@student.itk.ac.id' },
  });
  assert.equal(status, 404);
});

test('jalur masuk Google menolak identitas palsu', async () => {
  const { status, body } = await ctx.request('POST', '/api/auth/google', {
    body: { idToken: 'bukan-token-google' },
  });
  assert.equal(status, 401);
  assert.ok(['INVALID_GOOGLE_TOKEN'].includes(body.error.code));
});

test('jalur masuk Google menolak field tambahan seperti peran', async () => {
  const { status } = await ctx.request('POST', '/api/auth/google', {
    body: { idToken: 'x', role: 'penjual', email: 'penyerang@itk.ac.id' },
  });
  assert.equal(status, 422);
});

test('pengguna dapat membaca profilnya sendiri', async () => {
  const { status, body } = await ctx.request('GET', '/api/users/me', { token: ctx.tokens.buyer });
  assert.equal(status, 200);
  assert.equal(body.data.email, 'budi@student.itk.ac.id');
  assert.equal(body.data.role, 'pembeli');
  // Kolom internal tidak boleh ikut terkirim.
  assert.equal(body.data.token_version, undefined);
  assert.equal(body.data.google_id, undefined);
  assert.equal(body.data.password, undefined);
});

test('pengguna dapat mengubah nama tampilannya', async () => {
  const { status, body } = await ctx.request('PATCH', '/api/users/me', {
    token: ctx.tokens.buyer,
    body: { name: 'Budi Santoso' },
  });
  assert.equal(status, 200);
  assert.equal(body.data.name, 'Budi Santoso');
});

test('pengguna tidak dapat menaikkan perannya atau mengubah data identitas', async () => {
  for (const payload of [
    { role: 'penjual' },
    { email: 'penyerang@itk.ac.id' },
    { campusId: '999' },
    { id: 1 },
    { name: 'Sah', role: 'penjual' },
  ]) {
    const { status } = await ctx.request('PATCH', '/api/users/me', {
      token: ctx.tokens.buyer,
      body: payload,
    });
    assert.equal(status, 422, `payload ${JSON.stringify(payload)} seharusnya ditolak`);
  }

  const { body } = await ctx.request('GET', '/api/users/me', { token: ctx.tokens.buyer });
  assert.equal(body.data.role, 'pembeli', 'role tidak boleh berubah');
});

test('daftar kantin disertai informasi halaman', async () => {
  const { status, body } = await ctx.request('GET', '/api/canteens', { token: ctx.tokens.buyer });
  assert.equal(status, 200);
  assert.equal(body.data.length, 2);
  assert.equal(body.meta.page, 1);
  assert.equal(body.meta.total, 2);
  assert.equal(body.data[0].ownerId, undefined, 'ownerId tidak diekspos ke pembeli');
});

test('mencari menu berdasarkan nama', async () => {
  const { body } = await ctx.request('GET', '/api/menu?search=nasi', { token: ctx.tokens.buyer });
  assert.ok(body.data.length >= 1);
  for (const item of body.data) {
    assert.match(item.name.toLowerCase(), /nasi/);
  }
});

test('menyaring menu berdasarkan kategori', async () => {
  const { body } = await ctx.request(
    'GET',
    `/api/menu?categoryId=${ctx.fixtures.categoryMinuman}`,
    { token: ctx.tokens.buyer },
  );
  assert.ok(body.data.length >= 1);
  for (const item of body.data) {
    assert.equal(item.category.id, ctx.fixtures.categoryMinuman);
  }
});

test('menyaring menu berdasarkan kantin', async () => {
  const { body } = await ctx.request('GET', `/api/canteens/${ctx.fixtures.canteenB}/menu`, {
    token: ctx.tokens.buyer,
  });
  assert.equal(body.data.canteen.id, ctx.fixtures.canteenB);
  for (const item of body.data.menu) {
    assert.equal(item.canteenId, ctx.fixtures.canteenB);
  }
});

test('menolak id yang bukan angka', async () => {
  const { status } = await ctx.request('GET', '/api/menu/abc', { token: ctx.tokens.buyer });
  assert.equal(status, 422);
});

test('penjual dapat menambah menu pada kantinnya sendiri', async () => {
  const { status, body } = await ctx.request('POST', '/api/seller/menu', {
    token: ctx.tokens.sellerA,
    body: { name: 'Soto Ayam', price: 16000, categoryId: ctx.fixtures.categoryId },
  });
  assert.equal(status, 201);
  assert.equal(body.data.name, 'Soto Ayam');
  assert.equal(body.data.price, 16000);
  // Kantin diambil dari akun penjual yang sedang masuk, bukan dari permintaan.
  assert.equal(body.data.canteenId, ctx.fixtures.canteenA);
});

test('penjual tidak dapat menyisipkan id kantin lain saat menambah menu', async () => {
  const { status } = await ctx.request('POST', '/api/seller/menu', {
    token: ctx.tokens.sellerA,
    body: { name: 'Sabotase', price: 1000, canteenId: ctx.fixtures.canteenB },
  });
  assert.equal(status, 422, 'canteenId bukan field yang diterima');
});

test('penjual tidak dapat mengubah menu milik penjual lain', async () => {
  const { status, body } = await ctx.request('PATCH', `/api/seller/menu/${ctx.fixtures.menu.mieGorengB}`, {
    token: ctx.tokens.sellerA,
    body: { price: 1 },
  });
  assert.equal(status, 404);
  assert.equal(body.error.code, 'MENU_NOT_FOUND');

  // Pemilik sebenarnya tetap melihat harga semula.
  const { body: owner } = await ctx.request('GET', `/api/seller/menu/${ctx.fixtures.menu.mieGorengB}`, {
    token: ctx.tokens.sellerB,
  });
  assert.equal(owner.data.price, 14000);
});

test('penjual tidak dapat menghapus menu milik penjual lain', async () => {
  const { status } = await ctx.request('DELETE', `/api/seller/menu/${ctx.fixtures.menu.mieGorengB}`, {
    token: ctx.tokens.sellerA,
  });
  assert.equal(status, 404);

  const { status: stillThere } = await ctx.request('GET', `/api/menu/${ctx.fixtures.menu.mieGorengB}`, {
    token: ctx.tokens.buyer,
  });
  assert.equal(stillThere, 200);
});

test('daftar menu penjual hanya memuat menu kantinnya sendiri', async () => {
  const { body } = await ctx.request('GET', '/api/seller/menu', { token: ctx.tokens.sellerA });
  for (const item of body.data.menu) {
    assert.equal(item.canteenId, ctx.fixtures.canteenA);
  }
});

test('penghapusan menu memakai penandaan sehingga riwayat pesanan tetap utuh', async () => {
  // Menu dipesan lebih dulu agar riwayat pesanan merujuk kepadanya.
  await ctx.request('DELETE', '/api/cart', { token: ctx.tokens.buyer });
  const { body: created } = await ctx.request('POST', '/api/seller/menu', {
    token: ctx.tokens.sellerA,
    body: { name: 'Menu Sementara', price: 12000 },
  });
  const menuId = created.data.id;

  await ctx.request('POST', '/api/cart/items', {
    token: ctx.tokens.buyer,
    body: { menuItemId: menuId, quantity: 1 },
  });
  const { body: order } = await ctx.request('POST', '/api/orders', {
    token: ctx.tokens.buyer,
    body: {},
  });
  const orderId = order.data.id;

  const deleted = await ctx.request('DELETE', `/api/seller/menu/${menuId}`, {
    token: ctx.tokens.sellerA,
  });
  assert.equal(deleted.status, 200);

  // Menu hilang dari katalog,
  const { status: gone } = await ctx.request('GET', `/api/menu/${menuId}`, { token: ctx.tokens.buyer });
  assert.equal(gone, 404);

  // namun riwayat pesanannya tetap terbaca dengan benar.
  const { status, body: history } = await ctx.request('GET', `/api/orders/${orderId}`, {
    token: ctx.tokens.buyer,
  });
  assert.equal(status, 200);
  assert.equal(history.data.items[0].menuName, 'Menu Sementara');
  assert.equal(history.data.items[0].price, 12000);
  assert.equal(history.data.totalAmount, 12000);
});

test('menu yang dihapus ikut dikeluarkan dari keranjang yang memuatnya', async () => {
  const { body: created } = await ctx.request('POST', '/api/seller/menu', {
    token: ctx.tokens.sellerA,
    body: { name: 'Menu Dihapus', price: 9000 },
  });
  const menuId = created.data.id;

  await ctx.request('DELETE', '/api/cart', { token: ctx.tokens.buyer });
  await ctx.request('POST', '/api/cart/items', {
    token: ctx.tokens.buyer,
    body: { menuItemId: menuId, quantity: 1 },
  });

  await ctx.request('DELETE', `/api/seller/menu/${menuId}`, { token: ctx.tokens.sellerA });

  const { body: cart } = await ctx.request('GET', '/api/cart', { token: ctx.tokens.buyer });
  assert.equal(cart.data.items.length, 0);
});

test('menolak harga tidak valid dan alamat gambar di luar http', async () => {
  for (const body of [
    { name: 'X', price: -1 },
    { name: 'X', price: 'gratis' },
    { name: '', price: 1000 },
    { name: 'X', price: 1000, imageUrl: 'javascript:alert(1)' },
  ]) {
    const { status } = await ctx.request('POST', '/api/seller/menu', {
      token: ctx.tokens.sellerA,
      body,
    });
    assert.equal(status, 422, `${JSON.stringify(body)} seharusnya ditolak`);
  }
});

test('penjual tanpa kantin menerima pesan yang jelas', async () => {
  const { withTransaction } = await import('../../src/config/database.js');
  const email = 'penjual.tanpa.kantin@itk.ac.id';
  await withTransaction(async (connection) => {
    await connection.execute(
      'INSERT INTO users (campus_id, name, email, role) VALUES (?, ?, ?, ?)',
      ['penjual-tanpa-kantin', 'Penjual Baru', email, 'penjual'],
    );
  });

  const token = await ctx.login(email);
  const { status, body } = await ctx.request('GET', '/api/seller/menu', { token });
  assert.equal(status, 404);
  assert.equal(body.error.code, 'SELLER_HAS_NO_CANTEEN');
});

test('penjual dapat membuat kantinnya sendiri hanya satu kali', async () => {
  const email = 'penjual.mandiri@itk.ac.id';
  const { withTransaction } = await import('../../src/config/database.js');
  await withTransaction(async (connection) => {
    await connection.execute(
      'INSERT INTO users (campus_id, name, email, role) VALUES (?, ?, ?, ?)',
      ['penjual-mandiri', 'Penjual Mandiri', email, 'penjual'],
    );
  });

  const token = await ctx.login(email);
  const created = await ctx.request('POST', '/api/seller/canteen', {
    token,
    body: { name: 'Kantin Mandiri', location: 'Gedung C' },
  });
  assert.equal(created.status, 201);

  const second = await ctx.request('POST', '/api/seller/canteen', {
    token,
    body: { name: 'Kantin Kedua' },
  });
  assert.equal(second.status, 409);
});

test('alamat yang tidak dikenali memakai bentuk respons baku', async () => {
  const { status, body } = await ctx.request('GET', '/api/tidak-ada');
  assert.equal(status, 404);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('pemeriksaan status layanan bersifat terbuka', async () => {
  const { status, body } = await ctx.request('GET', '/api/health');
  assert.equal(status, 200);
  assert.equal(body.data.status, 'ok');
});
