import { query, execute } from '../config/database.js';

/**
 * Fungsi untuk mengakses data tabel `device_tokens`.
 * Token menjadi alamat tujuan pesan push, sehingga kepemilikannya dijaga unik.
 */

/**
 * Mendaftarkan token perangkat pada sebuah akun.
 * Token yang sudah terdaftar atas akun lain berpindah kepemilikan, karena satu
 * perangkat hanya menerima pesan untuk akun yang sedang masuk di dalamnya.
 */
export async function register({ userId, token, platform = 'android' }, connection) {
  await execute(
    `INSERT INTO device_tokens (user_id, token, platform)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id),
       platform = VALUES(platform),
       updated_at = CURRENT_TIMESTAMP`,
    [userId, token, platform],
    connection,
  );
}

/** Menghapus satu token, dipakai saat pengguna keluar dari perangkatnya. */
export async function remove(token, connection) {
  const result = await execute('DELETE FROM device_tokens WHERE token = ?', [token], connection);
  return result.affectedRows > 0;
}

/** Menghapus seluruh token milik sebuah akun. */
export async function removeAllByUser(userId, connection) {
  const result = await execute('DELETE FROM device_tokens WHERE user_id = ?', [userId], connection);
  return result.affectedRows;
}

/** Mengambil seluruh token perangkat milik sebuah akun. */
export async function findTokensByUser(userId, connection) {
  const rows = await query(
    'SELECT token FROM device_tokens WHERE user_id = ? ORDER BY updated_at DESC',
    [userId],
    connection,
  );
  return rows.map((row) => row.token);
}

/** Menghapus sekumpulan token yang sudah ditolak layanan pesan. */
export async function removeMany(tokens, connection) {
  if (tokens.length === 0) return 0;
  const placeholders = tokens.map(() => '?').join(', ');
  const result = await execute(
    `DELETE FROM device_tokens WHERE token IN (${placeholders})`,
    tokens,
    connection,
  );
  return result.affectedRows;
}
