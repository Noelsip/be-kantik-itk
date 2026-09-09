import config from '../config/env.js';
import { ROLES } from '../constants/roles.js';
import ERROR_CODES from '../constants/errorCodes.js';
import { AuthenticationError, AuthorizationError, NotFoundError } from '../utils/errors.js';
import { signAccessToken } from '../utils/jwt.js';
import { withTransaction } from '../config/database.js';
import logger from '../utils/logger.js';
import * as userRepository from '../repositories/user.repository.js';
import { verifyGoogleIdToken } from './google.service.js';

/**
 * Fungsi untuk menangani proses masuk dan penyediaan akun.
 *
 * Ada dua keputusan terpisah yang tidak boleh dicampur:
 * pertama, apakah sebuah email boleh memakai aplikasi, ditentukan oleh daftar
 * domain kampus; kedua, peran apa yang diterima email tersebut, ditentukan oleh
 * daftar penjual di konfigurasi server.
 *
 * Dengan pemisahan itu, alamat berdomain kampus tidak otomatis menjadi penjual,
 * dan klien tidak dapat memengaruhi kedua keputusan tersebut.
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

/**
 * Memastikan sebuah alamat email berhak memakai aplikasi.
 *
 * Penjual dikecualikan dari aturan domain kampus karena aturan tersebut
 * ditujukan untuk pembeli, sementara penjual kantin diberi izin satu per satu
 * melalui daftar di konfigurasi server.
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
 *
 * Google tidak menyediakan nomor induk, sementara kolom `campus_id` bersifat
 * wajib dan unik, sehingga nilainya diturunkan di sini dan diberi akhiran angka
 * bila kebetulan bertabrakan.
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
 *
 * Jalur ini menerbitkan sesi bagi akun yang sudah ada tanpa identitas Google.
 * Konfigurasi memastikan jalur ini selalu mati di lingkungan produksi, dan tidak
 * pernah membuat akun baru.
 */
export async function devLogin(email) {
  if (!config.auth.devLoginEnabled) {
    throw new AuthorizationError(
      'Cara masuk ini tidak tersedia pada server ini.',
      ERROR_CODES.DEV_LOGIN_DISABLED,
    );
  }

  const user = await userRepository.findByEmail(email);
  if (!user) {
    throw new NotFoundError(`Akun ${email} tidak terdaftar.`);
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
