import { Router } from 'express';
import validate from '../middlewares/validate.js';
import authenticate from '../middlewares/authenticate.js';
import authorize from '../middlewares/authorize.js';
import { writeLimiter } from '../middlewares/rateLimiters.js';
import { ROLES } from '../constants/roles.js';
import { idParamSchema } from '../validators/common.js';
import { addCartItemSchema, updateCartItemSchema } from '../validators/cart.validator.js';
import * as cartController from '../controllers/cart.controller.js';

/**
 * Kumpulan jalur keranjang belanja.
 * Keranjang merupakan fitur pembeli, sehingga seluruh jalurnya dibatasi peran.
 */
const router = Router();

router.use(authenticate, authorize(ROLES.PEMBELI));

router.get('/', cartController.getCart);

router.post('/items', writeLimiter, validate({ body: addCartItemSchema }), cartController.addItem);

router.patch(
  '/items/:id',
  writeLimiter,
  validate({ params: idParamSchema, body: updateCartItemSchema }),
  cartController.updateItem,
);

router.delete('/items/:id', writeLimiter, validate({ params: idParamSchema }), cartController.removeItem);

router.delete('/', writeLimiter, cartController.clearCart);

export default router;
