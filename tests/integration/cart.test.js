import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestContext } from './helpers.js';

/** Pengujian aturan keranjang melalui pemanggilan API yang sebenarnya. */

let ctx;

before(async () => {
  ctx = await setupTestContext();
});

after(async () => {
  await ctx.close();
});

async function emptyCart() {
  await ctx.request('DELETE', '/api/cart', { token: ctx.tokens.buyer });
}

test('keranjang awalnya kosong', async () => {
  await emptyCart();
  const { status, body } = await ctx.request('GET', '/api/cart', { token: ctx.tokens.buyer });
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.deepEqual(body.data.items, []);
  assert.equal(body.data.totalAmount, 0);
});

test('menambahkan menu ke keranjang', async () => {
  await emptyCart();
  const { status, body } = await ctx.request('POST', '/api/cart/items', {
    token: ctx.tokens.buyer,
    body: { menuItemId: ctx.fixtures.menu.nasiGoreng, quantity: 2 },
  });

  assert.equal(status, 201);
  assert.equal(body.data.items.length, 1);
  assert.equal(body.data.items[0].quantity, 2);
  assert.equal(body.data.items[0].price, 15000);
  assert.equal(body.data.items[0].subtotal, 30000);
  assert.equal(body.data.totalAmount, 30000);
  assert.equal(body.data.canteen.id, ctx.fixtures.canteenA);
});

test('menambahkan menu yang sama menambah jumlahnya, bukan barisnya', async () => {
  await emptyCart();
  await ctx.request('POST', '/api/cart/items', {
    token: ctx.tokens.buyer,
    body: { menuItemId: ctx.fixtures.menu.nasiGoreng, quantity: 2 },
  });
  const { body } = await ctx.request('POST', '/api/cart/items', {
    token: ctx.tokens.buyer,
    body: { menuItemId: ctx.fixtures.menu.nasiGoreng, quantity: 3 },
  });

  assert.equal(body.data.items.length, 1);
  assert.equal(body.data.items[0].quantity, 5);
  assert.equal(body.data.totalAmount, 75000);
});

test('menolak menu yang sedang tidak tersedia', async () => {
  await emptyCart();
  const { status, body } = await ctx.request('POST', '/api/cart/items', {
    token: ctx.tokens.buyer,
    body: { menuItemId: ctx.fixtures.menu.habis, quantity: 1 },
  });

  assert.equal(status, 409);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'MENU_UNAVAILABLE');
});

test('menolak menu dari kantin yang berbeda', async () => {
  await emptyCart();
  await ctx.request('POST', '/api/cart/items', {
    token: ctx.tokens.buyer,
    body: { menuItemId: ctx.fixtures.menu.nasiGoreng, quantity: 1 },
  });

  const { status, body } = await ctx.request('POST', '/api/cart/items', {
    token: ctx.tokens.buyer,
    body: { menuItemId: ctx.fixtures.menu.mieGorengB, quantity: 1 },
  });

  assert.equal(status, 409);
  assert.equal(body.error.code, 'CART_DIFFERENT_CANTEEN');
  // Keranjang yang sudah ada tidak berubah oleh permintaan yang ditolak.
  const { body: cart } = await ctx.request('GET', '/api/cart', { token: ctx.tokens.buyer });
  assert.equal(cart.data.items.length, 1);
  assert.equal(cart.data.canteen.id, ctx.fixtures.canteenA);
});

test('persetujuan ganti kantin mengosongkan keranjang lalu berpindah kantin', async () => {
  await emptyCart();
  await ctx.request('POST', '/api/cart/items', {
    token: ctx.tokens.buyer,
    body: { menuItemId: ctx.fixtures.menu.nasiGoreng, quantity: 1 },
  });

  const { status, body } = await ctx.request('POST', '/api/cart/items', {
    token: ctx.tokens.buyer,
    body: { menuItemId: ctx.fixtures.menu.mieGorengB, quantity: 1, replaceCanteen: true },
  });

  assert.equal(status, 201);
  assert.equal(body.data.items.length, 1);
  assert.equal(body.data.canteen.id, ctx.fixtures.canteenB);
});

test('mengubah jumlah salah satu item keranjang', async () => {
  await emptyCart();
  const { body: added } = await ctx.request('POST', '/api/cart/items', {
    token: ctx.tokens.buyer,
    body: { menuItemId: ctx.fixtures.menu.nasiGoreng, quantity: 1 },
  });
  const itemId = added.data.items[0].id;

  const { status, body } = await ctx.request('PATCH', `/api/cart/items/${itemId}`, {
    token: ctx.tokens.buyer,
    body: { quantity: 4 },
  });

  assert.equal(status, 200);
  assert.equal(body.data.items[0].quantity, 4);
  assert.equal(body.data.totalAmount, 60000);
});

test('menghapus item dari keranjang', async () => {
  await emptyCart();
  const { body: added } = await ctx.request('POST', '/api/cart/items', {
    token: ctx.tokens.buyer,
    body: { menuItemId: ctx.fixtures.menu.nasiGoreng, quantity: 1 },
  });
  const itemId = added.data.items[0].id;

  const { status, body } = await ctx.request('DELETE', `/api/cart/items/${itemId}`, {
    token: ctx.tokens.buyer,
  });

  assert.equal(status, 200);
  assert.equal(body.data.items.length, 0);
  assert.equal(body.data.totalAmount, 0);
});

test('pembeli tidak dapat menyentuh item keranjang pembeli lain', async () => {
  await emptyCart();
  const { body: added } = await ctx.request('POST', '/api/cart/items', {
    token: ctx.tokens.buyer,
    body: { menuItemId: ctx.fixtures.menu.nasiGoreng, quantity: 1 },
  });
  const itemId = added.data.items[0].id;

  const patched = await ctx.request('PATCH', `/api/cart/items/${itemId}`, {
    token: ctx.tokens.buyerTwo,
    body: { quantity: 99 },
  });
  assert.equal(patched.status, 404);
  assert.equal(patched.body.error.code, 'CART_ITEM_NOT_FOUND');

  const deleted = await ctx.request('DELETE', `/api/cart/items/${itemId}`, {
    token: ctx.tokens.buyerTwo,
  });
  assert.equal(deleted.status, 404);

  // Keranjang milik pemiliknya tidak berubah.
  const { body: cart } = await ctx.request('GET', '/api/cart', { token: ctx.tokens.buyer });
  assert.equal(cart.data.items[0].quantity, 1);
});

test('penjual tidak memiliki akses ke keranjang sama sekali', async () => {
  const { status, body } = await ctx.request('GET', '/api/cart', { token: ctx.tokens.sellerA });
  assert.equal(status, 403);
  assert.equal(body.error.code, 'FORBIDDEN_ROLE');
});

test('menolak jumlah yang tidak valid', async () => {
  await emptyCart();
  for (const quantity of [0, -1, 1.5, 1000]) {
    const { status } = await ctx.request('POST', '/api/cart/items', {
      token: ctx.tokens.buyer,
      body: { menuItemId: ctx.fixtures.menu.nasiGoreng, quantity },
    });
    assert.equal(status, 422, `quantity ${quantity} seharusnya ditolak`);
  }
});

test('menolak id menu yang tidak ada', async () => {
  const { status, body } = await ctx.request('POST', '/api/cart/items', {
    token: ctx.tokens.buyer,
    body: { menuItemId: 999999, quantity: 1 },
  });
  assert.equal(status, 404);
  assert.equal(body.error.code, 'MENU_NOT_FOUND');
});

test('menolak field harga yang dikirim dari aplikasi', async () => {
  await emptyCart();
  const { status } = await ctx.request('POST', '/api/cart/items', {
    token: ctx.tokens.buyer,
    body: { menuItemId: ctx.fixtures.menu.nasiGoreng, quantity: 1, price: 1 },
  });
  // Aturan pemeriksaan bersifat ketat, sehingga field tak dikenal ditolak
  // alih-alih diterima diam-diam.
  assert.equal(status, 422);
});
