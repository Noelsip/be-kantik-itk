import { Router } from 'express';
import config from '../config/env.js';
import validate from '../middlewares/validate.js';
import authenticate from '../middlewares/authenticate.js';
import { authLimiter } from '../middlewares/rateLimiters.js';
import { googleLoginSchema, devLoginSchema } from '../validators/auth.validator.js';
import * as authController from '../controllers/auth.controller.js';

/** Kumpulan jalur untuk proses masuk dan keluar. */
const router = Router();

router.post('/google', authLimiter, validate({ body: googleLoginSchema }), authController.googleLogin);

// Jalur masuk cepat hanya didaftarkan di luar lingkungan produksi, sehingga di
// produksi alamat ini benar-benar tidak ada.
if (config.auth.devLoginEnabled) {
  router.post('/dev-login', authLimiter, validate({ body: devLoginSchema }), authController.devLogin);
}

router.get('/me', authenticate, authController.me);
router.post('/logout', authenticate, authController.logout);

export default router;
