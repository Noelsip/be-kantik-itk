/**
 * Pembungkus respons agar bentuknya seragam di seluruh endpoint.
 * Respons berhasil berisi `success`, `message`, dan `data`; respons gagal
 * menggantinya dengan `error`.
 */

export function sendSuccess(res, { message = 'Berhasil', data = null, statusCode = 200, meta } = {}) {
  const body = { success: true, message, data };
  if (meta !== undefined) body.meta = meta;
  return res.status(statusCode).json(body);
}

export function sendCreated(res, { message = 'Berhasil dibuat', data = null, meta } = {}) {
  return sendSuccess(res, { message, data, meta, statusCode: 201 });
}

export function sendError(res, { message, code, statusCode = 500, details } = {}) {
  const error = { code };
  if (details !== undefined) error.details = details;
  return res.status(statusCode).json({ success: false, message, error });
}

/** Menyusun bagian `meta` untuk respons daftar yang memakai halaman. */
export function buildPaginationMeta({ page, limit, total }) {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
