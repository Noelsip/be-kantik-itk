import { ValidationError } from '../utils/errors.js';

/**
 * Pemeriksaan isi permintaan sekaligus penggantian isinya dengan hasil olahan.
 * Lapisan berikutnya hanya menerima field yang dideklarasikan skema, sehingga
 * field tambahan seperti `role` tidak dapat diselundupkan.
 */
export function validate(schemas) {
  return function validateMiddleware(req, _res, next) {
    const issues = [];

    for (const segment of ['params', 'query', 'body']) {
      const schema = schemas[segment];
      if (!schema) continue;

      // Badan permintaan yang kosong diperlakukan sebagai objek kosong agar
      // skema dengan seluruh field opsional tetap dapat diterima.
      const input = segment === 'body' ? (req.body ?? {}) : req[segment];
      const result = schema.safeParse(input);

      if (!result.success) {
        for (const issue of result.error.issues) {
          issues.push({
            field: issue.path.join('.') || segment,
            message: issue.message,
          });
        }
        continue;
      }

      if (segment === 'query') {
        // Pada Express 5 `req.query` hanya dapat dibaca, sehingga hasil olahan
        // disimpan pada properti tersendiri.
        req.validatedQuery = result.data;
      } else {
        req[segment] = result.data;
      }
    }

    if (issues.length > 0) {
      return next(new ValidationError('Data yang dikirim tidak valid', issues));
    }

    return next();
  };
}

export default validate;
