import { Router } from 'express';
import authenticate from '../middlewares/authenticate.js';
import { writeLimiter } from '../middlewares/rateLimiters.js';
import { uploadImage as receiveImage } from '../config/uploads.js';
import * as uploadController from '../controllers/upload.controller.js';

/**
 * Kumpulan jalur unggah gambar, tersedia untuk kedua peran.
 * Alamat yang dikembalikan dapat dipasang pada field `imageUrl` maupun
 * `profileImage`.
 */
const router = Router();

router.use(authenticate);

router.post('/', writeLimiter, receiveImage.single('file'), uploadController.uploadImage);

export default router;
