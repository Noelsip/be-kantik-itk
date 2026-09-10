import 'dotenv/config';
import { z } from 'zod';

/**
 * Konfigurasi environment.
 * Seluruh nilai diperiksa saat aplikasi dinyalakan agar kesalahan konfigurasi
 * langsung terlihat.
 */

const csv = (value) =>
  String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const booleanish = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    HOST: z.string().min(1).default('0.0.0.0'),

    // DATABASE_URL hanya dipakai bila berisi alamat MySQL, lihat resolveDatabaseUrl.
    DATABASE_URL: z.string().optional(),
    DB_HOST: z.string().min(1).default('127.0.0.1'),
    DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
    DB_USER: z.string().min(1).default('root'),
    DB_PASSWORD: z.string().default(''),
    DB_NAME: z.string().min(1).default('kantin_itk'),
    DB_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(100).default(10),

    // Hanya client id Google yang dibutuhkan, karena server memeriksa identitas
    // yang sudah diperoleh aplikasi dan tidak melakukan pertukaran kode OAuth.
    GOOGLE_CLIENT_ID: z.string().default(''),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET harus minimal 32 karakter'),
    JWT_EXPIRES_IN: z.string().min(1).default('7d'),
    JWT_ISSUER: z.string().min(1).default('kantin-itk-api'),

    ALLOWED_EMAIL_DOMAINS: z.string().default('student.itk.ac.id,lecture.itk.ac.id,itk.ac.id'),

    // Daftar email penjual. Sistem tidak memiliki peran admin, sehingga
    // penetapan penjual bersumber dari konfigurasi server ini.
    SELLER_EMAILS: z.string().default(''),

    CORS_ORIGINS: z.string().default('*'),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(15 * 60 * 1000),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
    TRUST_PROXY: booleanish.default('false'),

    // Jalur berkas kredensial akun layanan Firebase. Bila kosong, pesan push
    // tidak dikirim sementara riwayat notifikasi tetap tersimpan.
    FIREBASE_SERVICE_ACCOUNT: z.string().default(''),

    // Jalur masuk cepat untuk pengembangan, selalu mati di lingkungan produksi.
    ENABLE_DEV_LOGIN: booleanish.default('false'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (!env.GOOGLE_CLIENT_ID) {
        ctx.addIssue({
          code: 'custom',
          path: ['GOOGLE_CLIENT_ID'],
          message: 'GOOGLE_CLIENT_ID wajib diisi pada NODE_ENV=production',
        });
      }
      if (env.CORS_ORIGINS === '*') {
        ctx.addIssue({
          code: 'custom',
          path: ['CORS_ORIGINS'],
          message:
            'CORS_ORIGINS tidak boleh "*" pada NODE_ENV=production. Daftarkan origin secara eksplisit.',
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`\nKonfigurasi environment tidak valid:\n${details}\n`);
  process.exit(1);
}

const raw = parsed.data;

const isProduction = raw.NODE_ENV === 'production';
const isTest = raw.NODE_ENV === 'test';

/**
 * Penyaring DATABASE_URL agar hanya alamat MySQL yang dipakai.
 * Nilai milik proyek lain di environment sistem diabaikan.
 */
function resolveDatabaseUrl(value) {
  if (!value) return null;

  let protocol;
  try {
    ({ protocol } = new URL(value));
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[env] DATABASE_URL bukan alamat yang valid dan diabaikan. Konfigurasi DB_* yang dipakai.');
    return null;
  }

  if (protocol !== 'mysql:' && protocol !== 'mysqls:') {
    // eslint-disable-next-line no-console
    console.warn(
      `[env] DATABASE_URL diabaikan karena skema "${protocol}//" bukan MySQL. ` +
        'Konfigurasi DB_HOST/DB_NAME yang dipakai.',
    );
    return null;
  }

  return value;
}

const databaseUrl = resolveDatabaseUrl(raw.DATABASE_URL);

export const config = Object.freeze({
  env: raw.NODE_ENV,
  isProduction,
  isTest,
  isDevelopment: raw.NODE_ENV === 'development',

  server: Object.freeze({
    port: raw.PORT,
    host: raw.HOST,
    trustProxy: raw.TRUST_PROXY,
  }),

  db: Object.freeze({
    url: databaseUrl,
    host: raw.DB_HOST,
    port: raw.DB_PORT,
    user: raw.DB_USER,
    password: raw.DB_PASSWORD,
    database: raw.DB_NAME,
    connectionLimit: raw.DB_CONNECTION_LIMIT,
  }),

  auth: Object.freeze({
    googleClientId: raw.GOOGLE_CLIENT_ID,
    jwtSecret: raw.JWT_SECRET,
    jwtExpiresIn: raw.JWT_EXPIRES_IN,
    jwtIssuer: raw.JWT_ISSUER,
    allowedEmailDomains: Object.freeze(
      csv(raw.ALLOWED_EMAIL_DOMAINS).map((domain) => domain.toLowerCase()),
    ),
    sellerEmails: Object.freeze(csv(raw.SELLER_EMAILS).map((email) => email.toLowerCase())),
    // Nilai dari berkas .env sekalipun tidak dapat menyalakan jalur ini di produksi.
    devLoginEnabled: raw.ENABLE_DEV_LOGIN && !isProduction,
  }),

  firebase: Object.freeze({
    serviceAccountPath: raw.FIREBASE_SERVICE_ACCOUNT || null,
  }),

  http: Object.freeze({
    corsOrigins: raw.CORS_ORIGINS === '*' ? '*' : Object.freeze(csv(raw.CORS_ORIGINS)),
    rateLimitWindowMs: raw.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: raw.RATE_LIMIT_MAX,
    authRateLimitMax: raw.AUTH_RATE_LIMIT_MAX,
  }),
});

export default config;
