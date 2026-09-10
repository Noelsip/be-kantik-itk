import { Router } from 'express';
import validate from '../middlewares/validate.js';
import authenticate from '../middlewares/authenticate.js';
import { writeLimiter } from '../middlewares/rateLimiters.js';
import { idParamSchema } from '../validators/common.js';
import {
  notificationListQuerySchema,
  registerDeviceSchema,
  deviceTokenParamSchema,
} from '../validators/notification.validator.js';
import * as notificationController from '../controllers/notification.controller.js';

/**
 * Kumpulan jalur notifikasi, tersedia untuk kedua peran.
 * Cabang `devices` mengelola perangkat penerima pesan push.
 */
const router = Router();

router.use(authenticate);

router.get(
  '/',
  validate({ query: notificationListQuerySchema }),
  notificationController.listNotifications,
);

router.get('/unread-count', notificationController.getUnreadCount);

router.patch('/read-all', writeLimiter, notificationController.markAllAsRead);

router.post(
  '/devices',
  writeLimiter,
  validate({ body: registerDeviceSchema }),
  notificationController.registerDevice,
);

router.delete(
  '/devices/:token',
  writeLimiter,
  validate({ params: deviceTokenParamSchema }),
  notificationController.unregisterDevice,
);

// Ditempatkan paling akhir agar tidak menyerap alamat seperti /unread-count.
router.patch(
  '/:id/read',
  writeLimiter,
  validate({ params: idParamSchema }),
  notificationController.markAsRead,
);

export default router;
