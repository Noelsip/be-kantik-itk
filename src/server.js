import config from './config/env.js';
import { createApp } from './app.js';
import { assertDatabaseConnection, closePool } from './config/database.js';
import logger from './utils/logger.js';

/**
 * Titik masuk proses: memeriksa database, menyalakan server, lalu menutup
 * keduanya dengan rapi ketika menerima sinyal berhenti.
 */

async function start() {
  try {
    await assertDatabaseConnection();
  } catch (error) {
    logger.error('Tidak dapat terhubung ke database MySQL.', error?.message ?? error);
    logger.error('Periksa konfigurasi DB_* pada berkas .env dan pastikan MySQL berjalan.');
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(config.server.port, config.server.host, () => {
    logger.info(`Kantin ITK API berjalan pada http://${config.server.host}:${config.server.port}`);
    logger.info(`Dokumentasi API tersedia pada http://${config.server.host}:${config.server.port}/docs-api`);
    logger.info(`Mode: ${config.env}`);

    if (config.auth.devLoginEnabled) {
      logger.warn('Masuk mode pengembangan aktif melalui POST /api/auth/dev-login.');
    }
    if (!config.auth.googleClientId) {
      logger.warn('GOOGLE_CLIENT_ID belum diisi sehingga masuk dengan Google akan ditolak.');
    }
    if (config.auth.sellerEmails.length === 0) {
      logger.warn('SELLER_EMAILS masih kosong sehingga belum ada akun berperan penjual.');
    }
  });

  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Menerima ${signal}, mematikan server...`);

    server.close(async (error) => {
      if (error) logger.error('Gagal menutup server HTTP:', error);
      try {
        await closePool();
        logger.info('Koneksi database ditutup.');
        process.exit(error ? 1 : 0);
      } catch (poolError) {
        logger.error('Gagal menutup koneksi database:', poolError);
        process.exit(1);
      }
    });

    // Batas waktu agar proses tidak menggantung karena koneksi yang masih terbuka.
    setTimeout(() => {
      logger.error('Proses berhenti melebihi batas waktu, keluar secara paksa.');
      process.exit(1);
    }, 10_000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Promise ditolak tanpa penanganan:', reason);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Kesalahan tidak tertangkap:', error);
    shutdown('uncaughtException');
  });
}

start();
