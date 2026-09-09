import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import cartRoutes from './cart.routes.js';
import orderRoutes from './order.routes.js';
import sellerRoutes from './seller.routes.js';
import { canteenRouter, menuRouter, categoryRouter } from './catalog.routes.js';
import { sendSuccess } from '../utils/response.js';

/** Penggabung seluruh kelompok jalur di bawah awalan /api. */
const router = Router();

/** Jalur pemeriksaan status layanan, terbuka dan tanpa proses masuk. */
router.get('/health', (_req, res) =>
  sendSuccess(res, {
    message: 'Kantin ITK API berjalan',
    data: { status: 'ok', timestamp: new Date().toISOString() },
  }),
);

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/canteens', canteenRouter);
router.use('/menu', menuRouter);
router.use('/categories', categoryRouter);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/seller', sellerRoutes);

export default router;
