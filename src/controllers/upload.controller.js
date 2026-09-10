import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { BusinessRuleError } from '../utils/errors.js';
import ERROR_CODES from '../constants/errorCodes.js';
import { buildUploadUrl } from '../config/uploads.js';
import * as userService from '../services/user.service.js';

/**
 * Fungsi untuk menangani unggahan berkas gambar.
 * Berkas diterima lapisan multer, dan handler di sini hanya menyusun jawabannya.
 */

/** Memastikan permintaan benar-benar menyertakan berkas. */
function requireFile(req) {
  if (!req.file) {
    throw new BusinessRuleError('Berkas gambar belum disertakan.', ERROR_CODES.VALIDATION_ERROR, {
      statusCode: 422,
    });
  }
  return req.file;
}

/** Menangani unggahan gambar yang alamatnya dipakai sendiri oleh aplikasi. */
export const uploadImage = asyncHandler(async (req, res) => {
  const file = requireFile(req);
  return sendCreated(res, {
    message: 'Gambar berhasil diunggah',
    data: {
      url: buildUploadUrl(req, file.filename),
      fileName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
    },
  });
});

/** Menangani unggahan foto profil sekaligus memasangnya pada akun. */
export const uploadProfilePhoto = asyncHandler(async (req, res) => {
  const file = requireFile(req);
  const url = buildUploadUrl(req, file.filename);
  const user = await userService.updateProfile(req.user.id, { profileImage: url });
  return sendSuccess(res, { message: 'Foto profil berhasil diperbarui', data: user });
});
