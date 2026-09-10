import { Router } from 'express';
import validate from '../middlewares/validate.js';
import authenticate from '../middlewares/authenticate.js';
import { writeLimiter } from '../middlewares/rateLimiters.js';
import { updateProfileSchema } from '../validators/user.validator.js';
import * as userController from '../controllers/user.controller.js';
import * as uploadController from '../controllers/upload.controller.js';
import { uploadImage } from '../config/uploads.js';

/** Kumpulan jalur profil, tersedia untuk kedua peran. */
const router = Router();

router.use(authenticate);

router.get('/me', userController.getProfile);

router.get('/me/stats', userController.getStats);

// PUT disediakan sebagai bentuk lain dari PATCH, karena kedua metode sama-sama
// lazim dipakai aplikasi untuk menyunting profil.
router.patch('/me', writeLimiter, validate({ body: updateProfileSchema }), userController.updateProfile);
router.put('/me', writeLimiter, validate({ body: updateProfileSchema }), userController.updateProfile);

// Mengunggah berkas gambar sekaligus memasangnya sebagai foto profil.
router.post('/me/photo', writeLimiter, uploadImage.single('file'), uploadController.uploadProfilePhoto);

export default router;
