import { readFileSync } from 'node:fs';
import { GoogleAuth } from 'google-auth-library';
import config from '../config/env.js';
import logger from '../utils/logger.js';

/**
 * Fungsi untuk mengirim pesan push melalui Firebase Cloud Messaging.
 *
 * Pengiriman bersifat pelengkap: bila kredensial belum disiapkan atau Firebase
 * sedang bermasalah, riwayat notifikasi tetap tersimpan dan aplikasi tetap
 * berjalan seperti biasa.
 */

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

// Kode dari Firebase yang menandakan token perangkat sudah tidak berlaku,
// misalnya aplikasi dicopot atau tokennya diganti.
const STALE_TOKEN_CODES = new Set([
  'UNREGISTERED',
  'INVALID_ARGUMENT',
  'NOT_FOUND',
  'SENDER_ID_MISMATCH',
]);

let cached = null;
let warnedOnce = false;

/** Membaca kredensial akun layanan sekali, lalu menyimpannya di memori. */
function loadCredentials() {
  if (cached !== null) return cached;

  const source = config.firebase.serviceAccountPath;
  if (!source) {
    cached = false;
    return cached;
  }

  try {
    const raw = readFileSync(source, 'utf8');
    const credentials = JSON.parse(raw);
    if (!credentials.project_id || !credentials.client_email || !credentials.private_key) {
      throw new Error('Berkas kredensial tidak memuat project_id, client_email, dan private_key');
    }

    cached = {
      projectId: credentials.project_id,
      auth: new GoogleAuth({ credentials, scopes: [SCOPE] }),
    };
    logger.info(`Firebase siap mengirim pesan untuk project ${credentials.project_id}`);
  } catch (error) {
    logger.error('Kredensial Firebase tidak dapat dibaca:', error.message);
    cached = false;
  }

  return cached;
}

/** Memberi tahu sekali saja bahwa pengiriman push sedang tidak aktif. */
function warnDisabled() {
  if (warnedOnce) return;
  warnedOnce = true;
  logger.warn('Pesan push tidak dikirim karena kredensial Firebase belum disiapkan.');
}

export function isPushEnabled() {
  return loadCredentials() !== false;
}

/** Mengirim satu pesan ke satu token dan mengembalikan hasilnya. */
async function sendOne(client, projectId, token, message) {
  const response = await client.request({
    url: `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    method: 'POST',
    data: {
      message: {
        token,
        notification: { title: message.title, body: message.body },
        // Seluruh nilai data pada FCM wajib berupa teks.
        data: Object.fromEntries(
          Object.entries(message.data ?? {}).map(([key, value]) => [key, String(value)]),
        ),
        android: { priority: 'high', notification: { sound: 'default' } },
        apns: { payload: { aps: { sound: 'default' } } },
      },
    },
  });
  return response.data;
}

/** Membaca kode kesalahan Firebase dari bentuk jawaban yang bertingkat. */
function extractErrorCode(error) {
  const details = error?.response?.data?.error?.details ?? [];
  const fcmDetail = details.find((detail) => detail?.errorCode);
  return fcmDetail?.errorCode ?? error?.response?.data?.error?.status ?? null;
}

/**
 * Mengirim satu pesan ke sekumpulan token perangkat.
 * Token yang ditolak Firebase dikembalikan agar pemanggil dapat membersihkannya.
 */
export async function sendToTokens(tokens, message) {
  const hasil = { sent: 0, failed: 0, staleTokens: [], skipped: false };

  if (tokens.length === 0) return hasil;

  const credentials = loadCredentials();
  if (credentials === false) {
    warnDisabled();
    hasil.skipped = true;
    return hasil;
  }

  const client = await credentials.auth.getClient();

  await Promise.all(
    tokens.map(async (token) => {
      try {
        await sendOne(client, credentials.projectId, token, message);
        hasil.sent += 1;
      } catch (error) {
        hasil.failed += 1;
        const code = extractErrorCode(error);
        if (STALE_TOKEN_CODES.has(code)) {
          hasil.staleTokens.push(token);
        } else {
          logger.warn(`Pesan push gagal terkirim: ${code ?? error.message}`);
        }
      }
    }),
  );

  return hasil;
}

export default sendToTokens;
