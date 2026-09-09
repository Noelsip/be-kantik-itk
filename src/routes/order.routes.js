import { Router } from 'express';
import validate from '../middlewares/validate.js';
import authenticate from '../middlewares/authenticate.js';
import authorize from '../middlewares/authorize.js';
import { writeLimiter } from '../middlewares/rateLimiters.js';
import { ROLES } from '../constants/roles.js';
import { idParamSchema } from '../validators/common.js';
import { createOrderSchema, orderListQuerySchema } from '../validators/order.validator.js';
import * as orderController from '../controllers/order.controller.js';

/** Kumpulan jalur pesanan untuk pembeli. */
const router = Router();

router.use(authenticate, authorize(ROLES.PEMBELI));

router.post('/', writeLimiter, validate({ body: createOrderSchema }), orderController.createOrder);

router.get('/', validate({ query: orderListQuerySchema }), orderController.listOrders);

router.get('/:id', validate({ params: idParamSchema }), orderController.getOrder);

router.patch(
  '/:id/cancel',
  writeLimiter,
  validate({ params: idParamSchema }),
  orderController.cancelOrder,
);

export default router;
