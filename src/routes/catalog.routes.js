import { Router } from 'express';
import validate from '../middlewares/validate.js';
import authenticate from '../middlewares/authenticate.js';
import authorize from '../middlewares/authorize.js';
import { writeLimiter } from '../middlewares/rateLimiters.js';
import { ROLES } from '../constants/roles.js';
import { idParamSchema } from '../validators/common.js';
import {
  canteenListQuerySchema,
  canteenMenuQuerySchema,
  menuListQuerySchema,
  createCategorySchema,
} from '../validators/catalog.validator.js';
import * as catalogController from '../controllers/catalog.controller.js';

/**
 * Kumpulan jalur katalog kantin, menu, dan kategori.
 * Seluruhnya hanya membaca data, namun tetap memerlukan proses masuk.
 */

export const canteenRouter = Router();

canteenRouter.get(
  '/',
  authenticate,
  validate({ query: canteenListQuerySchema }),
  catalogController.listCanteens,
);

canteenRouter.get(
  '/:id',
  authenticate,
  validate({ params: idParamSchema }),
  catalogController.getCanteen,
);

canteenRouter.get(
  '/:id/menu',
  authenticate,
  validate({ params: idParamSchema, query: canteenMenuQuerySchema }),
  catalogController.getCanteenMenu,
);

export const menuRouter = Router();

menuRouter.get('/', authenticate, validate({ query: menuListQuerySchema }), catalogController.listMenu);

menuRouter.get(
  '/:id',
  authenticate,
  validate({ params: idParamSchema }),
  catalogController.getMenuItem,
);

export const categoryRouter = Router();

categoryRouter.get('/', authenticate, catalogController.listCategories);

// Sistem tidak memiliki peran admin, sehingga penambahan kategori dipercayakan
// kepada penjual yang memang membutuhkannya saat menyusun menu.
categoryRouter.post(
  '/',
  authenticate,
  authorize(ROLES.PENJUAL),
  writeLimiter,
  validate({ body: createCategorySchema }),
  catalogController.createCategory,
);
