import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { BusinessRuleError } from '../utils/errors.js';
import ERROR_CODES from '../constants/errorCodes.js';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { buildUploadUrl, UPLOAD_DIR } from '../config/uploads.js';
import logger from '../utils/logger.js';
import * as userService from '../services/user.service.js';
import * as sellerService from '../services/seller.service.js';

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

/**
 * Membuang berkas yang sudah tersimpan ketika pemasangannya gagal.
 * Tanpa ini, penolakan kepemilikan akan meninggalkan berkas yatim di server.
 */
async function buangBerkas(fileName) {
  try {
    await unlink(path.join(UPLOAD_DIR, fileName));
  } catch (error) {
    logger.warn(`Berkas unggahan gagal dibuang: ${error.message}`);
  }
}

/** Mengunggah berkas lalu memasangnya, dan membatalkan unggahan bila gagal. */
async function unggahLaluPasang(req, pasang) {
  const file = requireFile(req);
  const url = buildUploadUrl(req, file.filename);
  try {
    return await pasang(url);
  } catch (error) {
    await buangBerkas(file.filename);
    throw error;
  }
}

/** Menangani unggahan foto profil sekaligus memasangnya pada akun. */
export const uploadProfilePhoto = asyncHandler(async (req, res) => {
  const user = await unggahLaluPasang(req, (url) =>
    userService.updateProfile(req.user.id, { profileImage: url }),
  );
  return sendSuccess(res, { message: 'Foto profil berhasil diperbarui', data: user });
});

/** Menangani unggahan foto sebuah menu milik penjual sekaligus memasangnya. */
export const uploadMenuPhoto = asyncHandler(async (req, res) => {
  const menu = await unggahLaluPasang(req, (url) =>
    sellerService.updateMenuItem(req.user.id, req.params.id, { imageUrl: url }),
  );
  return sendSuccess(res, { message: 'Foto menu berhasil diperbarui', data: menu });
});

/** Menangani unggahan foto kantin milik penjual sekaligus memasangnya. */
export const uploadCanteenPhoto = asyncHandler(async (req, res) => {
  const canteen = await unggahLaluPasang(req, (url) =>
    sellerService.updateOwnCanteen(req.user.id, { imageUrl: url }),
  );
  return sendSuccess(res, { message: 'Foto kantin berhasil diperbarui', data: canteen });
});
