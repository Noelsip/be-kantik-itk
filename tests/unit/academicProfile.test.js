import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pengujian pendeteksian asal akademik dari alamat email kampus.
 * Nilai environment disiapkan sebelum modul diimpor karena konfigurasi dibekukan.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-yang-cukup-panjang-untuk-validasi-zod';
process.env.ALLOWED_EMAIL_DOMAINS = 'student.itk.ac.id,lecture.itk.ac.id,itk.ac.id';
process.env.SELLER_EMAILS = '';

const { resolveAcademicProfile } = await import('../../src/services/auth.service.js');
const { STUDY_PROGRAMS, STUDY_PROGRAM_CODES, FACULTIES, AFFILIATIONS } = await import(
  '../../src/constants/studyPrograms.js'
);

/** Menyusun alamat mahasiswa dari kode program studi. */
const nim = (code) => `${code}231001@student.itk.ac.id`;

test('seluruh 25 kode program studi terpetakan', () => {
  assert.equal(STUDY_PROGRAM_CODES.length, 25);
  assert.deepEqual(STUDY_PROGRAM_CODES[0], '01');
  assert.deepEqual(STUDY_PROGRAM_CODES.at(-1), '25');
});

test('setiap kode menghasilkan program studi dan fakultas yang sama dengan pemetaannya', () => {
  for (const code of STUDY_PROGRAM_CODES) {
    const hasil = resolveAcademicProfile(nim(code));
    assert.equal(hasil.studyProgramCode, code, `kode ${code}`);
    assert.equal(hasil.studyProgram, STUDY_PROGRAMS[code].name, `nama prodi ${code}`);
    assert.equal(hasil.faculty, STUDY_PROGRAMS[code].faculty, `fakultas ${code}`);
    assert.equal(hasil.affiliation, STUDY_PROGRAMS[code].faculty, `afiliasi ${code}`);
  }
});

test('contoh prodi dari Fakultas Sains dan Teknologi Informasi', () => {
  assert.equal(resolveAcademicProfile(nim('11')).studyProgram, 'Informatika');
  assert.equal(resolveAcademicProfile(nim('11')).faculty, FACULTIES.FSTI);
  assert.equal(resolveAcademicProfile(nim('10')).studyProgram, 'Sistem Informasi');
  assert.equal(resolveAcademicProfile(nim('25')).studyProgram, 'Biomedis');
  assert.equal(resolveAcademicProfile(nim('01')).studyProgram, 'Fisika');
});

test('contoh prodi dari Fakultas Pembangunan Berkelanjutan', () => {
  assert.equal(resolveAcademicProfile(nim('07')).studyProgram, 'Teknik Sipil');
  assert.equal(resolveAcademicProfile(nim('07')).faculty, FACULTIES.FPB);
  assert.equal(resolveAcademicProfile(nim('22')).studyProgram, 'Desain Komunikasi Visual');
  assert.equal(resolveAcademicProfile(nim('24')).studyProgram, 'Transportasi Laut');
});

test('contoh prodi dari Fakultas Rekayasa dan Teknik Industri', () => {
  assert.equal(resolveAcademicProfile(nim('03')).studyProgram, 'Teknik Mesin');
  assert.equal(resolveAcademicProfile(nim('03')).faculty, FACULTIES.FRTI);
  assert.equal(resolveAcademicProfile(nim('19')).studyProgram, 'Teknologi Pangan');
  assert.equal(resolveAcademicProfile(nim('21')).studyProgram, 'Teknik Logistik');
});

test('tiap fakultas memperoleh jumlah program studi yang sesuai', () => {
  const jumlah = {};
  for (const code of STUDY_PROGRAM_CODES) {
    const { faculty } = STUDY_PROGRAMS[code];
    jumlah[faculty] = (jumlah[faculty] ?? 0) + 1;
  }
  assert.equal(jumlah[FACULTIES.FSTI], 9);
  assert.equal(jumlah[FACULTIES.FPB], 9);
  assert.equal(jumlah[FACULTIES.FRTI], 7);
});

/**
 * Daftar lengkap yang menjadi acuan, ditulis ulang di sini agar penukaran
 * fakultas maupun salah ketik nama prodi langsung ketahuan.
 */
const ACUAN = {
  '01': [FACULTIES.FSTI, 'Fisika'],
  '02': [FACULTIES.FSTI, 'Matematika'],
  '03': [FACULTIES.FRTI, 'Teknik Mesin'],
  '04': [FACULTIES.FSTI, 'Teknik Elektro'],
  '05': [FACULTIES.FRTI, 'Teknik Kimia'],
  '06': [FACULTIES.FRTI, 'Teknik Material dan Metalurgi'],
  '07': [FACULTIES.FPB, 'Teknik Sipil'],
  '08': [FACULTIES.FPB, 'Perencanaan Wilayah dan Kota'],
  '09': [FACULTIES.FPB, 'Teknik Perkapalan'],
  10: [FACULTIES.FSTI, 'Sistem Informasi'],
  11: [FACULTIES.FSTI, 'Informatika'],
  12: [FACULTIES.FRTI, 'Teknik Industri'],
  13: [FACULTIES.FPB, 'Teknik Lingkungan'],
  14: [FACULTIES.FPB, 'Teknik Kelautan'],
  15: [FACULTIES.FPB, 'Arsitektur'],
  16: [FACULTIES.FSTI, 'Statistika'],
  17: [FACULTIES.FSTI, 'Ilmu Aktuaria'],
  18: [FACULTIES.FRTI, 'Rekayasa Keselamatan'],
  19: [FACULTIES.FRTI, 'Teknologi Pangan'],
  20: [FACULTIES.FSTI, 'Bisnis Digital'],
  21: [FACULTIES.FRTI, 'Teknik Logistik'],
  22: [FACULTIES.FPB, 'Desain Komunikasi Visual'],
  23: [FACULTIES.FPB, 'Sistem Perkapalan'],
  24: [FACULTIES.FPB, 'Transportasi Laut'],
  25: [FACULTIES.FSTI, 'Biomedis'],
};

test('seluruh pasangan kode, fakultas, dan prodi sama persis dengan acuan', () => {
  assert.deepEqual(Object.keys(ACUAN).sort(), [...STUDY_PROGRAM_CODES]);

  for (const [code, [faculty, name]] of Object.entries(ACUAN)) {
    const hasil = resolveAcademicProfile(nim(code));
    assert.equal(hasil.studyProgram, name, `prodi untuk kode ${code}`);
    assert.equal(hasil.faculty, faculty, `fakultas untuk kode ${code}`);
  }
});

test('alamat dosen dikenali tanpa program studi', () => {
  const hasil = resolveAcademicProfile('andi.wijaya@lecture.itk.ac.id');
  assert.equal(hasil.affiliation, AFFILIATIONS.DOSEN);
  assert.equal(hasil.faculty, null);
  assert.equal(hasil.studyProgram, null);
  assert.equal(hasil.studyProgramCode, null);
});

test('alamat umum kampus dikenali tanpa program studi', () => {
  const hasil = resolveAcademicProfile('humas@itk.ac.id');
  assert.equal(hasil.affiliation, AFFILIATIONS.UMUM);
  assert.equal(hasil.studyProgram, null);
});

test('kode di luar daftar tidak menghasilkan program studi', () => {
  // Kode 26 belum dipakai, sehingga hanya domainnya yang dikenali.
  const hasil = resolveAcademicProfile('26231001@student.itk.ac.id');
  assert.equal(hasil.studyProgram, null);
  assert.equal(hasil.affiliation, null);
});

test('alamat mahasiswa yang bukan angka tidak menghasilkan program studi', () => {
  const hasil = resolveAcademicProfile('budi.santoso@student.itk.ac.id');
  assert.equal(hasil.studyProgram, null);
  assert.equal(hasil.affiliation, null);
});

test('angka yang menempel pada huruf tidak dibaca sebagai NIM', () => {
  assert.equal(resolveAcademicProfile('11budi@student.itk.ac.id').studyProgram, null);
  assert.equal(resolveAcademicProfile('budi11@student.itk.ac.id').studyProgram, null);
});

test('alamat di luar kampus tidak menghasilkan asal akademik', () => {
  const hasil = resolveAcademicProfile('11231001@gmail.com');
  assert.equal(hasil.affiliation, null);
  assert.equal(hasil.studyProgram, null);
});

test('NIM hanya berlaku pada domain mahasiswa, bukan domain kampus lainnya', () => {
  assert.equal(resolveAcademicProfile('11231001@student.itk.ac.id').studyProgram, 'Informatika');
  assert.equal(resolveAcademicProfile('11231001@itk.ac.id').studyProgram, null);
  assert.equal(resolveAcademicProfile('11231001@lecture.itk.ac.id').studyProgram, null);
});

test('NIM diambil dari angka depan alamat mahasiswa', () => {
  assert.equal(resolveAcademicProfile('11231001@student.itk.ac.id').nim, '11231001');
  assert.equal(resolveAcademicProfile('0723105@student.itk.ac.id').nim, '0723105');
});

test('NIM tetap dicatat meski kode prodinya belum terdaftar', () => {
  const hasil = resolveAcademicProfile('26231001@student.itk.ac.id');
  assert.equal(hasil.nim, '26231001');
  assert.equal(hasil.studyProgram, null);
});

test('alamat tanpa angka depan tidak memiliki NIM', () => {
  assert.equal(resolveAcademicProfile('budi.santoso@student.itk.ac.id').nim, null);
  assert.equal(resolveAcademicProfile('prof.andi@lecture.itk.ac.id').nim, null);
  assert.equal(resolveAcademicProfile('humas@itk.ac.id').nim, null);
});

test('angka depan pada domain selain mahasiswa tidak menjadi NIM', () => {
  assert.equal(resolveAcademicProfile('11231001@lecture.itk.ac.id').nim, null);
  assert.equal(resolveAcademicProfile('11231001@itk.ac.id').nim, null);
  assert.equal(resolveAcademicProfile('11231001@gmail.com').nim, null);
});

test('angka yang menempel huruf tidak menjadi NIM', () => {
  assert.equal(resolveAcademicProfile('11budi@student.itk.ac.id').nim, null);
  assert.equal(resolveAcademicProfile('rektorat2024@lecture.itk.ac.id').nim, null);
});

test('awalan angka pada domain dosen bukan akun dosen', () => {
  // NIM tidak pernah dimiliki dosen, sehingga alamat semacam ini tidak dikenali.
  const hasil = resolveAcademicProfile('11231001@lecture.itk.ac.id');
  assert.equal(hasil.affiliation, null);
  assert.equal(hasil.faculty, null);
  assert.equal(hasil.studyProgram, null);
});

test('awalan angka pada domain umum kampus juga tidak dikenali', () => {
  assert.equal(resolveAcademicProfile('11231001@itk.ac.id').affiliation, null);
});

test('dosen dikenali selama awalannya bukan angka', () => {
  for (const email of [
    'prof.andi@lecture.itk.ac.id',
    'andi@lecture.itk.ac.id',
    'rektorat2024@lecture.itk.ac.id',
  ]) {
    assert.equal(resolveAcademicProfile(email).affiliation, AFFILIATIONS.DOSEN, email);
  }
});

test('domain yang menyerupai domain mahasiswa ditolak', () => {
  // Pencocokan dilakukan persis, sehingga akhiran tambahan tidak lolos.
  for (const email of [
    '11231001@student.itk.ac.id.penyerang.com',
    '11231001@sub.student.itk.ac.id',
    '11231001@xstudent.itk.ac.id',
  ]) {
    const hasil = resolveAcademicProfile(email);
    assert.equal(hasil.studyProgram, null, email);
    assert.equal(hasil.affiliation, null, email);
  }
});

test('huruf besar pada alamat tetap terbaca', () => {
  assert.equal(resolveAcademicProfile('11231001@STUDENT.ITK.AC.ID').studyProgram, 'Informatika');
  assert.equal(resolveAcademicProfile('Dosen@LECTURE.ITK.AC.ID').affiliation, AFFILIATIONS.DOSEN);
});
