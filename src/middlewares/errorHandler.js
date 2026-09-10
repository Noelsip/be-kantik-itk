import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/response.js';
import ERROR_CODES from '../constants/errorCodes.js';
import logger from '../utils/logger.js';
import config from '../config/env.js';

/**
 * Penerjemah kesalahan dari driver MySQL menjadi pesan yang aman bagi pengguna.
 * Bernilai null bila kesalahan bukan berasal dari database.
 */
function translateDatabaseError(error) {
  switch (error?.code) {
    case 'ER_DUP_ENTRY':
      return { statusCode: 409, code: ERROR_CODES.CONFLICT, message: 'Data sudah terdaftar sebelumnya.' };
    case 'ER_NO_REFERENCED_ROW':
    case 'ER_NO_REFERENCED_ROW_2':
      return {
        statusCode: 422,
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Data yang Anda pilih tidak ditemukan.',
      };
    case 'ER_ROW_IS_REFERENCED':
    case 'ER_ROW_IS_REFERENCED_2':
      return {
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
        message: 'Data tidak dapat dihapus karena masih digunakan.',
      };
    case 'ECONNREFUSED':
    case 'PROTOCOL_CONNECTION_LOST':
    case 'ER_CON_COUNT_ERROR':
      return {
        statusCode: 503,
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Layanan sedang tidak tersedia. Silakan coba beberapa saat lagi.',
      };
    default:
      return null;
  }
}

/**
 * Penanganan kesalahan terpusat.
 * Satu-satunya tempat yang mengubah kesalahan menjadi respons HTTP, sehingga
 * bentuknya seragam dan rincian internal tidak bocor.
 */
// eslint-disable-next-line no-unused-vars -- Express mengenali handler dari jumlah argumennya.
export function errorHandler(error, req, res, _next) {
  if (error?.type === 'entity.parse.failed') {
    return sendError(res, {
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Data yang dikirim tidak dapat dibaca. Silakan coba lagi.',
    });
  }

  // Kesalahan dari lapisan penerima berkas dikenali dari nama kelasnya.
  if (error?.name === 'MulterError') {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    logger.debug(`${req.method} ${req.originalUrl} -> unggahan ditolak: ${error.code}`);
    return sendError(res, {
      statusCode: tooLarge ? 413 : 422,
      code: tooLarge ? ERROR_CODES.PAYLOAD_TOO_LARGE : ERROR_CODES.VALIDATION_ERROR,
      message: tooLarge
        ? 'Ukuran gambar melebihi batas 5 MB.'
        : 'Berkas yang dikirim tidak dapat diterima.',
    });
  }

  if (error?.type === 'entity.too.large') {
    return sendError(res, {
      statusCode: 413,
      code: ERROR_CODES.PAYLOAD_TOO_LARGE,
      message: 'Data yang dikirim terlalu besar.',
    });
  }

  if (error instanceof AppError) {
    // Kesalahan yang memang bagian dari alur bisnis, cukup dicatat seperlunya.
    logger.debug(`${req.method} ${req.originalUrl} -> ${error.code}: ${error.message}`);
    return sendError(res, {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details,
    });
  }

  const databaseError = translateDatabaseError(error);
  if (databaseError) {
    logger.error(
      `Kesalahan database pada ${req.method} ${req.originalUrl}:`,
      error.code,
      error.sqlMessage ?? error.message,
    );
    return sendError(res, databaseError);
  }

  // Sisanya merupakan cacat program: dicatat lengkap di server, sementara klien
  // hanya menerima pesan umum.
  logger.error(`Kesalahan tak tertangani pada ${req.method} ${req.originalUrl}:`, error);

  return sendError(res, {
    statusCode: 500,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: 'Terjadi kesalahan pada server. Silakan coba lagi.',
    // Rincian teknis hanya muncul di luar produksi untuk membantu penelusuran.
    details: config.isProduction ? undefined : { name: error?.name, message: error?.message },
  });
}

export default errorHandler;
