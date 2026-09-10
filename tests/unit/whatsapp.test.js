import test from 'node:test';
import assert from 'node:assert/strict';

/** Pengujian pembakuan nomor WhatsApp pada lapisan pemeriksaan permintaan. */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-yang-cukup-panjang-untuk-validasi-zod';
process.env.FIREBASE_SERVICE_ACCOUNT = '';

const { whatsappSchema } = await import('../../src/validators/common.js');

const baku = (value) => whatsappSchema.parse(value);
const ditolak = (value) => whatsappSchema.safeParse(value).success === false;

test('berbagai penulisan nomor menghasilkan bentuk baku yang sama', () => {
  for (const value of [
    '081234567890',
    '0812 3456 7890',
    '0812-3456-7890',
    '+6281234567890',
    '+62 812-3456-7890',
    '6281234567890',
    '81234567890',
    '(0812) 3456-7890',
  ]) {
    assert.equal(baku(value), '6281234567890', value);
  }
});

test('nomor yang bukan nomor seluler Indonesia ditolak', () => {
  // Nomor Indonesia selalu diawali 8 setelah kode negara.
  assert.ok(ditolak('0712345678'), 'nomor rumah');
  assert.ok(ditolak('+15550100'), 'nomor luar negeri');
  assert.ok(ditolak('62123456789'), 'tidak diawali 8');
});

test('nilai yang bukan angka ditolak', () => {
  for (const value of ['abc', '', '08a1234567', '0812 3456 78ab']) {
    assert.ok(ditolak(value), JSON.stringify(value));
  }
});

test('nomor terlalu pendek dan terlalu panjang ditolak', () => {
  assert.ok(ditolak('08'), 'terlalu pendek');
  assert.ok(ditolak('0812345678901234567'), 'terlalu panjang');
});

test('panjang yang wajar diterima, yang melampaui batas ditolak', () => {
  assert.equal(baku('08123456789'), '628123456789', '12 angka setelah dibakukan');
  assert.equal(baku('08123456789012'), '628123456789012', '15 angka, batas atas');
  assert.ok(ditolak('081234567890123'), '16 angka melampaui batas');
});
