import { mkdirSync } from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { apiReference } from '@scalar/express-api-reference';

import config from './config/env.js';
import routes from './routes/index.js';
import notFound from './middlewares/notFound.js';
import errorHandler from './middlewares/errorHandler.js';
import { globalLimiter } from './middlewares/rateLimiters.js';
import { openapiDocument } from './docs/openapi.js';
import { UPLOAD_DIR, UPLOAD_URL_PATH } from './config/uploads.js';
import logger from './utils/logger.js';

/**
 * Penyusun aplikasi Express.
 * Dipisahkan dari berkas server agar pengujian dapat memakainya tanpa porta.
 */
export function createApp() {
  const app = express();

  // Diperlukan agar alamat IP klien terbaca benar ketika server berada di balik
  // reverse proxy. Bawaannya mati, karena menyalakannya tanpa proxy membuat
  // alamat IP dapat dipalsukan lewat header.
  if (config.server.trustProxy) {
    app.set('trust proxy', 1);
  }

  app.disable('x-powered-by');

  app.use(
    helmet({
      // Layanan ini hanya menyajikan data dan halaman dokumentasi, sehingga
      // kebijakan konten ketat tidak diperlukan.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Aplikasi Flutter tidak mengirim header Origin sehingga tidak terpengaruh
  // pengaturan ini. Daftar origin melindungi pemanggil dari peramban.
  app.use(
    cors({
      origin: config.http.corsOrigins,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: false,
      maxAge: 86400,
    }),
  );

  app.use(compression());

  // Batas ukuran badan permintaan menahan pemakaian memori per permintaan.
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  if (!config.isTest) {
    app.use(
      morgan(config.isProduction ? 'combined' : 'dev', {
        stream: { write: (message) => logger.info(message.trim()) },
      }),
    );
  }

  // Direktori unggahan disiapkan saat aplikasi disusun, agar berkas pertama yang
  // masuk tidak gagal hanya karena direktorinya belum ada.
  mkdirSync(UPLOAD_DIR, { recursive: true });

  // Berkas unggahan disajikan apa adanya tanpa kemampuan menjalankan apa pun.
  app.use(
    UPLOAD_URL_PATH,
    express.static(UPLOAD_DIR, {
      index: false,
      dotfiles: 'deny',
      maxAge: '7d',
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );

  app.use('/api', globalLimiter);

  // Dokumentasi API disajikan dengan Scalar, membaca berkas OpenAPI di bawah.
  app.get('/openapi.json', (_req, res) => res.json(openapiDocument));
  app.use(
    '/docs-api',
    apiReference({
      url: '/openapi.json',
      theme: 'purple',
      pageTitle: 'Dokumentasi API Kantin ITK',
    }),
  );

  app.use('/api', routes);

  app.get('/', (_req, res) =>
    res.json({
      success: true,
      message: 'Kantin ITK API',
      data: { version: '1.0.0', docs: '/docs-api', health: '/api/health' },
    }),
  );

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
