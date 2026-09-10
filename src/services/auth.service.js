import config from '../config/env.js';
import { ROLES } from '../constants/roles.js';
import {
  STUDY_PROGRAMS,
  AFFILIATIONS,
  STUDENT_DOMAIN,
  LECTURER_DOMAIN,
  GENERAL_DOMAIN,
} from '../constants/studyPrograms.js';
import ERROR_CODES from '../constants/errorCodes.js';
import { AuthenticationError, AuthorizationError, NotFoundError } from '../utils/errors.js';
import { signAccessToken } from '../utils/jwt.js';
import { withTransaction } from '../config/database.js';
import logger from '../utils/logger.js';
import * as userRepository from '../repositories/user.repository.js';
import { verifyGoogleIdToken } from './google.service.js';

/**
 * Fungsi untuk menangani proses masuk dan penyediaan akun.
 * Kelayakan email berasal dari daftar domain kampus, sedangkan perannya berasal
 * dari daftar penjual di konfigurasi server.
 */

/** Mengambil bagian domain dari sebuah alamat email. */
export function getEmailDomain(email) {
  const value = String(email).toLowerCase();
  const at = value.lastIndexOf('@');
  return at === -1 ? '' : value.slice(at + 1);
}

/** Memeriksa apakah domain email termasuk domain kampus yang diizinkan. */
export function isEmailDomainAllowed(email) {
  return config.auth.allowedEmailDomains.includes(getEmailDomain(email));
}

/** Memeriksa apakah alamat email terdaftar sebagai penjual. */
export function isSellerEmail(email) {
  return config.auth.sellerEmails.includes(String(email).toLowerCase());
}

/**
 * Menentukan peran yang berhak diterima sebuah alamat email.
 * Dihitung ulang setiap kali masuk agar daftar penjual tetap menjadi acuan.
 */
export function resolveRole(email) {
  return isSellerEmail(email) ? ROLES.PENJUAL : ROLES.PEMBELI;
}

/** Bentuk data akademik kosong untuk akun yang asalnya tidak dikenali. */
export const EMPTY_ACADEMIC_PROFILE = Object.freeze({
  nim: null,
  affiliation: null,
  faculty: null,
  studyProgram: null,
  studyProgramCode: null,
});

/**
 * Menentukan asal akademik sebuah alamat email kampus.
 *
 * Bagian depan yang seluruhnya angka merupakan NIM, dan hanya sah bila
 * berpasangan dengan domain mahasiswa. Alamat dosen maupun alamat umum kampus
 * dikenali dari domainnya, dengan bagian depan yang bukan angka.
 */
export function resolveAcademicProfile(email) {
  const value = String(email).toLowerCase();
  const localPart = value.split('@')[0];
  const domain = getEmailDomain(value);
  const looksLikeNim = /^\d+$/.test(localPart);
  const isStudentNim = domain === STUDENT_DOMAIN && looksLikeNim;

  if (isStudentNim) {
    const code = localPart.slice(0, 2);
    const program = STUDY_PROGRAMS[code];
    if (program) {
      return Object.freeze({
        nim: localPart,
        affiliation: program.faculty,
        faculty: program.faculty,
        studyProgram: program.name,
        studyProgramCode: code,
      });
    }
    // NIM tetap dicatat meski dua digit awalnya belum terdaftar sebagai prodi.
    return Object.freeze({ ...EMPTY_ACADEMIC_PROFILE, nim: localPart });
  }

  // Bagian depan berupa angka menandakan NIM, dan NIM hanya sah pada domain
  // mahasiswa. Alamat semacam itu pada domain lain tidak dikenali.
  if (looksLikeNim) return EMPTY_ACADEMIC_PROFILE;

  if (domain === LECTURER_DOMAIN) {
    return Object.freeze({ ...EMPTY_ACADEMIC_PROFILE, affiliation: AFFILIATIONS.DOSEN });
  }
  if (domain === GENERAL_DOMAIN) {
    return Object.freeze({ ...EMPTY_ACADEMIC_PROFILE, affiliation: AFFILIATIONS.UMUM });
  }

  return EMPTY_ACADEMIC_PROFILE;
}

/**
 * Memastikan sebuah alamat email berhak memakai aplikasi.
 * Penjual dikecualikan dari aturan domain kampus karena diberi izin satu per
 * satu melalui konfigurasi server.
 */
function assertEmailIsAllowed(email, role) {
  if (role === ROLES.PENJUAL) return;

  if (!isEmailDomainAllowed(email)) {
    const domains = config.auth.allowedEmailDomains.map((domain) => `@${domain}`).join(', ');
    throw new AuthorizationError(
      `Akun ${email} tidak dapat digunakan. Gunakan email kampus ITK (${domains}).`,
      ERROR_CODES.EMAIL_DOMAIN_NOT_ALLOWED,
    );
  }
}

/**
 * Menyusun identitas kampus dari bagian depan alamat email.
 * Google tidak menyediakan nomor induk, sementara `campus_id` wajib dan unik,
 * sehingga nilainya diberi akhiran angka bila bertabrakan.
 */
async function generateUniqueCampusId(email, connection) {
  const localPart = String(email).split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '') || 'user';
  const base = localPart.slice(0, 40);

  if (!(await userRepository.campusIdExists(base, connection))) return base;

  for (let suffix = 2; suffix <= 50; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!(await userRepository.campusIdExists(candidate, connection))) return candidate;
  }

  return `${base}-${Date.now().toString(36)}`.slice(0, 50);
}

/** Mencari akun yang sesuai dengan identitas Google, atau membuatnya bila belum ada. */
async function findOrProvisionUser(identity) {
  const role = resolveRole(identity.email);
  assertEmailIsAllowed(identity.email, role);

  // Data akademik hanya berlaku bagi pembeli, karena penjual bukan mahasiswa
  // dan alamatnya tidak memuat NIM.
  const academic =
    role === ROLES.PEMBELI ? resolveAcademicProfile(identity.email) : EMPTY_ACADEMIC_PROFILE;

  return withTransaction(async (connection) => {
    let user =
      (await userRepository.findByGoogleId(identity.googleId, connection)) ??
      (await userRepository.findByEmail(identity.email, connection));

    if (!user) {
      const campusId = await generateUniqueCampusId(identity.email, connection);
      user = await userRepository.create(
        {
          googleId: identity.googleId,
          campusId,
          name: identity.name || identity.email.split('@')[0],
          email: identity.email,
          role,
          profileImage: identity.picture,
          ...academic,
        },
        connection,
      );
      logger.info(`Akun baru dibuat: ${user.email} (peran: ${user.role})`);
      return user;
    }

    // Menautkan akun Google ke baris yang sudah ada, misalnya akun hasil seed.
    if (!user.google_id) {
      user = await userRepository.linkGoogleId(user.id, identity.googleId, connection);
    }

    // Menyelaraskan peran dengan daftar penjual pada setiap kali masuk, dua arah,
    // sehingga penambahan maupun penghapusan alamat langsung berlaku.
    if (user.role !== role) {
      logger.info(`Peran ${user.email} berubah: ${user.role} -> ${role}`);
      user = await userRepository.updateRole(user.id, role, connection);
    }

    // Menyelaraskan data akademik agar akun lama ikut terisi, dan kembali kosong
    // bila pemiliknya berpindah menjadi penjual.
    if (
      user.study_program_code !== academic.studyProgramCode ||
      user.affiliation !== academic.affiliation ||
      user.nim !== academic.nim
    ) {
      user = await userRepository.updateAcademicProfile(user.id, academic, connection);
    }

    return user;
  });
}

/** Menyusun data sesi beserta kunci akses yang baru diterbitkan. */
function buildSession(user) {
  return {
    user,
    accessToken: signAccessToken({ userId: user.id, tokenVersion: user.token_version }),
    tokenType: 'Bearer',
    expiresIn: config.auth.jwtExpiresIn,
  };
}

/** Memproses masuk dengan akun Google. */
export async function loginWithGoogle(idToken) {
  const identity = await verifyGoogleIdToken(idToken);
  const user = await findOrProvisionUser(identity);
  return buildSession(user);
}

/**
 * Memproses masuk cepat untuk keperluan pengembangan.
 * Jalur ini selalu mati di lingkungan produksi dan tidak pernah membuat akun.
 */
export async function devLogin(email) {
  if (!config.auth.devLoginEnabled) {
    throw new AuthorizationError(
      'Cara masuk ini tidak tersedia pada server ini.',
      ERROR_CODES.DEV_LOGIN_DISABLED,
    );
  }

  let user = await userRepository.findByEmail(email);
  if (!user) {
    throw new NotFoundError(`Akun ${email} tidak terdaftar.`);
  }

  // Data akademik diselaraskan seperti pada masuk lewat Google, agar perilaku
  // kedua jalur tetap sama saat pengembangan.
  const academic =
    user.role === ROLES.PEMBELI ? resolveAcademicProfile(user.email) : EMPTY_ACADEMIC_PROFILE;
  if (
    user.study_program_code !== academic.studyProgramCode ||
    user.affiliation !== academic.affiliation ||
    user.nim !== academic.nim
  ) {
    user = await userRepository.updateAcademicProfile(user.id, academic);
  }

  logger.warn(`Masuk mode pengembangan dipakai untuk ${user.email}`);
  return buildSession(user);
}

/** Mengakhiri sesi dengan menaikkan versi sesi pengguna. */
export async function logout(userId) {
  await userRepository.incrementTokenVersion(userId);
}

/** Mengambil data pengguna yang sedang masuk. */
export async function getCurrentUser(userId) {
  const user = await userRepository.findById(userId);
  if (!user) throw new AuthenticationError('Akun tidak ditemukan.');
  return user;
}
