import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestContext } from './helpers.js';

/**
 * Pengujian pembuatan kategori oleh penjual dan ringkasan angka pada profil.
 */

let ctx;

before(async () => {
  ctx = await setupTestContext();
});

after(async () => {
  await ctx.close();
});

test('penjual dapat membuat kategori baru', async () => {
  const { status, body } = await ctx.request('POST', '/api/categories', {
    token: ctx.tokens.sellerA,
    body: { name: 'Gorengan' },
  });
  assert.equal(status, 201);
  assert.equal(body.data.name, 'Gorengan');

  const daftar = await ctx.request('GET', '/api/categories', { token: ctx.tokens.buyer });
  assert.ok(daftar.body.data.some((k) => k.name === 'Gorengan'));
});

test('nama yang sama dipakai kembali, bukan menjadi kategori kedua', async () => {
  const sebelum = await ctx.request('GET', '/api/categories', { token: ctx.tokens.buyer });

  // Penulisan berbeda besar kecil hurufnya tetap dianggap kategori yang sama.
  const { status, body } = await ctx.request('POST', '/api/categories', {
    token: ctx.tokens.sellerB,
    body: { name: 'gorengan' },
  });
  assert.equal(status, 200, 'dijawab 200 karena memakai yang sudah ada');
  assert.equal(body.data.name, 'Gorengan', 'nama aslinya dipertahankan');

  const sesudah = await ctx.request('GET', '/api/categories', { token: ctx.tokens.buyer });
  assert.equal(sesudah.body.data.length, sebelum.body.data.length, 'jumlah kategori tidak bertambah');
});

test('kategori baru dapat langsung dipakai pada menu', async () => {
  const { body: kategori } = await ctx.request('POST', '/api/categories', {
    token: ctx.tokens.sellerA,
    body: { name: 'Camilan' },
  });

  const { status, body } = await ctx.request('POST', '/api/seller/menu', {
    token: ctx.tokens.sellerA,
    body: { name: 'Keripik', price: 6000, categoryId: kategori.data.id },
  });
  assert.equal(status, 201);
  assert.equal(body.data.category.name, 'Camilan');
});

test('pembeli tidak dapat membuat kategori', async () => {
  const { status } = await ctx.request('POST', '/api/categories', {
    token: ctx.tokens.buyer,
    body: { name: 'Dibuat Pembeli' },
  });
  assert.equal(status, 403);
});

test('nama kategori yang tidak sah ditolak', async () => {
  for (const body of [{}, { name: '' }, { name: '   ' }, { name: 'x'.repeat(101) }, { name: 'Sah', id: 1 }]) {
    const { status } = await ctx.request('POST', '/api/categories', {
      token: ctx.tokens.sellerA,
      body,
    });
    assert.equal(status, 422, JSON.stringify(body));
  }
});

test('ringkasan profil pembeli kosong pada awalnya', async () => {
  const { status, body } = await ctx.request('GET', '/api/users/me/stats', {
    token: ctx.tokens.buyerTwo,
  });
  assert.equal(status, 200);
  assert.equal(body.data.role, 'pembeli');
  assert.equal(body.data.orders.total, 0);
  assert.equal(body.data.favoriteCount, 0);
});

test('ringkasan profil pembeli mengikuti pesanan dan favoritnya', async () => {
  await ctx.request('POST', '/api/favorites', {
    token: ctx.tokens.buyer,
    body: { menuItemId: ctx.fixtures.menu.nasiGoreng },
  });

  // Satu pesanan diselesaikan, satu lagi dibatalkan.
  const buatPesanan = async () => {
    await ctx.request('DELETE', '/api/cart', { token: ctx.tokens.buyer });
    await ctx.request('POST', '/api/cart/items', {
      token: ctx.tokens.buyer,
      body: { menuItemId: ctx.fixtures.menu.nasiGoreng, quantity: 1 },
    });
    const { body } = await ctx.request('POST', '/api/orders', {
      token: ctx.tokens.buyer,
      body: {},
    });
    return body.data[0].id;
  };

  const selesai = await buatPesanan();
  for (const langkah of ['accept', 'ready', 'complete']) {
    await ctx.request('PATCH', `/api/seller/orders/${selesai}/${langkah}`, {
      token: ctx.tokens.sellerA,
    });
  }

  const dibatalkan = await buatPesanan();
  await ctx.request('PATCH', `/api/orders/${dibatalkan}/cancel`, { token: ctx.tokens.buyer });

  const { body } = await ctx.request('GET', '/api/users/me/stats', { token: ctx.tokens.buyer });
  assert.equal(body.data.orders.total, 2);
  assert.equal(body.data.orders.completed, 1);
  assert.equal(body.data.orders.cancelled, 1);
  assert.equal(body.data.orders.active, 0);
  assert.equal(body.data.orders.history, 2);
  assert.equal(body.data.favoriteCount, 1);
});

test('ringkasan profil penjual memuat jumlah menu, bukan favorit', async () => {
  const { status, body } = await ctx.request('GET', '/api/users/me/stats', {
    token: ctx.tokens.sellerA,
  });
  assert.equal(status, 200);
  assert.equal(body.data.role, 'penjual');
  assert.ok(body.data.menuCount > 0, 'penjual memiliki menu');
  assert.equal(body.data.favoriteCount, undefined, 'favorit bukan milik penjual');
  // Pesanan yang dihitung adalah yang masuk ke kantinnya sendiri.
  assert.ok(body.data.orders.total >= 2);
});

test('ringkasan profil tidak dapat diakses tanpa kunci akses', async () => {
  const { status } = await ctx.request('GET', '/api/users/me/stats');
  assert.equal(status, 401);
});
