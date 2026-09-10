import { Router } from 'express';
import validate from '../middlewares/validate.js';
import authenticate from '../middlewares/authenticate.js';
import authorize from '../middlewares/authorize.js';
import { writeLimiter } from '../middlewares/rateLimiters.js';
import { ROLES } from '../constants/roles.js';
import { idParamSchema } from '../validators/common.js';
import { orderListQuerySchema, rejectOrderSchema } from '../validators/order.validator.js';
import {
  createMenuSchema,
  updateMenuSchema,
  sellerMenuQuerySchema,
  createCanteenSchema,
  updateCanteenSchema,
} from '../validators/seller.validator.js';
import * as sellerController from '../controllers/seller.controller.js';
import * as uploadController from '../controllers/upload.controller.js';
import { uploadImage } from '../config/uploads.js';

/**
 * Kumpulan jalur untuk penjual.
 * Satu penjagaan peran menutupi seluruh cabang ini, dan kepemilikan tiap data
 * diperiksa kembali pada lapisan layanan.
 */
const router = Router();

router.use(authenticate, authorize(ROLES.PENJUAL));

router.get('/dashboard', sellerController.getDashboard);

router.get('/canteen', sellerController.getCanteen);
router.post('/canteen', writeLimiter, validate({ body: createCanteenSchema }), sellerController.createCanteen);
router.patch('/canteen', writeLimiter, validate({ body: updateCanteenSchema }), sellerController.updateCanteen);

// Mengunggah berkas gambar sekaligus memasangnya sebagai foto kantin.
router.post('/canteen/photo', writeLimiter, uploadImage.single('file'), uploadController.uploadCanteenPhoto);

router.get('/menu', validate({ query: sellerMenuQuerySchema }), sellerController.listMenu);
router.get('/menu/:id', validate({ params: idParamSchema }), sellerController.getMenuItem);
router.post('/menu', writeLimiter, validate({ body: createMenuSchema }), sellerController.createMenuItem);
router.patch(
  '/menu/:id',
  writeLimiter,
  validate({ params: idParamSchema, body: updateMenuSchema }),
  sellerController.updateMenuItem,
);
router.delete('/menu/:id', writeLimiter, validate({ params: idParamSchema }), sellerController.deleteMenuItem);

// Mengunggah berkas gambar sekaligus memasangnya sebagai foto sebuah menu.
router.post(
  '/menu/:id/photo',
  writeLimiter,
  validate({ params: idParamSchema }),
  uploadImage.single('file'),
  uploadController.uploadMenuPhoto,
);

router.get('/orders', validate({ query: orderListQuerySchema }), sellerController.listOrders);
router.get('/orders/:id', validate({ params: idParamSchema }), sellerController.getOrder);

router.patch(
  '/orders/:id/accept',
  writeLimiter,
  validate({ params: idParamSchema }),
  sellerController.acceptOrder,
);
router.patch(
  '/orders/:id/reject',
  writeLimiter,
  validate({ params: idParamSchema, body: rejectOrderSchema }),
  sellerController.rejectOrder,
);
router.patch(
  '/orders/:id/process',
  writeLimiter,
  validate({ params: idParamSchema }),
  sellerController.processOrder,
);
router.patch(
  '/orders/:id/ready',
  writeLimiter,
  validate({ params: idParamSchema }),
  sellerController.readyOrder,
);
router.patch(
  '/orders/:id/complete',
  writeLimiter,
  validate({ params: idParamSchema }),
  sellerController.completeOrder,
);

export default router;
