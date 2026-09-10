import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestContext } from './helpers.js';

/**
 * Pengujian riwayat notifikasi dan pendaftaran perangkat.
 * Kredensial Firebase sengaja tidak dipasang, sehingga pengujian ini sekaligus
 * memastikan riwayat tetap tersimpan walau pesan push tidak dikirim.
 */

let ctx;

before(async () => {
  ctx = await setupTestContext();
});

after(async () => {
  await ctx.close();
});

/** Membuat satu pesanan berisi Nasi Goreng dari kantin A. */
async function buatPesanan() {
  await ctx.request('DELETE', '/api/cart', { token: ctx.tokens.buyer });
  await ctx.request('POST', '/api/cart/items', {
    token: ctx.tokens.buyer,
    body: { menuItemId: ctx.fixtures.menu.nasiGoreng, quantity: 1 },
  });
  const { body } = await ctx.request('POST', '/api/orders', {
    token: ctx.tokens.buyer,
    body: {},
  });
  return body.data[0];
}

test('daftar notifikasi awalnya kosong', async () => {
  const { status, body } = await ctx.request('GET', '/api/notifications', {
    token: ctx.tokens.buyer,
  });
  assert.equal(status, 200);
  assert.equal(body.data.length, 0);
  assert.equal(body.meta.unreadCount, 0);
});

test('penjual menerima notifikasi ketika pesanan baru masuk', async () => {
  const pesanan = await buatPesanan();

  const { body } = await ctx.request('GET', '/api/notifications', { token: ctx.tokens.sellerA });
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].type, 'order_created');
  assert.equal(body.data[0].order.orderNumber, pesanan.orderNumber);
  assert.equal(body.data[0].isRead, false);
  assert.equal(body.meta.unreadCount, 1);
});

test('pembeli menerima notifikasi ketika pesanannya disiapkan', async () => {
  const pesanan = await buatPesanan();
  await ctx.request('PATCH', `/api/seller/orders/${pesanan.id}/accept`, {
    token: ctx.tokens.sellerA,
  });

  const { body } = await ctx.request('GET', '/api/notifications', { token: ctx.tokens.buyer });
  const terbaru = body.data[0];
  assert.equal(terbaru.type, 'order_status_changed');
  assert.equal(terbaru.title, 'Pesanan sedang disiapkan');
  assert.match(terbaru.body, /Kantin FSTI/);
  assert.equal(terbaru.order.status, 'diproses');
});

test('penolakan pesanan menyertakan alasannya pada notifikasi', async () => {
  const pesanan = await buatPesanan();
  await ctx.request('PATCH', `/api/seller/orders/${pesanan.id}/reject`, {
    token: ctx.tokens.sellerA,
    body: { reason: 'Bahan habis' },
  });

  const { body } = await ctx.request('GET', '/api/notifications', { token: ctx.tokens.buyer });
  assert.equal(body.data[0].title, 'Pesanan ditolak');
  assert.match(body.data[0].body, /Bahan habis/);
});

test('penjual menerima notifikasi ketika pembeli membatalkan', async () => {
  const pesanan = await buatPesanan();
  const sebelum = await ctx.request('GET', '/api/notifications/unread-count', {
    token: ctx.tokens.sellerA,
  });

  await ctx.request('PATCH', `/api/orders/${pesanan.id}/cancel`, { token: ctx.tokens.buyer });

  const { body } = await ctx.request('GET', '/api/notifications', { token: ctx.tokens.sellerA });
  assert.equal(body.data[0].type, 'order_cancelled');
  assert.ok(body.meta.unreadCount > sebelum.body.data.unreadCount);
});

test('notifikasi tidak bocor antar pengguna', async () => {
  const { body } = await ctx.request('GET', '/api/notifications', { token: ctx.tokens.buyerTwo });
  assert.equal(body.data.length, 0, 'pembeli lain tidak menerima notifikasi milik orang lain');

  const penjualLain = await ctx.request('GET', '/api/notifications', { token: ctx.tokens.sellerB });
  assert.equal(penjualLain.body.data.length, 0, 'penjual lain tidak menerima pesanan kantin A');
});

test('menandai satu notifikasi sebagai sudah dibaca', async () => {
  const { body: daftar } = await ctx.request('GET', '/api/notifications', {
    token: ctx.tokens.buyer,
  });
  const id = daftar.data[0].id;
  const sebelum = daftar.meta.unreadCount;

  const { status, body } = await ctx.request('PATCH', `/api/notifications/${id}/read`, {
    token: ctx.tokens.buyer,
  });
  assert.equal(status, 200);
  assert.equal(body.data.isRead, true);
  assert.ok(body.data.readAt);

  const sesudah = await ctx.request('GET', '/api/notifications/unread-count', {
    token: ctx.tokens.buyer,
  });
  assert.equal(sesudah.body.data.unreadCount, sebelum - 1);
});

test('menandai seluruh notifikasi sebagai sudah dibaca', async () => {
  const { status, body } = await ctx.request('PATCH', '/api/notifications/read-all', {
    token: ctx.tokens.buyer,
  });
  assert.equal(status, 200);
  assert.equal(body.data.unreadCount, 0);

  const { body: daftar } = await ctx.request('GET', '/api/notifications?unreadOnly=true', {
    token: ctx.tokens.buyer,
  });
  assert.equal(daftar.data.length, 0);
});

test('notifikasi milik pengguna lain tidak dapat ditandai', async () => {
  const { body: milikPenjual } = await ctx.request('GET', '/api/notifications', {
    token: ctx.tokens.sellerA,
  });
  const id = milikPenjual.data[0].id;

  const { status } = await ctx.request('PATCH', `/api/notifications/${id}/read`, {
    token: ctx.tokens.buyer,
  });
  assert.equal(status, 404);
});

test('perangkat dapat didaftarkan dan dicabut', async () => {
  const token = 'token-perangkat-uji-abcdef123456';

  const daftar = await ctx.request('POST', '/api/notifications/devices', {
    token: ctx.tokens.buyer,
    body: { token, platform: 'android' },
  });
  assert.equal(daftar.status, 201);

  // Pendaftaran ulang token yang sama tidak dianggap kesalahan.
  const ulang = await ctx.request('POST', '/api/notifications/devices', {
    token: ctx.tokens.buyer,
    body: { token, platform: 'android' },
  });
  assert.equal(ulang.status, 201);

  const cabut = await ctx.request('DELETE', `/api/notifications/devices/${token}`, {
    token: ctx.tokens.buyer,
  });
  assert.equal(cabut.status, 200);
});

test('perangkat milik pengguna lain tidak dapat dicabut', async () => {
  const token = 'token-milik-pembeli-satu-xyz';
  await ctx.request('POST', '/api/notifications/devices', {
    token: ctx.tokens.buyer,
    body: { token },
  });

  const { status } = await ctx.request('DELETE', `/api/notifications/devices/${token}`, {
    token: ctx.tokens.buyerTwo,
  });
  assert.equal(status, 404);
});

test('pendaftaran perangkat menolak isian yang tidak sesuai', async () => {
  for (const body of [{}, { token: '' }, { token: 'abc', platform: 'symbian' }, { token: 'abc', extra: 1 }]) {
    const { status } = await ctx.request('POST', '/api/notifications/devices', {
      token: ctx.tokens.buyer,
      body,
    });
    assert.equal(status, 422, JSON.stringify(body));
  }
});

test('jalur notifikasi menolak permintaan tanpa kunci akses', async () => {
  for (const [method, endpoint] of [
    ['GET', '/api/notifications'],
    ['GET', '/api/notifications/unread-count'],
    ['PATCH', '/api/notifications/read-all'],
    ['POST', '/api/notifications/devices'],
  ]) {
    const { status } = await ctx.request(method, endpoint);
    assert.equal(status, 401, `${method} ${endpoint}`);
  }
});

test('pesanan tetap berhasil walau pesan push tidak dapat dikirim', async () => {
  // Kredensial Firebase tidak dipasang pada pengujian, sehingga jalur push
  // dilewati. Pembuatan pesanan tetap harus berjalan normal.
  const pesanan = await buatPesanan();
  assert.match(pesanan.orderNumber, /^ORD-\d{8}-\d{4}$/);
  assert.equal(pesanan.status, 'menunggu_konfirmasi');
});
