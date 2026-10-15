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

test('foto menu dapat diunggah sekaligus terpasang dalam satu panggilan', async () => {
  const { body: dibuat } = await ctx.request('POST', '/api/seller/menu', {
    token: ctx.tokens.sellerA,
    body: { name: 'Menu Foto Sekali Jalan', price: 12000 },
  });
  assert.equal(dibuat.data.imageUrl, null);

  const { status, body } = await ctx.request('POST', `/api/seller/menu/${dibuat.data.id}/photo`, {
    token: ctx.tokens.sellerA,
    body: formBerkas(berkasPng()),
  });
  assert.equal(status, 200, JSON.stringify(body));
  assert.match(body.data.imageUrl, /\/uploads\/.+\.png$/);

  // Perubahan benar-benar tersimpan, bukan sekadar ada di jawaban.
  const dibaca = await ctx.request('GET', `/api/menu/${dibuat.data.id}`, {
    token: ctx.tokens.buyer,
  });
  assert.equal(dibaca.body.data.imageUrl, body.data.imageUrl);
});

test('foto kantin dapat diunggah sekaligus terpasang', async () => {
  const { status, body } = await ctx.request('POST', '/api/seller/canteen/photo', {
    token: ctx.tokens.sellerA,
    body: formBerkas(berkasPng()),
  });
  assert.equal(status, 200, JSON.stringify(body));
  assert.match(body.data.imageUrl, /\/uploads\/.+\.png$/);

  const dilihatPembeli = await ctx.request('GET', `/api/canteens/${ctx.fixtures.canteenA}`, {
    token: ctx.tokens.buyer,
  });
  assert.equal(dilihatPembeli.body.data.imageUrl, body.data.imageUrl);
});

test('penjual tidak dapat memasang foto pada menu milik penjual lain', async () => {
  const { status } = await ctx.request(
    'POST',
    `/api/seller/menu/${ctx.fixtures.menu.mieGorengB}/photo`,
    { token: ctx.tokens.sellerA, body: formBerkas(berkasPng()) },
  );
  assert.equal(status, 404);

  // Menu milik pemiliknya tidak ikut berubah.
  const { body } = await ctx.request('GET', `/api/seller/menu/${ctx.fixtures.menu.mieGorengB}`, {
    token: ctx.tokens.sellerB,
  });
  assert.equal(body.data.imageUrl, null);
});

test('pembeli tidak dapat memasang foto menu', async () => {
  const { status } = await ctx.request(
    'POST',
    `/api/seller/menu/${ctx.fixtures.menu.nasiGoreng}/photo`,
    { token: ctx.tokens.buyer, body: formBerkas(berkasPng()) },
  );
  assert.equal(status, 403);
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

test('menu populer diurutkan dari porsi terjual terbanyak', async () => {
  const { buyer, buyerTwo, sellerB } = ctx.tokens;
  const { nasiGoreng, esTeh, mieGorengB } = ctx.fixtures.menu;

  const pesan = async (token, items) => {
    await ctx.request('DELETE', '/api/cart', { token });
    for (const [menuItemId, quantity] of items) {
      await ctx.request('POST', '/api/cart/items', { token, body: { menuItemId, quantity } });
    }
    const { body } = await ctx.request('POST', '/api/orders', { token });
    return body.data;
  };

  const awal = await ctx.request('GET', '/api/menu?isAvailable=true', { token: buyer });
  const terjualAwal = new Map(awal.body.data.map((m) => [m.id, m.soldCount]));

  await pesan(buyer, [[mieGorengB, 5]]);
  await pesan(buyerTwo, [[esTeh, 3]]);
  // Pesanan yang ditolak tidak ikut dihitung.
  const [ditolak] = await pesan(buyerTwo, [[nasiGoreng, 20]]);
  const pemilik = ditolak.canteen.id === ctx.fixtures.canteenB ? sellerB : ctx.tokens.sellerA;
  await ctx.request('PATCH', `/api/seller/orders/${ditolak.id}/reject`, { token: pemilik });

  const { status, body } = await ctx.request('GET', '/api/menu?sortBy=popular&isAvailable=true', {
    token: buyer,
  });
  assert.equal(status, 200);

  const terjual = new Map(body.data.map((m) => [m.id, m.soldCount]));
  assert.equal(terjual.get(mieGorengB) - (terjualAwal.get(mieGorengB) ?? 0), 5);
  assert.equal(terjual.get(esTeh) - (terjualAwal.get(esTeh) ?? 0), 3);
  assert.equal(terjual.get(nasiGoreng), terjualAwal.get(nasiGoreng), 'pesanan ditolak tidak dihitung');

  const urutan = body.data.map((m) => m.soldCount);
  assert.deepEqual(urutan, [...urutan].sort((a, b) => b - a));
});
