import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toMinorUnits,
  toDecimalString,
  toAmountNumber,
  calculateSubtotalMinor,
  sumMinor,
} from '../../src/utils/money.js';

/**
 * Pengujian perhitungan uang.
 *
 * Perhitungan memakai satuan terkecil berupa bilangan bulat justru agar total
 * tidak bergeser, dan pengujian ini menjaga perilaku tersebut.
 */

test('mengubah teks desimal dari database menjadi satuan terkecil', () => {
  assert.equal(toMinorUnits('15000.00'), 1500000);
  assert.equal(toMinorUnits('0.00'), 0);
  assert.equal(toMinorUnits('8000.50'), 800050);
  assert.equal(toMinorUnits('1.05'), 105);
});

test('menerima masukan berupa angka biasa', () => {
  assert.equal(toMinorUnits(15000), 1500000);
  assert.equal(toMinorUnits(0.1), 10);
});

test('mengubah satuan terkecil kembali menjadi teks desimal', () => {
  assert.equal(toDecimalString(1500000), '15000.00');
  assert.equal(toDecimalString(0), '0.00');
  assert.equal(toDecimalString(105), '1.05');
  assert.equal(toDecimalString(800050), '8000.50');
});

test('nilai tetap utuh setelah diubah bolak-balik', () => {
  for (const value of ['15000.00', '0.01', '999999.99', '8000.50']) {
    assert.equal(toDecimalString(toMinorUnits(value)), value);
  }
});

test('menolak masukan yang bukan nilai uang', () => {
  assert.throws(() => toMinorUnits('abc'), TypeError);
  assert.throws(() => toMinorUnits('12,50'), TypeError);
  assert.throws(() => toMinorUnits(Number.NaN), TypeError);
  assert.throws(() => toMinorUnits(Number.POSITIVE_INFINITY), TypeError);
});

test('subtotal dihitung dari harga dikali jumlah', () => {
  assert.equal(calculateSubtotalMinor('15000.00', 2), 3000000);
  assert.equal(calculateSubtotalMinor('5000.00', 1), 500000);
  assert.equal(toDecimalString(calculateSubtotalMinor('18000.00', 3)), '54000.00');
});

test('subtotal menolak jumlah yang tidak masuk akal', () => {
  assert.throws(() => calculateSubtotalMinor('15000.00', 0), TypeError);
  assert.throws(() => calculateSubtotalMinor('15000.00', -1), TypeError);
  assert.throws(() => calculateSubtotalMinor('15000.00', 1.5), TypeError);
});

test('perhitungan bilangan bulat menghindari pergeseran nilai desimal', () => {
  // Penjumlahan 0.1 dan 0.2 tidak menghasilkan tepat 0.3 pada bilangan pecahan.
  assert.notEqual(0.1 + 0.2, 0.3);
  assert.equal(sumMinor([toMinorUnits('0.10'), toMinorUnits('0.20')]), toMinorUnits('0.30'));

  // Contoh keranjang nyata, dijumlahkan seperti pada proses pembuatan pesanan.
  const subtotals = [
    calculateSubtotalMinor('15000.00', 2),
    calculateSubtotalMinor('5000.00', 1),
    calculateSubtotalMinor('8000.00', 3),
  ];
  assert.equal(toDecimalString(sumMinor(subtotals)), '59000.00');
});

test('keranjang kosong menghasilkan total nol', () => {
  assert.equal(sumMinor([]), 0);
  assert.equal(toDecimalString(sumMinor([])), '0.00');
});

test('nilai uang pada respons berupa angka biasa', () => {
  assert.equal(toAmountNumber('15000.00'), 15000);
  assert.equal(toAmountNumber('8000.50'), 8000.5);
  assert.equal(toAmountNumber(null), null);
  assert.equal(toAmountNumber(undefined), null);
});
