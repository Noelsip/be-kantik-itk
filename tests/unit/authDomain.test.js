import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pengujian aturan domain email dan penetapan peran.
 *
 * Nilai environment disiapkan sebelum modul diimpor, karena konfigurasi dibekukan
 * pada saat modul pertama kali dimuat.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-yang-cukup-panjang-untuk-validasi-zod';
process.env.ALLOWED_EMAIL_DOMAINS = 'student.itk.ac.id,lecture.itk.ac.id,itk.ac.id';
process.env.SELLER_EMAILS = 'penjual.fsti@itk.ac.id,vendor.luar@gmail.com';

const { getEmailDomain, isEmailDomainAllowed, isSellerEmail, resolveRole } = await import(
  '../../src/services/auth.service.js'
);
const { ROLES } = await import('../../src/constants/roles.js');

test('mengambil bagian domain dari alamat email', () => {
  assert.equal(getEmailDomain('budi@student.itk.ac.id'), 'student.itk.ac.id');
  assert.equal(getEmailDomain('BUDI@STUDENT.ITK.AC.ID'), 'student.itk.ac.id');
  assert.equal(getEmailDomain('tanpa-at'), '');
});

test('menerima ketiga domain kampus', () => {
  assert.equal(isEmailDomainAllowed('nama@student.itk.ac.id'), true);
  assert.equal(isEmailDomainAllowed('nama@lecture.itk.ac.id'), true);
  assert.equal(isEmailDomainAllowed('nama@itk.ac.id'), true);
});

test('menolak domain selain domain kampus', () => {
  assert.equal(isEmailDomainAllowed('nama@gmail.com'), false);
  assert.equal(isEmailDomainAllowed('nama@kampuslain.ac.id'), false);
  assert.equal(isEmailDomainAllowed('nama@yahoo.co.id'), false);
});

test('menolak domain mirip yang sekadar memuat domain kampus', () => {
  // Pencocokan sebagian akan menjadi celah keamanan yang nyata di sini.
  assert.equal(isEmailDomainAllowed('nama@itk.ac.id.evil.com'), false);
  assert.equal(isEmailDomainAllowed('nama@notitk.ac.id'), false);
  assert.equal(isEmailDomainAllowed('nama@student.itk.ac.id.attacker.net'), false);
});

test('tanda at pada bagian depan email tidak mengelabui pembacaan domain', () => {
  // Domain diambil dari tanda at paling akhir, sehingga hasilnya gmail.com.
  assert.equal(getEmailDomain('"weird@itk.ac.id"@gmail.com'), 'gmail.com');
  assert.equal(isEmailDomainAllowed('"weird@itk.ac.id"@gmail.com'), false);
});

test('peran penjual hanya diberikan kepada alamat pada daftar penjual', () => {
  assert.equal(isSellerEmail('penjual.fsti@itk.ac.id'), true);
  assert.equal(resolveRole('penjual.fsti@itk.ac.id'), ROLES.PENJUAL);
});

test('alamat berdomain itk.ac.id tidak otomatis menjadi penjual', () => {
  assert.equal(isSellerEmail('dosen.biasa@itk.ac.id'), false);
  assert.equal(resolveRole('dosen.biasa@itk.ac.id'), ROLES.PEMBELI);
  assert.equal(resolveRole('mahasiswa@student.itk.ac.id'), ROLES.PEMBELI);
});

test('daftar penjual tidak membedakan huruf besar dan kecil', () => {
  assert.equal(isSellerEmail('PENJUAL.FSTI@ITK.AC.ID'), true);
  assert.equal(resolveRole('Penjual.Fsti@Itk.Ac.Id'), ROLES.PENJUAL);
});

test('penjual boleh memakai alamat di luar domain kampus', () => {
  // Penjual diberi izin satu per satu, sehingga aturan domain pembeli tidak
  // berlaku baginya, namun ia juga tetap bukan pembeli.
  assert.equal(isEmailDomainAllowed('vendor.luar@gmail.com'), false);
  assert.equal(resolveRole('vendor.luar@gmail.com'), ROLES.PENJUAL);
});

test('peran yang tersedia hanya pembeli dan penjual', () => {
  assert.deepEqual(Object.values(ROLES).sort(), ['pembeli', 'penjual']);
});
