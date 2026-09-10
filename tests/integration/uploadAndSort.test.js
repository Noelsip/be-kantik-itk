import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestContext } from './helpers.js';

/**
 * Pengujian unggah gambar, pengurutan daftar, dan catatan per menu.
 */

let ctx;

before(async () => {
  ctx = await setupTestContext();
});

after(async () => {
  await ctx.close();
});

/** Menyusun berkas PNG kecil yang sah untuk diunggah. */
function berkasPng(nama = 'uji.png', ukuran = 128) {
  const tandaPng = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const isi = Buffer.concat([Buffer.from(tandaPng), Buffer.alloc(Math.max(0, ukuran - 8))]);
  return new File([isi], nama, { type: 'image/png' });
}

/** Membungkus satu berkas menjadi FormData siap kirim. */
function formBerkas(file) {
  const form = new FormData();
  form.append('file', file);
  return form;
}

test('mengunggah gambar dan memperoleh alamatnya', async () => {
  const { status, body } = await ctx.request('POST', '/api/uploads', {
    token: ctx.tokens.buyer,
    body: formBerkas(berkasPng()),
  });
  assert.equal(status, 201, JSON.stringify(body));
  assert.match(body.data.url, /^https?:\/\/.+\/uploads\/.+\.png$/);
  assert.equal(body.data.mimeType, 'image/png');
  assert.ok(body.data.size > 0);

  // Berkas benar-benar dapat diambil kembali lewat alamat tersebut.
  const berkas = await fetch(body.data.url);
  assert.equal(berkas.status, 200);
});

test('nama berkas ditentukan server sehingga tidak dapat disisipi jalur', async () => {
  const { body } = await ctx.request('POST', '/api/uploads', {
    token: ctx.tokens.buyer,
    body: formBerkas(berkasPng('../../etc/passwd.png')),
  });
  assert.ok(!body.data.fileName.includes('/'), 'tidak boleh memuat pemisah jalur');
  assert.ok(!body.data.fileName.includes('..'), 'tidak boleh memuat titik ganda');
  assert.match(body.data.fileName, /\.png$/);
});

test('jenis berkas selain gambar ditolak', async () => {
  const form = new FormData();
  form.append('file', new File([Buffer.from('halo')], 'catatan.txt', { type: 'text/plain' }));

  const { status } = await ctx.request('POST', '/api/uploads', {
    token: ctx.tokens.buyer,
    body: form,
  });
  assert.equal(status, 422);
});

test('permintaan tanpa berkas ditolak', async () => {
  const { status } = await ctx.request('POST', '/api/uploads', {
    token: ctx.tokens.buyer,
    body: new FormData(),
  });
  assert.equal(status, 422);
});

test('unggahan menolak permintaan tanpa kunci akses', async () => {
  const { status } = await ctx.request('POST', '/api/uploads', { body: formBerkas(berkasPng()) });
  assert.equal(status, 401);
});

test('foto profil dapat diunggah langsung dan langsung terpasang', async () => {
  const { status, body } = await ctx.request('POST', '/api/users/me/photo', {
    token: ctx.tokens.buyer,
    body: formBerkas(berkasPng()),
  });
  assert.equal(status, 200, JSON.stringify(body));
  assert.match(body.data.profileImage, /\/uploads\/.+\.png$/);

  // Perubahan tersebut benar-benar tersimpan pada akun.
  const profil = await ctx.request('GET', '/api/users/me', { token: ctx.tokens.buyer });
  assert.equal(profil.body.data.profileImage, body.data.profileImage);
});

test('alamat hasil unggah dapat dipasang sebagai foto menu', async () => {
  const { body: unggahan } = await ctx.request('POST', '/api/uploads', {
    token: ctx.tokens.sellerA,
    body: formBerkas(berkasPng()),
  });

  const { status, body } = await ctx.request('POST', '/api/seller/menu', {
    token: ctx.tokens.sellerA,
    body: { name: 'Menu Berfoto', price: 13000, imageUrl: unggahan.data.url },
  });
  assert.equal(status, 201, JSON.stringify(body));
  assert.equal(body.data.imageUrl, unggahan.data.url);
});

test('daftar kantin dapat diurutkan berdasarkan nama', async () => {
  const naik = await ctx.request('GET', '/api/canteens?sortBy=name&sortOrder=asc', {
    token: ctx.tokens.buyer,
  });
  const turun = await ctx.request('GET', '/api/canteens?sortBy=name&sortOrder=desc', {
    token: ctx.tokens.buyer,
  });

  const namaNaik = naik.body.data.map((c) => c.name);
  const namaTurun = turun.body.data.map((c) => c.name);
  assert.deepEqual(namaNaik, [...namaNaik].sort());
  assert.deepEqual(namaTurun, [...namaNaik].reverse());
});

test('daftar menu dapat diurutkan berdasarkan harga', async () => {
  const { body } = await ctx.request('GET', '/api/menu?sortBy=price&sortOrder=asc&isAvailable=true', {
    token: ctx.tokens.buyer,
  });
  const harga = body.data.map((m) => m.price);
  assert.deepEqual(harga, [...harga].sort((a, b) => a - b));

  const turun = await ctx.request('GET', '/api/menu?sortBy=price&sortOrder=desc&isAvailable=true', {
    token: ctx.tokens.buyer,
  });
  const hargaTurun = turun.body.data.map((m) => m.price);
  assert.deepEqual(hargaTurun, [...harga].reverse());
});

test('dasar pengurutan di luar daftar ditolak', async () => {
  for (const query of ['sortBy=hargaTermurah', 'sortBy=name;DROP TABLE users', 'sortOrder=naik']) {
    const { status } = await ctx.request('GET', `/api/canteens?${query}`, {
      token: ctx.tokens.buyer,
    });
    assert.equal(status, 422, query);
  }
});

test('catatan per menu tersimpan pada keranjang', async () => {
  await ctx.request('DELETE', '/api/cart', { token: ctx.tokens.buyer });
  const { status, body } = await ctx.request('POST', '/api/cart/items', {
    token: ctx.tokens.buyer,
    body: { menuItemId: ctx.fixtures.menu.nasiGoreng, quantity: 1, note: 'Pedas sedikit' },
  });
  assert.equal(status, 201);
  assert.equal(body.data.items[0].note, 'Pedas sedikit');
});

test('catatan dapat diubah tanpa mengubah jumlah', async () => {
  const { body: keranjang } = await ctx.request('GET', '/api/cart', { token: ctx.tokens.buyer });
  const itemId = keranjang.data.items[0].id;
  const jumlahAwal = keranjang.data.items[0].quantity;

  const { status, body } = await ctx.request('PATCH', `/api/cart/items/${itemId}`, {
    token: ctx.tokens.buyer,
    body: { note: 'Tanpa sambal' },
  });
  assert.equal(status, 200);
  assert.equal(body.data.items[0].note, 'Tanpa sambal');
  assert.equal(body.data.items[0].quantity, jumlahAwal, 'jumlah tidak ikut berubah');
});

test('catatan per menu ikut tersalin ke pesanan', async () => {
  await ctx.request('DELETE', '/api/cart', { token: ctx.tokens.buyer });
  await ctx.request('POST', '/api/cart/items', {
    token: ctx.tokens.buyer,
    body: { menuItemId: ctx.fixtures.menu.nasiGoreng, quantity: 1, note: 'Pedas sedikit' },
  });
  await ctx.request('POST', '/api/cart/items', {
    token: ctx.tokens.buyer,
    body: { menuItemId: ctx.fixtures.menu.esTeh, quantity: 1, note: 'Es sedikit' },
  });

  const { body } = await ctx.request('POST', '/api/orders', {
    token: ctx.tokens.buyer,
    body: { note: 'Catatan untuk seluruh pesanan' },
  });
  const pesanan = body.data[0];
  const perMenu = new Map(pesanan.items.map((i) => [i.menuName, i.note]));

  assert.equal(perMenu.get('Nasi Goreng'), 'Pedas sedikit');
  assert.equal(perMenu.get('Es Teh'), 'Es sedikit');
  // Catatan tingkat pesanan tetap berdiri sendiri.
  assert.equal(pesanan.note, 'Catatan untuk seluruh pesanan');
});

test('catatan yang terlalu panjang ditolak', async () => {
  await ctx.request('DELETE', '/api/cart', { token: ctx.tokens.buyer });
  const { status } = await ctx.request('POST', '/api/cart/items', {
    token: ctx.tokens.buyer,
    body: { menuItemId: ctx.fixtures.menu.nasiGoreng, quantity: 1, note: 'x'.repeat(256) },
  });
  assert.equal(status, 422);
});
