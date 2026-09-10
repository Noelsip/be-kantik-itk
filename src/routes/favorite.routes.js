import { Router } from 'express';
import validate from '../middlewares/validate.js';
import authenticate from '../middlewares/authenticate.js';
import authorize from '../middlewares/authorize.js';
import { writeLimiter } from '../middlewares/rateLimiters.js';
import { ROLES } from '../constants/roles.js';
import {
  addFavoriteSchema,
  favoriteParamSchema,
  favoriteListQuerySchema,
} from '../validators/favorite.validator.js';
import * as favoriteController from '../controllers/favorite.controller.js';

/**
 * Kumpulan jalur menu favorit.
 * Favorit merupakan fitur pembeli, sehingga seluruh jalurnya dibatasi peran.
 */
const router = Router();

router.use(authenticate, authorize(ROLES.PEMBELI));

router.get('/', validate({ query: favoriteListQuerySchema }), favoriteController.listFavorites);

router.post('/', writeLimiter, validate({ body: addFavoriteSchema }), favoriteController.addFavorite);

router.delete(
  '/:menuItemId',
  writeLimiter,
  validate({ params: favoriteParamSchema }),
  favoriteController.removeFavorite,
);

export default router;
