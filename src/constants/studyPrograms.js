/**
 * Pemetaan dua digit awal NIM menjadi program studi beserta fakultasnya.
 * Dipakai untuk mengisi data akademik pembeli, karena alamat email mahasiswa
 * ITK memakai NIM sebagai bagian depannya.
 */

/** Keterangan afiliasi bagi alamat kampus yang bagian depannya bukan NIM. */
export const AFFILIATIONS = Object.freeze({
  DOSEN: 'Dosen ITK',
  UMUM: 'Email Umum ITK',
});

/** Domain email yang menandai akun mahasiswa, dosen, dan umum kampus. */
export const STUDENT_DOMAIN = 'student.itk.ac.id';
export const LECTURER_DOMAIN = 'lecture.itk.ac.id';
export const GENERAL_DOMAIN = 'itk.ac.id';

export const FACULTIES = Object.freeze({
  FSTI: 'Fakultas Sains dan Teknologi Informasi',
  FPB: 'Fakultas Pembangunan Berkelanjutan',
  FRTI: 'Fakultas Rekayasa dan Teknik Industri',
});

export const STUDY_PROGRAMS = Object.freeze({
  '01': Object.freeze({ name: 'Fisika', faculty: FACULTIES.FSTI }),
  '02': Object.freeze({ name: 'Matematika', faculty: FACULTIES.FSTI }),
  '03': Object.freeze({ name: 'Teknik Mesin', faculty: FACULTIES.FRTI }),
  '04': Object.freeze({ name: 'Teknik Elektro', faculty: FACULTIES.FSTI }),
  '05': Object.freeze({ name: 'Teknik Kimia', faculty: FACULTIES.FRTI }),
  '06': Object.freeze({ name: 'Teknik Material dan Metalurgi', faculty: FACULTIES.FRTI }),
  '07': Object.freeze({ name: 'Teknik Sipil', faculty: FACULTIES.FPB }),
  '08': Object.freeze({ name: 'Perencanaan Wilayah dan Kota', faculty: FACULTIES.FPB }),
  '09': Object.freeze({ name: 'Teknik Perkapalan', faculty: FACULTIES.FPB }),
  10: Object.freeze({ name: 'Sistem Informasi', faculty: FACULTIES.FSTI }),
  11: Object.freeze({ name: 'Informatika', faculty: FACULTIES.FSTI }),
  12: Object.freeze({ name: 'Teknik Industri', faculty: FACULTIES.FRTI }),
  13: Object.freeze({ name: 'Teknik Lingkungan', faculty: FACULTIES.FPB }),
  14: Object.freeze({ name: 'Teknik Kelautan', faculty: FACULTIES.FPB }),
  15: Object.freeze({ name: 'Arsitektur', faculty: FACULTIES.FPB }),
  16: Object.freeze({ name: 'Statistika', faculty: FACULTIES.FSTI }),
  17: Object.freeze({ name: 'Ilmu Aktuaria', faculty: FACULTIES.FSTI }),
  18: Object.freeze({ name: 'Rekayasa Keselamatan', faculty: FACULTIES.FRTI }),
  19: Object.freeze({ name: 'Teknologi Pangan', faculty: FACULTIES.FRTI }),
  20: Object.freeze({ name: 'Bisnis Digital', faculty: FACULTIES.FSTI }),
  21: Object.freeze({ name: 'Teknik Logistik', faculty: FACULTIES.FRTI }),
  22: Object.freeze({ name: 'Desain Komunikasi Visual', faculty: FACULTIES.FPB }),
  23: Object.freeze({ name: 'Sistem Perkapalan', faculty: FACULTIES.FPB }),
  24: Object.freeze({ name: 'Transportasi Laut', faculty: FACULTIES.FPB }),
  25: Object.freeze({ name: 'Biomedis', faculty: FACULTIES.FSTI }),
});

// Kunci berupa angka diurutkan ulang oleh JavaScript, sehingga diurutkan lagi
// di sini agar daftarnya tetap 01 sampai 25.
export const STUDY_PROGRAM_CODES = Object.freeze(Object.keys(STUDY_PROGRAMS).sort());

export default STUDY_PROGRAMS;
