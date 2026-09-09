import { Router } from 'express';
import validate from '../middlewares/validate.js';
import authenticate from '../middlewares/authenticate.js';
import { writeLimiter } from '../middlewares/rateLimiters.js';
import { updateProfileSchema } from '../validators/user.validator.js';
import * as userController from '../controllers/user.controller.js';

/** Kumpulan jalur profil, tersedia untuk kedua peran. */
const router = Router();

router.use(authenticate);

router.get('/me', userController.getProfile);

router.patch('/me', writeLimiter, validate({ body: updateProfileSchema }), userController.updateProfile);

export default router;
