import mysql from 'mysql2/promise';
import config from './env.js';
import logger from '../utils/logger.js';

/**
 * Kumpulan koneksi MySQL.
 * Seluruh kueri memakai prepared statement dengan parameter terikat, bukan
 * penyambungan teks, sebagai penjaga utama dari penyisipan SQL.
 */

const baseOptions = {
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,
  charset: 'utf8mb4_0900_ai_ci',
  timezone: 'Z',
  // Kolom DECIMAL tetap berupa teks agar nilai uang tidak melalui bilangan pecahan biner.
  decimalNumbers: false,
  supportBigNumbers: true,
  // Kueri bertumpuk dimatikan; hanya skrip migrasi yang memakai koneksi khusus.
  multipleStatements: false,
};

export const pool = config.db.url
  ? mysql.createPool({ uri: config.db.url, ...baseOptions })
  : mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      ...baseOptions,
    });

/** Menjalankan kueri berparameter dan mengembalikan seluruh baris. */
export async function query(sql, params = [], connection) {
  const executor = connection ?? pool;
  const [rows] = await executor.execute(sql, params);
  return rows;
}

/** Menjalankan kueri berparameter dan mengembalikan baris pertama saja. */
export async function queryOne(sql, params = [], connection) {
  const rows = await query(sql, params, connection);
  return rows.length > 0 ? rows[0] : null;
}

/** Menjalankan perintah tulis dan mengembalikan hasil dari driver. */
export async function execute(sql, params = [], connection) {
  const executor = connection ?? pool;
  const [result] = await executor.execute(sql, params);
  return result;
}

/**
 * Menjalankan sekumpulan operasi di dalam satu transaksi.
 * Disimpan bila callback selesai, dibatalkan bila terjadi kesalahan.
 */
export async function withTransaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      logger.error('Gagal membatalkan transaksi', rollbackError);
    }
    throw error;
  } finally {
    connection.release();
  }
}

/** Memastikan database dapat dihubungi sebelum server menyatakan siap. */
export async function assertDatabaseConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
    const target = config.db.url
      ? '(DATABASE_URL)'
      : `${config.db.host}:${config.db.port}/${config.db.database}`;
    logger.info(`Terhubung ke MySQL: ${target}`);
  } finally {
    connection.release();
  }
}

export async function closePool() {
  await pool.end();
}

export default pool;
