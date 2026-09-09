import ERROR_CODES from '../constants/errorCodes.js';

/**
 * Kelas dasar untuk seluruh kesalahan yang dilempar secara sengaja.
 *
 * Penanda `isOperational` membedakan kesalahan yang memang bagian dari alur
 * bisnis dari kesalahan tak terduga. Hanya yang pertama yang pesannya
 * diteruskan apa adanya ke klien.
 */
export class AppError extends Error {
  constructor(message, { statusCode = 500, code = ERROR_CODES.INTERNAL_ERROR, details } = {}) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, new.target);
  }
}

/** Bentuk atau isi data yang dikirim tidak sesuai aturan. */
export class ValidationError extends AppError {
  constructor(message = 'Data yang dikirim tidak valid', details) {
    super(message, { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR, details });
  }
}

/** Pengguna belum masuk atau sesinya tidak lagi berlaku. */
export class AuthenticationError extends AppError {
  constructor(message = 'Anda belum masuk', code = ERROR_CODES.UNAUTHENTICATED) {
    super(message, { statusCode: 401, code });
  }
}

/** Pengguna sudah masuk, tetapi tidak berhak atas sumber daya tersebut. */
export class AuthorizationError extends AppError {
  constructor(
    message = 'Anda tidak memiliki akses ke data ini',
    code = ERROR_CODES.FORBIDDEN,
  ) {
    super(message, { statusCode: 403, code });
  }
}

/** Data yang diminta tidak ada, atau tidak terlihat oleh pengguna ini. */
export class NotFoundError extends AppError {
  constructor(message = 'Data tidak ditemukan', code = ERROR_CODES.NOT_FOUND) {
    super(message, { statusCode: 404, code });
  }
}

/** Permintaan bertabrakan dengan data yang sudah ada. */
export class ConflictError extends AppError {
  constructor(message = 'Data sudah ada', code = ERROR_CODES.CONFLICT) {
    super(message, { statusCode: 409, code });
  }
}

/**
 * Aturan bisnis melarang operasi tersebut, misalnya keranjang berisi menu dari
 * kantin lain atau perpindahan status pesanan yang tidak diizinkan.
 */
export class BusinessRuleError extends AppError {
  constructor(message, code = ERROR_CODES.CONFLICT, { statusCode = 409, details } = {}) {
    super(message, { statusCode, code, details });
  }
}

export default AppError;
