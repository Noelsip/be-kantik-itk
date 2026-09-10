import { AuthenticationError, AuthorizationError } from '../utils/errors.js';
import ERROR_CODES from '../constants/errorCodes.js';
import { ROLE_LABELS } from '../constants/roles.js';

/**
 * Pembatas akses berdasarkan peran pengguna.
 * Dijalankan setelah pemeriksaan kunci akses karena peran dibaca dari database.
 */
export function authorize(...allowedRoles) {
  return function authorizeMiddleware(req, _res, next) {
    if (!req.user) {
      return next(new AuthenticationError('Anda belum masuk'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      const expected = allowedRoles.map((role) => ROLE_LABELS[role] ?? role).join(' atau ');
      return next(
        new AuthorizationError(
          `Akses ditolak. Fitur ini hanya untuk ${expected}.`,
          ERROR_CODES.FORBIDDEN_ROLE,
        ),
      );
    }

    return next();
  };
}

export default authorize;
