import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { BusinessRuleError } from '../utils/errors.js';
import ERROR_CODES from '../constants/errorCodes.js';

/**
 * Penerimaan berkas gambar yang diunggah pengguna.
 * Berkas disimpan di direktori tersendiri dengan nama acak, dan hanya jenis
 * gambar yang diterima.
 */

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(projectRoot, 'uploads');

/** Awalan alamat tempat berkas unggahan disajikan. */
export const UPLOAD_URL_PATH = '/uploads';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

// Hanya jenis gambar yang lazim dipakai aplikasi, masing-masing dengan akhiran
// berkas yang ditentukan server, bukan diambil dari nama berkas kiriman.
const ALLOWED_TYPES = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const extension = ALLOWED_TYPES[file.mimetype] ?? '';
    cb(null, `${Date.now().toString(36)}-${randomBytes(12).toString('hex')}${extension}`);
  },
});

/** Menolak berkas yang jenisnya di luar daftar gambar yang diterima. */
function fileFilter(_req, file, cb) {
  if (ALLOWED_TYPES[file.mimetype]) return cb(null, true);
  cb(
    new BusinessRuleError(
      'Jenis berkas tidak didukung. Gunakan gambar JPG, PNG, atau WebP.',
      ERROR_CODES.VALIDATION_ERROR,
      { statusCode: 422 },
    ),
  );
}

export const uploadImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

/** Menyusun alamat lengkap sebuah berkas unggahan. */
export function buildUploadUrl(req, filename) {
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  return `${protocol}://${req.get('host')}${UPLOAD_URL_PATH}/${filename}`;
}
