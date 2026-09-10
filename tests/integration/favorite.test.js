import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestContext } from './helpers.js';

/**
 * Pengujian menu favorit milik pembeli, beserta penanda favorit yang ikut
 * terkirim pada daftar menu.
 */

let ctx;

before(async () => {
  ctx = await setupTestContext();
});

after(async () => {
  await ctx.close();
});

test('daftar favorit awalnya kosong', async () => {
  const { status, body } = await ctx.request('GET', '/api/favorites', { token: ctx.tokens.buyer });
  assert.equal(status, 200);
  assert.equal(body.data.length, 0);
  assert.equal(body.meta.total, 0);
});

test('menandai menu sebagai favorit', async () => {
  const { status, body } = await ctx.request('POST', '/api/favorites', {
    token: ctx.tokens.buyer,
    body: { menuItemId: ctx.fixtures.menu.nasiGoreng },
  });
  assert.equal(status, 201);
  assert.equal(body.data.id, ctx.fixtures.menu.nasiGoreng);
  assert.equal(body.data.isFavorite, true);

  const daftar = await ctx.request('GET', '/api/favorites', { token: ctx.tokens.buyer });
  assert.equal(daftar.body.data.length, 1);
  assert.equal(daftar.body.data[0].name, 'Nasi Goreng');
});

test('penandaan berulang tidak menggandakan baris favorit', async () => {
  for (let i = 0; i < 3; i += 1) {
    const { status } = await ctx.request('POST', '/api/favorites', {
      token: ctx.tokens.buyer,
      body: { menuItemId: ctx.fixtures.menu.nasiGoreng },
    });
    assert.equal(status, 201);
  }

  const { body } = await ctx.request('GET', '/api/favorites', { token: ctx.tokens.buyer });
  assert.equal(body.meta.total, 1, 'favorit tetap satu baris');
});

test('penanda favorit ikut terkirim pada daftar menu', async () => {
  const { body } = await ctx.request('GET', '/api/menu', { token: ctx.tokens.buyer });
  const nasiGoreng = body.data.find((m) => m.id === ctx.fixtures.menu.nasiGoreng);
  const esTeh = body.data.find((m) => m.id === ctx.fixtures.menu.esTeh);
  assert.equal(nasiGoreng.isFavorite, true);
  assert.equal(esTeh.isFavorite, false);
});

test('penanda favorit ikut terkirim pada detail menu dan menu kantin', async () => {
  const detail = await ctx.request('GET', `/api/menu/${ctx.fixtures.menu.nasiGoreng}`, {
    token: ctx.tokens.buyer,
  });
  assert.equal(detail.body.data.isFavorite, true);

  const kantin = await ctx.request('GET', `/api/canteens/${ctx.fixtures.canteenA}/menu`, {
    token: ctx.tokens.buyer,
  });
  const nasiGoreng = kantin.body.data.menu.find((m) => m.id === ctx.fixtures.menu.nasiGoreng);
  assert.equal(nasiGoreng.isFavorite, true);
});

test('favorit tidak tercampur antar pembeli', async () => {
  const { body } = await ctx.request('GET', '/api/favorites', { token: ctx.tokens.buyerTwo });
  assert.equal(body.data.length, 0, 'pembeli lain tidak ikut memiliki favorit');

  const menu = await ctx.request('GET', '/api/menu', { token: ctx.tokens.buyerTwo });
  const nasiGoreng = menu.body.data.find((m) => m.id === ctx.fixtures.menu.nasiGoreng);
  assert.equal(nasiGoreng.isFavorite, false);
});

test('menghapus menu dari favorit', async () => {
  const { status, body } = await ctx.request(
    'DELETE',
    `/api/favorites/${ctx.fixtures.menu.nasiGoreng}`,
    { token: ctx.tokens.buyer },
  );
  assert.equal(status, 200);
  assert.equal(body.data.isFavorite, false);

  const daftar = await ctx.request('GET', '/api/favorites', { token: ctx.tokens.buyer });
  assert.equal(daftar.body.meta.total, 0);
});

test('menghapus favorit yang memang belum ditandai tetap berhasil', async () => {
  const { status, body } = await ctx.request(
    'DELETE',
    `/api/favorites/${ctx.fixtures.menu.esTeh}`,
    { token: ctx.tokens.buyer },
  );
  assert.equal(status, 200);
  assert.equal(body.data.isFavorite, false);
});

test('menolak id menu yang tidak ada', async () => {
  const { status, body } = await ctx.request('POST', '/api/favorites', {
    token: ctx.tokens.buyer,
    body: { menuItemId: 999999 },
  });
  assert.equal(status, 404);
  assert.equal(body.error.code, 'MENU_NOT_FOUND');
});

test('menolak id yang bukan angka dan field tambahan', async () => {
  const bukanAngka = await ctx.request('DELETE', '/api/favorites/abc', { token: ctx.tokens.buyer });
  assert.equal(bukanAngka.status, 422);

  const fieldTambahan = await ctx.request('POST', '/api/favorites', {
    token: ctx.tokens.buyer,
    body: { menuItemId: ctx.fixtures.menu.esTeh, userId: 1 },
  });
  assert.equal(fieldTambahan.status, 422, 'userId bukan field yang diterima');
});

test('penjual tidak memiliki akses ke favorit', async () => {
  for (const [method, endpoint] of [
    ['GET', '/api/favorites'],
    ['POST', '/api/favorites'],
    ['DELETE', '/api/favorites/1'],
  ]) {
    const { status } = await ctx.request(method, endpoint, {
      token: ctx.tokens.sellerA,
      body: method === 'POST' ? { menuItemId: ctx.fixtures.menu.nasiGoreng } : undefined,
    });
    assert.equal(status, 403, `${method} ${endpoint} seharusnya ditolak`);
  }
});

test('menu yang dihapus penjual ikut hilang dari daftar favorit', async () => {
  const { body: dibuat } = await ctx.request('POST', '/api/seller/menu', {
    token: ctx.tokens.sellerA,
    body: { name: 'Menu Favorit Sementara', price: 11000 },
  });
  const menuId = dibuat.data.id;

  await ctx.request('POST', '/api/favorites', {
    token: ctx.tokens.buyer,
    body: { menuItemId: menuId },
  });
  const sebelum = await ctx.request('GET', '/api/favorites', { token: ctx.tokens.buyer });
  assert.equal(sebelum.body.meta.total, 1);

  await ctx.request('DELETE', `/api/seller/menu/${menuId}`, { token: ctx.tokens.sellerA });

  const sesudah = await ctx.request('GET', '/api/favorites', { token: ctx.tokens.buyer });
  assert.equal(sesudah.body.meta.total, 0, 'menu terhapus tidak lagi muncul di favorit');
});

test('favorit tetap dapat ditandai pada menu yang sedang tidak tersedia', async () => {
  // Menu habis masih boleh disukai, karena favorit bukan penambahan ke keranjang.
  const { status, body } = await ctx.request('POST', '/api/favorites', {
    token: ctx.tokens.buyer,
    body: { menuItemId: ctx.fixtures.menu.habis },
  });
  assert.equal(status, 201);
  assert.equal(body.data.isFavorite, true);
  assert.equal(body.data.isAvailable, false);
});
