import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mysql from 'mysql2/promise';
import config from '../src/config/env.js';
import logger from '../src/utils/logger.js';

/**
 * Penjalan migrasi skema database.
 * Tiap berkas dijalankan sekali dan dicatat pada `schema_migrations`.
 * Pilihan --fresh menghapus database lalu membangunnya ulang.
 */

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'database',
  'migrations',
);

/** Membuka koneksi tanpa memilih database, agar dapat membuat atau menghapusnya. */
async function connectServer() {
  return mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });
}

/**
 * Memecah isi berkas migrasi menjadi kumpulan perintah.
 * Titik koma di dalam teks maupun komentar tidak ikut memotong.
 */
function splitStatements(sql) {
  const statements = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inLineComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      else continue;
    } else if (!inSingle && !inDouble && !inBacktick && char === '-' && next === '-') {
      inLineComment = true;
      i += 1;
      continue;
    } else if (char === "'" && !inDouble && !inBacktick) {
      inSingle = !inSingle;
    } else if (char === '"' && !inSingle && !inBacktick) {
      inDouble = !inDouble;
    } else if (char === '`' && !inSingle && !inDouble) {
      inBacktick = !inBacktick;
    }

    if (char === ';' && !inSingle && !inDouble && !inBacktick) {
      if (current.trim()) statements.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

async function run() {
  const fresh = process.argv.includes('--fresh');
  const databaseName = config.db.database;

  // Nama database tidak dapat dikirim sebagai parameter terikat pada perintah
  // CREATE atau DROP, sehingga nilainya diperiksa ketat sebelum disisipkan.
  if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
    throw new Error(`Nama database tidak valid: ${databaseName}`);
  }

  const server = await connectServer();

  try {
    if (fresh) {
      logger.warn(`Pilihan --fresh menghapus database \`${databaseName}\` beserta seluruh isinya`);
      await server.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
    }

    await server.query(
      `CREATE DATABASE IF NOT EXISTS \`${databaseName}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
    );
    await server.query(`USE \`${databaseName}\``);

    await server.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       VARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const [appliedRows] = await server.query('SELECT name FROM schema_migrations');
    const applied = new Set(appliedRows.map((row) => row.name));

    const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) {
        logger.debug(`- ${file} sudah diterapkan`);
        continue;
      }

      const sql = await readFile(path.join(migrationsDir, file), 'utf8');
      const statements = splitStatements(sql);

      // Berkas dicatat diterapkan hanya bila seluruh perintahnya berhasil.
      // Perintah memakai IF NOT EXISTS sehingga aman dijalankan ulang.
      try {
        for (const statement of statements) {
          await server.query(statement);
        }
        await server.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      } catch (error) {
        throw new Error(`Migrasi gagal pada ${file}: ${error.message}`, { cause: error });
      }

      logger.info(`+ ${file} diterapkan (${statements.length} perintah)`);
      count += 1;
    }

    logger.info(
      count === 0
        ? `Database \`${databaseName}\` sudah paling baru, tidak ada migrasi baru.`
        : `Selesai. ${count} migrasi diterapkan ke \`${databaseName}\`.`,
    );
  } finally {
    await server.end();
  }
}

run().catch((error) => {
  logger.error('Migrasi gagal:', error.message);
  process.exitCode = 1;
});
