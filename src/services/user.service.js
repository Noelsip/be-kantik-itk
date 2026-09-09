import { AuthenticationError } from '../utils/errors.js';
import { toUserResponse } from '../utils/presenters.js';
import * as userRepository from '../repositories/user.repository.js';

/**
 * Fungsi untuk membaca dan memperbarui profil pengguna.
 *
 * Hanya nama dan foto profil yang dapat diubah. Email, peran, identitas kampus,
 * dan identitas akun Google merupakan penentu hak akses sehingga tidak pernah
 * diterima dari permintaan pengubahan profil.
 */

/** Mengambil profil pengguna yang sedang masuk. */
export async function getProfile(userId) {
  const user = await userRepository.findById(userId);
  if (!user) throw new AuthenticationError('Akun tidak ditemukan.');
  return toUserResponse(user);
}

/** Memperbarui profil pengguna yang sedang masuk. */
export async function updateProfile(userId, { name, profileImage }) {
  const user = await userRepository.updateProfile(userId, { name, profileImage });
  if (!user) throw new AuthenticationError('Akun tidak ditemukan.');
  return toUserResponse(user);
}
