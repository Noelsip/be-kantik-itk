import { NotFoundError } from '../utils/errors.js';

/**
 * Menutup permintaan ke alamat yang tidak dikenali dengan bentuk respons baku,
 * menggantikan halaman bawaan Express.
 */
export function notFound(_req, _res, next) {
  next(new NotFoundError('Halaman atau layanan yang Anda minta tidak ditemukan.'));
}

export default notFound;
