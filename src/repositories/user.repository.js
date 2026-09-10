import { query, queryOne, execute } from '../config/database.js';

/**
 * Fungsi untuk mengakses data tabel `users`.
 * Tidak ada kolom kata sandi karena proses masuk sepenuhnya melalui Google.
 */

const SELECT_COLUMNS = `
  id, google_id, campus_id, nim, name, email, role, profile_image, whatsapp,
  affiliation, faculty, study_program, study_program_code,
  token_version, created_at, updated_at
`;

/** Mengambil satu pengguna berdasarkan id. */
export async function findById(id, connection) {
  return queryOne(`SELECT ${SELECT_COLUMNS} FROM users WHERE id = ? LIMIT 1`, [id], connection);
}

/** Mengambil satu pengguna berdasarkan alamat email. */
export async function findByEmail(email, connection) {
  return queryOne(
    `SELECT ${SELECT_COLUMNS} FROM users WHERE email = ? LIMIT 1`,
    [String(email).toLowerCase()],
    connection,
  );
}

/** Mengambil satu pengguna berdasarkan identitas akun Google. */
export async function findByGoogleId(googleId, connection) {
  return queryOne(
    `SELECT ${SELECT_COLUMNS} FROM users WHERE google_id = ? LIMIT 1`,
    [googleId],
    connection,
  );
}

/** Memeriksa apakah sebuah identitas kampus sudah dipakai. */
export async function campusIdExists(campusId, connection) {
  const row = await queryOne('SELECT id FROM users WHERE campus_id = ? LIMIT 1', [campusId], connection);
  return row !== null;
}

/** Membuat baris pengguna baru. */
export async function create(
  {
    googleId = null,
    campusId,
    name,
    email,
    role,
    profileImage = null,
    whatsapp = null,
    nim = null,
    affiliation = null,
    faculty = null,
    studyProgram = null,
    studyProgramCode = null,
  },
  connection,
) {
  const result = await execute(
    `INSERT INTO users
       (google_id, campus_id, name, email, role, profile_image, whatsapp,
        nim, affiliation, faculty, study_program, study_program_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      googleId,
      campusId,
      name,
      String(email).toLowerCase(),
      role,
      profileImage,
      whatsapp,
      nim,
      affiliation,
      faculty,
      studyProgram,
      studyProgramCode,
    ],
    connection,
  );
  return findById(result.insertId, connection);
}

/**
 * Memperbarui data profil yang boleh diubah pengguna sendiri.
 * Kolom `email`, `role`, `campus_id`, dan `google_id` tidak diterima di sini.
 */
export async function updateProfile(id, { name, profileImage, whatsapp }, connection) {
  const fields = [];
  const params = [];

  if (name !== undefined) {
    fields.push('name = ?');
    params.push(name);
  }
  if (profileImage !== undefined) {
    fields.push('profile_image = ?');
    params.push(profileImage);
  }
  if (whatsapp !== undefined) {
    fields.push('whatsapp = ?');
    params.push(whatsapp);
  }

  if (fields.length === 0) return findById(id, connection);

  params.push(id);
  await execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params, connection);
  return findById(id, connection);
}

/**
 * Memperbarui peran pengguna.
 * Hanya dipanggil dari daftar penjual di konfigurasi server.
 */
export async function updateRole(id, role, connection) {
  await execute('UPDATE users SET role = ? WHERE id = ?', [role, id], connection);
  return findById(id, connection);
}

/**
 * Memperbarui data akademik pengguna.
 * Nilainya diturunkan dari NIM pada alamat email, bukan dari permintaan klien.
 */
export async function updateAcademicProfile(
  id,
  { nim = null, affiliation = null, faculty = null, studyProgram = null, studyProgramCode = null },
  connection,
) {
  await execute(
    `UPDATE users
        SET nim = ?, affiliation = ?, faculty = ?, study_program = ?, study_program_code = ?
      WHERE id = ?`,
    [nim, affiliation, faculty, studyProgram, studyProgramCode, id],
    connection,
  );
  return findById(id, connection);
}

/** Menautkan akun Google ke baris pengguna yang sudah ada. */
export async function linkGoogleId(id, googleId, connection) {
  await execute('UPDATE users SET google_id = ? WHERE id = ?', [googleId, id], connection);
  return findById(id, connection);
}

/** Menaikkan versi sesi sehingga seluruh kunci akses lama tidak lagi berlaku. */
export async function incrementTokenVersion(id, connection) {
  await execute('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [id], connection);
}

/** Mengambil seluruh pengguna dengan peran tertentu. */
export async function listByRole(role, connection) {
  return query(`SELECT ${SELECT_COLUMNS} FROM users WHERE role = ? ORDER BY id`, [role], connection);
}
