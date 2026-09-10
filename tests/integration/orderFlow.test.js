import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestContext } from './helpers.js';

/**
 * Pengujian menyeluruh untuk pembuatan pesanan, aturan perpindahan status, dan
 * pembatasan kepemilikan data.
 */

let ctx;

before(async () => {
  ctx = await setupTestContext();
});

after(async () => {
  await ctx.close();
});

async function emptyCart(token = ctx.tokens.buyer) {
  await ctx.request('DELETE', '/api/cart', { token });
}

async function addToCart(menuItemId, quantity, token = ctx.tokens.buyer) {
  return ctx.request('POST', '/api/cart/items', { token, body: { menuItemId, quantity } });
}

/** Memesan 2 Nasi Goreng dan 1 Es Teh senilai 35000, lalu mengembalikan pesanannya. */
async function createOrder(note = null) {
  await emptyCart();
  await addToCart(ctx.fixtures.menu.nasiGoreng, 2);
  await addToCart(ctx.fixtures.menu.esTeh, 1);
  const { status, body } = await ctx.request('POST', '/api/orders', {
    token: ctx.tokens.buyer,
    body: { note },
  });
  assert.equal(status, 201, `checkout gagal: ${JSON.stringify(body)}`);
  // Seluruh isinya berasal dari satu kantin, sehingga menghasilkan satu pesanan.
  assert.equal(body.data.length, 1);
  return body.data[0];
}

test('menolak pembuatan pesanan saat keranjang kosong', async () => {
  await emptyCart();
  const { status, body } = await ctx.request('POST', '/api/orders', {
    token: ctx.tokens.buyer,
    body: {},
  });
  assert.equal(status, 422);
  assert.equal(body.error.code, 'CART_EMPTY');
});

test('total dihitung di server dan keranjang dikosongkan setelah pesanan dibuat', async () => {
  const order = await createOrder('Pedas sedikit');

  // Dua kali 15000 ditambah satu kali 5000.
  assert.equal(order.totalAmount, 35000);
  assert.equal(order.items.length, 2);
  assert.equal(order.status, 'menunggu_konfirmasi');
  assert.equal(order.statusLabel, 'Menunggu Konfirmasi');
  assert.equal(order.note, 'Pedas sedikit');
  assert.match(order.orderNumber, /^ORD-\d{8}-\d{4}$/);
  assert.equal(order.canteen.id, ctx.fixtures.canteenA);

  const nasiGoreng = order.items.find((item) => item.menuName === 'Nasi Goreng');
  assert.equal(nasiGoreng.price, 15000);
  assert.equal(nasiGoreng.quantity, 2);
  assert.equal(nasiGoreng.subtotal, 30000);

  const { body: cart } = await ctx.request('GET', '/api/cart', { token: ctx.tokens.buyer });
  assert.deepEqual(cart.data.items, [], 'keranjang harus kosong setelah checkout');
});

test('total yang dikirim aplikasi ditolak, bukan dipercaya', async () => {
  await emptyCart();
  await addToCart(ctx.fixtures.menu.nasiGoreng, 2);
  const { status } = await ctx.request('POST', '/api/orders', {
    token: ctx.tokens.buyer,
    body: { totalAmount: 1, total_amount: 1 },
  });
  assert.equal(status, 422);
});

test('harga pada pesanan tetap meski harga menu berubah kemudian', async () => {
  const order = await createOrder();
  const originalPrice = order.items.find((item) => item.menuName === 'Nasi Goreng').price;
  assert.equal(originalPrice, 15000);

  // Penjual menaikkan harga setelah pesanan terlanjur dibuat.
  const updated = await ctx.request('PATCH', `/api/seller/menu/${ctx.fixtures.menu.nasiGoreng}`, {
    token: ctx.tokens.sellerA,
    body: { price: 25000 },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.price, 25000);

  const { body: reread } = await ctx.request('GET', `/api/orders/${order.id}`, {
    token: ctx.tokens.buyer,
  });
  assert.equal(reread.data.items.find((item) => item.menuName === 'Nasi Goreng').price, 15000);
  assert.equal(reread.data.totalAmount, 35000, 'total historis tidak boleh berubah');

  // Mengembalikan harga semula untuk pengujian berikutnya.
  await ctx.request('PATCH', `/api/seller/menu/${ctx.fixtures.menu.nasiGoreng}`, {
    token: ctx.tokens.sellerA,
    body: { price: 15000 },
  });
});

test('pesanan gagal dan dibatalkan seluruhnya bila ada menu yang tidak tersedia', async () => {
  await emptyCart();
  await addToCart(ctx.fixtures.menu.esTeh, 1);

  // Penjual menandai menu tidak tersedia setelah menu masuk keranjang.
  await ctx.request('PATCH', `/api/seller/menu/${ctx.fixtures.menu.esTeh}`, {
    token: ctx.tokens.sellerA,
    body: { isAvailable: false },
  });

  const { status, body } = await ctx.request('POST', '/api/orders', {
    token: ctx.tokens.buyer,
    body: {},
  });
  assert.equal(status, 422);
  assert.equal(body.error.code, 'MENU_UNAVAILABLE');

  // Seluruh perubahan dibatalkan: isi keranjang utuh dan tidak ada pesanan baru.
  const { body: cart } = await ctx.request('GET', '/api/cart', { token: ctx.tokens.buyer });
  assert.equal(cart.data.items.length, 1);

  await ctx.request('PATCH', `/api/seller/menu/${ctx.fixtures.menu.esTeh}`, {
    token: ctx.tokens.sellerA,
    body: { isAvailable: true },
  });
});

test('keranjang campur dipecah menjadi satu pesanan untuk tiap kantin', async () => {
  await emptyCart();
  await addToCart(ctx.fixtures.menu.nasiGoreng, 2);
  await addToCart(ctx.fixtures.menu.esTeh, 1);
  await addToCart(ctx.fixtures.menu.mieGorengB, 1);

  const { status, body } = await ctx.request('POST', '/api/orders', {
    token: ctx.tokens.buyer,
    body: { note: 'Tanpa sambal' },
  });
  assert.equal(status, 201, JSON.stringify(body));
  assert.equal(body.data.length, 2, 'dua kantin menghasilkan dua pesanan');

  const perKantin = new Map(body.data.map((o) => [o.canteen.id, o]));
  const pesananA = perKantin.get(ctx.fixtures.canteenA);
  const pesananB = perKantin.get(ctx.fixtures.canteenB);

  assert.equal(pesananA.totalAmount, 35000, 'dua Nasi Goreng ditambah satu Es Teh');
  assert.equal(pesananA.items.length, 2);
  assert.equal(pesananB.totalAmount, 14000, 'satu Mie Goreng');
  assert.equal(pesananB.items.length, 1);

  // Nomor pesanan tiap kantin berbeda, dan catatan yang sama ikut pada keduanya.
  assert.notEqual(pesananA.orderNumber, pesananB.orderNumber);
  assert.equal(pesananA.note, 'Tanpa sambal');
  assert.equal(pesananB.note, 'Tanpa sambal');

  // Seluruh isi keranjang habis setelah pesanan dibuat.
  const { body: cart } = await ctx.request('GET', '/api/cart', { token: ctx.tokens.buyer });
  assert.equal(cart.data.items.length, 0);
});

test('kantin yang tutup membatalkan seluruh pesanan pada keranjang campur', async () => {
  await emptyCart();
  await addToCart(ctx.fixtures.menu.nasiGoreng, 1);
  await addToCart(ctx.fixtures.menu.mieGorengB, 1);

  // Kantin B ditutup pemiliknya setelah menunya masuk keranjang.
  await ctx.request('PATCH', '/api/seller/canteen', {
    token: ctx.tokens.sellerB,
    body: { isOpen: false },
  });

  const { status, body } = await ctx.request('POST', '/api/orders', {
    token: ctx.tokens.buyer,
    body: {},
  });
  assert.equal(status, 422);
  assert.equal(body.error.code, 'CANTEEN_CLOSED');

  // Tidak ada pesanan yang tersimpan sebagian, dan keranjang tetap utuh.
  const { body: cart } = await ctx.request('GET', '/api/cart', { token: ctx.tokens.buyer });
  assert.equal(cart.data.items.length, 2);

  await ctx.request('PATCH', '/api/seller/canteen', {
    token: ctx.tokens.sellerB,
    body: { isOpen: true },
  });
  await emptyCart();
});

test('pembeli tidak dapat membaca pesanan pembeli lain', async () => {
  const order = await createOrder();
  const { status, body } = await ctx.request('GET', `/api/orders/${order.id}`, {
    token: ctx.tokens.buyerTwo,
  });
  assert.equal(status, 404);
  assert.equal(body.error.code, 'ORDER_NOT_FOUND');
});

test('daftar pesanan hanya memuat pesanan milik sendiri', async () => {
  await createOrder();
  const { body } = await ctx.request('GET', '/api/orders', { token: ctx.tokens.buyerTwo });
  assert.equal(body.data.length, 0);
});

test('pembeli dapat membatalkan selama pesanan masih menunggu konfirmasi', async () => {
  const order = await createOrder();
  const { status, body } = await ctx.request('PATCH', `/api/orders/${order.id}/cancel`, {
    token: ctx.tokens.buyer,
  });
  assert.equal(status, 200);
  assert.equal(body.data.status, 'dibatalkan');
});

test('pembeli tidak dapat membatalkan setelah pesanan diterima penjual', async () => {
  const order = await createOrder();
  await ctx.request('PATCH', `/api/seller/orders/${order.id}/accept`, { token: ctx.tokens.sellerA });

  const { status, body } = await ctx.request('PATCH', `/api/orders/${order.id}/cancel`, {
    token: ctx.tokens.buyer,
  });
  assert.equal(status, 409);
  assert.equal(body.error.code, 'ORDER_NOT_CANCELLABLE');
});

test('pembeli tidak dapat membatalkan pesanan pembeli lain', async () => {
  const order = await createOrder();
  const { status } = await ctx.request('PATCH', `/api/orders/${order.id}/cancel`, {
    token: ctx.tokens.buyerTwo,
  });
  assert.equal(status, 404);
});

test('alur normal berjalan melewati seluruh status', async () => {
  const order = await createOrder();
  // Penerimaan pesanan langsung menuju `diproses`, tanpa singgah di `diterima`.
  const steps = [
    ['accept', 'diproses'],
    ['ready', 'siap_diambil'],
    ['complete', 'selesai'],
  ];

  for (const [action, expected] of steps) {
    const { status, body } = await ctx.request('PATCH', `/api/seller/orders/${order.id}/${action}`, {
      token: ctx.tokens.sellerA,
    });
    assert.equal(status, 200, `${action} gagal: ${JSON.stringify(body)}`);
    assert.equal(body.data.status, expected);
  }
});

test('penjual tidak dapat melompati tahap status', async () => {
  const order = await createOrder();
  const { status, body } = await ctx.request('PATCH', `/api/seller/orders/${order.id}/ready`, {
    token: ctx.tokens.sellerA,
  });
  assert.equal(status, 409);
  assert.equal(body.error.code, 'INVALID_ORDER_STATUS_TRANSITION');
  assert.match(body.message, /MENUNGGU KONFIRMASI/);
});

test('penerimaan pesanan langsung membuat pembeli melihatnya sedang disiapkan', async () => {
  const order = await createOrder();
  const diterima = await ctx.request('PATCH', `/api/seller/orders/${order.id}/accept`, {
    token: ctx.tokens.sellerA,
  });
  assert.equal(diterima.status, 200);
  assert.equal(diterima.body.data.status, 'diproses');

  // Pembeli membaca pesanannya sendiri dan memperoleh keterangan yang sama.
  const { body } = await ctx.request('GET', `/api/orders/${order.id}`, { token: ctx.tokens.buyer });
  assert.equal(body.data.status, 'diproses');
  assert.equal(body.data.statusLabel, 'Sedang Disiapkan');
  assert.equal(body.data.isCancellable, false, 'pesanan yang disiapkan tidak dapat dibatalkan');
});

test('penjual tidak dapat memundurkan status pesanan', async () => {
  const order = await createOrder();
  await ctx.request('PATCH', `/api/seller/orders/${order.id}/accept`, { token: ctx.tokens.sellerA });

  const { status, body } = await ctx.request('PATCH', `/api/seller/orders/${order.id}/accept`, {
    token: ctx.tokens.sellerA,
  });
  assert.equal(status, 409);
  assert.equal(body.error.code, 'INVALID_ORDER_STATUS_TRANSITION');
});

test('penolakan menyimpan alasan dan menutup perubahan status berikutnya', async () => {
  const order = await createOrder();
  const { status, body } = await ctx.request('PATCH', `/api/seller/orders/${order.id}/reject`, {
    token: ctx.tokens.sellerA,
    body: { reason: 'Stok habis' },
  });
  assert.equal(status, 200);
  assert.equal(body.data.status, 'ditolak');
  assert.equal(body.data.rejectReason, 'Stok habis');

  const followUp = await ctx.request('PATCH', `/api/seller/orders/${order.id}/process`, {
    token: ctx.tokens.sellerA,
  });
  assert.equal(followUp.status, 409);
});

test('penolakan tanpa alasan tetap diperbolehkan', async () => {
  const order = await createOrder();
  const { status, body } = await ctx.request('PATCH', `/api/seller/orders/${order.id}/reject`, {
    token: ctx.tokens.sellerA,
  });
  assert.equal(status, 200);
  assert.equal(body.data.rejectReason, null);
});

test('penjual tidak dapat melihat pesanan milik penjual lain', async () => {
  const order = await createOrder();
  const { status, body } = await ctx.request('GET', `/api/seller/orders/${order.id}`, {
    token: ctx.tokens.sellerB,
  });
  assert.equal(status, 404);
  assert.equal(body.error.code, 'ORDER_NOT_FOUND');
});

test('penjual tidak dapat mengubah status pesanan milik penjual lain', async () => {
  const order = await createOrder();
  for (const action of ['accept', 'reject', 'process', 'ready', 'complete']) {
    const { status } = await ctx.request('PATCH', `/api/seller/orders/${order.id}/${action}`, {
      token: ctx.tokens.sellerB,
    });
    assert.equal(status, 404, `${action} oleh penjual lain seharusnya 404`);
  }

  // Pesanan tidak berubah sama sekali.
  const { body } = await ctx.request('GET', `/api/orders/${order.id}`, { token: ctx.tokens.buyer });
  assert.equal(body.data.status, 'menunggu_konfirmasi');
});

test('pembeli tidak dapat mengakses jalur penjual', async () => {
  const order = await createOrder();
  const { status, body } = await ctx.request('PATCH', `/api/seller/orders/${order.id}/accept`, {
    token: ctx.tokens.buyer,
  });
  assert.equal(status, 403);
  assert.equal(body.error.code, 'FORBIDDEN_ROLE');
});

test('kelompok riwayat hanya memuat pesanan yang sudah berakhir', async () => {
  const order = await createOrder();
  await ctx.request('PATCH', `/api/orders/${order.id}/cancel`, { token: ctx.tokens.buyer });

  const { body } = await ctx.request('GET', '/api/orders?scope=history', {
    token: ctx.tokens.buyer,
  });
  assert.ok(body.data.length > 0);
  for (const item of body.data) {
    assert.ok(['selesai', 'ditolak', 'dibatalkan'].includes(item.status));
  }
});

test('dasbor penjual menampilkan jumlah pesanan per status', async () => {
  const { status, body } = await ctx.request('GET', '/api/seller/dashboard', {
    token: ctx.tokens.sellerA,
  });
  assert.equal(status, 200);
  assert.equal(body.data.canteen.id, ctx.fixtures.canteenA);
  assert.equal(typeof body.data.summary.pesananBaru, 'number');
  assert.ok(Array.isArray(body.data.recentOrders));
});
