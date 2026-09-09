import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ORDER_STATUS,
  ORDER_STATUS_VALUES,
  BUYER_CANCELLABLE_STATUSES,
  ORDER_HISTORY_STATUSES,
  canTransition,
  isTerminalStatus,
  formatStatus,
} from '../../src/constants/orderStatus.js';

/**
 * Pengujian aturan perpindahan status pesanan.
 *
 * Aturan ini paling rawan rusak oleh perubahan berikutnya, sehingga seluruh
 * kemungkinan pasangan status diuji, bukan hanya alur normalnya.
 */

const ALLOWED = new Set([
  `${ORDER_STATUS.MENUNGGU_KONFIRMASI}->${ORDER_STATUS.DITERIMA}`,
  `${ORDER_STATUS.MENUNGGU_KONFIRMASI}->${ORDER_STATUS.DITOLAK}`,
  `${ORDER_STATUS.MENUNGGU_KONFIRMASI}->${ORDER_STATUS.DIBATALKAN}`,
  `${ORDER_STATUS.DITERIMA}->${ORDER_STATUS.DIPROSES}`,
  `${ORDER_STATUS.DIPROSES}->${ORDER_STATUS.SIAP_DIAMBIL}`,
  `${ORDER_STATUS.SIAP_DIAMBIL}->${ORDER_STATUS.SELESAI}`,
]);

test('daftar status berisi tepat tujuh status resmi', () => {
  assert.equal(ORDER_STATUS_VALUES.length, 7);
  assert.deepEqual(
    [...ORDER_STATUS_VALUES].sort(),
    [
      'dibatalkan',
      'diproses',
      'diterima',
      'ditolak',
      'menunggu_konfirmasi',
      'selesai',
      'siap_diambil',
    ],
  );
});

test('seluruh perpindahan yang diizinkan dapat dilakukan', () => {
  for (const pair of ALLOWED) {
    const [from, to] = pair.split('->');
    assert.equal(canTransition(from, to), true, `${from} -> ${to} seharusnya diizinkan`);
  }
});

test('perpindahan di luar daftar selalu ditolak', () => {
  let rejected = 0;
  for (const from of ORDER_STATUS_VALUES) {
    for (const to of ORDER_STATUS_VALUES) {
      if (ALLOWED.has(`${from}->${to}`)) continue;
      assert.equal(canTransition(from, to), false, `${from} -> ${to} seharusnya ditolak`);
      rejected += 1;
    }
  }
  // Tujuh dikali tujuh pasangan, dikurangi enam perpindahan yang sah.
  assert.equal(rejected, 43);
});

test('pesanan tidak dapat mundur ke tahap sebelumnya', () => {
  assert.equal(canTransition(ORDER_STATUS.DIPROSES, ORDER_STATUS.DITERIMA), false);
  assert.equal(canTransition(ORDER_STATUS.SIAP_DIAMBIL, ORDER_STATUS.DIPROSES), false);
  assert.equal(canTransition(ORDER_STATUS.SELESAI, ORDER_STATUS.SIAP_DIAMBIL), false);
});

test('pesanan tidak dapat melompati tahap', () => {
  assert.equal(canTransition(ORDER_STATUS.MENUNGGU_KONFIRMASI, ORDER_STATUS.SIAP_DIAMBIL), false);
  assert.equal(canTransition(ORDER_STATUS.MENUNGGU_KONFIRMASI, ORDER_STATUS.SELESAI), false);
  assert.equal(canTransition(ORDER_STATUS.DITERIMA, ORDER_STATUS.SELESAI), false);
});

test('pesanan yang sudah diterima tidak dapat ditolak atau dibatalkan', () => {
  assert.equal(canTransition(ORDER_STATUS.DITERIMA, ORDER_STATUS.DITOLAK), false);
  assert.equal(canTransition(ORDER_STATUS.DITERIMA, ORDER_STATUS.DIBATALKAN), false);
});

test('status akhir tidak memiliki perpindahan lanjutan', () => {
  assert.equal(isTerminalStatus(ORDER_STATUS.SELESAI), true);
  assert.equal(isTerminalStatus(ORDER_STATUS.DITOLAK), true);
  assert.equal(isTerminalStatus(ORDER_STATUS.DIBATALKAN), true);
  assert.equal(isTerminalStatus(ORDER_STATUS.MENUNGGU_KONFIRMASI), false);
});

test('status yang tidak dikenali ditolak tanpa menimbulkan kesalahan', () => {
  assert.equal(canTransition('status_palsu', ORDER_STATUS.SELESAI), false);
  assert.equal(canTransition(ORDER_STATUS.DITERIMA, 'status_palsu'), false);
  assert.equal(canTransition(undefined, undefined), false);
});

test('pembatalan oleh pembeli hanya dari status menunggu konfirmasi', () => {
  assert.deepEqual([...BUYER_CANCELLABLE_STATUSES], [ORDER_STATUS.MENUNGGU_KONFIRMASI]);
  for (const status of ORDER_STATUS_VALUES) {
    if (status === ORDER_STATUS.MENUNGGU_KONFIRMASI) continue;
    assert.equal(
      BUYER_CANCELLABLE_STATUSES.includes(status),
      false,
      `${status} tidak boleh dapat dibatalkan`,
    );
  }
});

test('riwayat pesanan mencakup selesai, ditolak, dan dibatalkan', () => {
  assert.deepEqual([...ORDER_HISTORY_STATUSES].sort(), ['dibatalkan', 'ditolak', 'selesai']);
});

test('status ditampilkan dalam huruf besar pada pesan pengguna', () => {
  assert.equal(formatStatus(ORDER_STATUS.SIAP_DIAMBIL), 'SIAP DIAMBIL');
  assert.equal(formatStatus(ORDER_STATUS.MENUNGGU_KONFIRMASI), 'MENUNGGU KONFIRMASI');
});
