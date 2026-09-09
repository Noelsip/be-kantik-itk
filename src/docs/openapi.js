import { schemas } from './schemas.js';
import { paths } from './paths.js';
import config from '../config/env.js';

/**
 * Berkas OpenAPI yang menjadi sumber tampilan dokumentasi Scalar.
 *
 * Dokumen disusun dari potongan skema dan jalur, lalu disajikan pada
 * /openapi.json sementara halaman bacanya berada di /docs.
 */

const description = [
  'REST API untuk aplikasi pemesanan kantin kampus Institut Teknologi Kalimantan.',
  '',
  'Pembeli dapat menelusuri kantin, mencari menu, mengisi keranjang, membuat pesanan,',
  'dan memantau statusnya. Penjual memakai API yang sama dengan peran berbeda untuk',
  'mengelola menu serta memproses pesanan yang masuk.',
  '',
  '## Cara memakai',
  '',
  '1. Aplikasi menjalankan proses masuk Google, lalu mengirim hasilnya ke `POST /api/auth/google`.',
  '2. Simpan `accessToken` dari respons tersebut.',
  '3. Sertakan pada setiap permintaan berikutnya melalui header `Authorization: Bearer <accessToken>`.',
  '',
  '## Bentuk respons',
  '',
  'Setiap respons memakai bentuk yang sama.',
  '',
  'Berhasil:',
  '```json',
  '{ "success": true, "message": "Pesanan berhasil dibuat", "data": { } }',
  '```',
  '',
  'Gagal:',
  '```json',
  '{ "success": false, "message": "Menu tidak tersedia", "error": { "code": "MENU_UNAVAILABLE" } }',
  '```',
  '',
  'Isi `message` aman ditampilkan langsung kepada pengguna. Untuk percabangan di',
  'aplikasi, gunakan `error.code` karena teks pesan dapat berubah sewaktu-waktu.',
  '',
  '## Peran pengguna',
  '',
  '- **pembeli** — menelusuri kantin dan menu, mengisi keranjang, membuat dan memantau pesanan.',
  '- **penjual** — mengelola kantin dan menu sendiri, serta memproses pesanan yang masuk.',
  '',
  'Peran ditentukan di sisi server. Domain email kampus tidak dengan sendirinya',
  'menjadikan sebuah akun berperan penjual.',
  '',
  '## Pembayaran',
  '',
  'Pembayaran dilakukan langsung di kantin saat pesanan diambil. Sistem tidak',
  'menyimpan data pembayaran dalam bentuk apa pun.',
].join('\n');

const tags = [
  { name: 'Umum', description: 'Pemeriksaan status layanan.' },
  {
    name: 'Autentikasi',
    description: 'Masuk dengan akun Google, melihat akun yang sedang masuk, dan keluar.',
  },
  { name: 'Profil', description: 'Membaca dan mengubah data profil pengguna.' },
  { name: 'Kantin', description: 'Menelusuri kantin beserta menunya.' },
  { name: 'Menu', description: 'Mencari, menyaring, dan melihat detail menu.' },
  {
    name: 'Keranjang',
    description:
      'Mengelola isi keranjang pembeli. Satu keranjang hanya boleh memuat menu dari satu kantin.',
  },
  {
    name: 'Pesanan',
    description: 'Membuat pesanan dari keranjang, memantau status, dan membatalkan bila masih dimungkinkan.',
  },
  { name: 'Penjual - Dasbor', description: 'Ringkasan pesanan untuk halaman utama penjual.' },
  { name: 'Penjual - Kantin', description: 'Mengelola data kantin milik sendiri.' },
  { name: 'Penjual - Menu', description: 'Menambah, mengubah, dan menghapus menu milik sendiri.' },
  {
    name: 'Penjual - Pesanan',
    description: 'Menerima, menolak, memproses, dan menyelesaikan pesanan yang masuk.',
  },
];

/** Menyusun satu respons kesalahan baku untuk dipakai berulang. */
function errorResponse(description, code, example) {
  return {
    description,
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorEnvelope' },
        example: { success: false, message: example, error: { code } },
      },
    },
  };
}

const responses = {
  Unauthorized: errorResponse(
    'Belum masuk, atau sesi sudah tidak berlaku.',
    'UNAUTHENTICATED',
    'Anda belum masuk. Silakan masuk terlebih dahulu.',
  ),
  ForbiddenBuyerOnly: errorResponse(
    'Fitur ini hanya untuk pembeli.',
    'FORBIDDEN_ROLE',
    'Akses ditolak. Fitur ini hanya untuk Pembeli.',
  ),
  ForbiddenSellerOnly: errorResponse(
    'Fitur ini hanya untuk penjual.',
    'FORBIDDEN_ROLE',
    'Akses ditolak. Fitur ini hanya untuk Penjual.',
  ),
  EmailNotAllowed: errorResponse(
    'Alamat email tidak diizinkan memakai aplikasi.',
    'EMAIL_DOMAIN_NOT_ALLOWED',
    'Akun nama@gmail.com tidak dapat digunakan. Gunakan email kampus ITK (@student.itk.ac.id, @lecture.itk.ac.id, @itk.ac.id).',
  ),
  GoogleRejected: errorResponse(
    'Identitas Google tidak dapat diverifikasi.',
    'INVALID_GOOGLE_TOKEN',
    'Akun Google Anda tidak dapat diverifikasi. Silakan masuk kembali.',
  ),
  DevLoginDisabled: errorResponse(
    'Jalur masuk cepat tidak tersedia pada server ini.',
    'DEV_LOGIN_DISABLED',
    'Cara masuk ini tidak tersedia pada server ini.',
  ),
  NotFound: errorResponse('Data tidak ditemukan.', 'NOT_FOUND', 'Data tidak ditemukan'),
  MenuNotFound: errorResponse('Menu tidak ditemukan.', 'MENU_NOT_FOUND', 'Menu tidak ditemukan'),
  OrderNotFound: errorResponse(
    'Pesanan tidak ditemukan, atau bukan milik Anda.',
    'ORDER_NOT_FOUND',
    'Pesanan tidak ditemukan',
  ),
  CartItemNotFound: errorResponse(
    'Item keranjang tidak ditemukan.',
    'CART_ITEM_NOT_FOUND',
    'Item keranjang tidak ditemukan',
  ),
  SellerNoCanteen: errorResponse(
    'Penjual belum memiliki kantin.',
    'SELLER_HAS_NO_CANTEEN',
    'Anda belum memiliki kantin. Silakan buat kantin Anda terlebih dahulu.',
  ),
  AlreadyHasCanteen: errorResponse(
    'Penjual sudah memiliki kantin.',
    'CONFLICT',
    'Anda sudah memiliki kantin. Silakan ubah data kantin yang sudah ada.',
  ),
  MenuUnavailable: errorResponse(
    'Menu sedang tidak tersedia.',
    'MENU_UNAVAILABLE',
    'Menu "Ayam Geprek" sedang tidak tersedia',
  ),
  CartConflict: {
    description: [
      'Menu berasal dari kantin yang berbeda dengan isi keranjang saat ini.',
      '',
      'Bagian `error.details` memuat kantin lama dan kantin baru, sehingga aplikasi dapat',
      'menampilkan konfirmasi. Bila pengguna setuju, kirim ulang permintaan yang sama',
      'dengan `replaceCanteen: true`.',
    ].join('\n'),
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorEnvelope' },
        example: {
          success: false,
          message:
            'Keranjang berisi menu dari Kantin FSTI. Kosongkan keranjang terlebih dahulu untuk memesan dari kantin berbeda.',
          error: {
            code: 'CART_DIFFERENT_CANTEEN',
            details: {
              currentCanteen: { id: 1, name: 'Kantin FSTI' },
              newCanteen: { id: 2, name: 'Kantin Teknik' },
            },
          },
        },
      },
    },
  },
  CheckoutFailed: {
    description: [
      'Pesanan tidak dapat dibuat. Kemungkinan penyebabnya:',
      '',
      '- `CART_EMPTY` — keranjang masih kosong.',
      '- `MENU_UNAVAILABLE` — ada menu yang sudah tidak tersedia.',
      '- `MENU_NOT_FOUND` — ada menu yang sudah dihapus penjual.',
      '- `CANTEEN_CLOSED` — kantin sedang tutup.',
      '- `CART_DIFFERENT_CANTEEN` — isi keranjang berasal dari lebih dari satu kantin.',
      '',
      'Tidak ada pesanan yang tersimpan dan isi keranjang tetap utuh.',
    ].join('\n'),
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorEnvelope' },
        example: {
          success: false,
          message: 'Menu "Es Teh" sedang tidak tersedia. Perbarui keranjang Anda.',
          error: { code: 'MENU_UNAVAILABLE' },
        },
      },
    },
  },
  OrderNotCancellable: errorResponse(
    'Pesanan sudah melewati tahap yang memungkinkan pembatalan.',
    'ORDER_NOT_CANCELLABLE',
    'Pesanan dengan status DITERIMA tidak dapat dibatalkan',
  ),
  InvalidTransition: errorResponse(
    'Perubahan status tidak mengikuti urutan yang berlaku.',
    'INVALID_ORDER_STATUS_TRANSITION',
    'Pesanan tidak dapat diubah dari MENUNGGU KONFIRMASI menjadi SIAP DIAMBIL',
  ),
  ValidationError: {
    description: 'Data yang dikirim tidak sesuai aturan.',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorEnvelope' },
        example: {
          success: false,
          message: 'Data yang dikirim tidak valid',
          error: {
            code: 'VALIDATION_ERROR',
            details: [{ field: 'quantity', message: 'Jumlah minimal 1' }],
          },
        },
      },
    },
  },
  TooManyRequests: errorResponse(
    'Permintaan terlalu sering dalam waktu singkat.',
    'RATE_LIMITED',
    'Terlalu banyak permintaan. Silakan coba beberapa saat lagi.',
  ),
  ServerError: errorResponse(
    'Terjadi kesalahan di sisi server.',
    'INTERNAL_ERROR',
    'Terjadi kesalahan pada server. Silakan coba lagi.',
  ),
};

export const openapiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Kantin ITK API',
    version: '1.0.0',
    description,
    contact: { name: 'Tim Kantin ITK' },
  },
  servers: [
    { url: `http://localhost:${config.server.port}`, description: 'Server pengembangan' },
  ],
  tags,
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: [
          'Kunci akses yang diperoleh dari `POST /api/auth/google`.',
          '',
          'Dikirim pada header `Authorization` dengan awalan `Bearer `.',
          '',
          'Kunci berlaku selama masa yang ditentukan server, dan langsung tidak berlaku',
          'setelah pengguna keluar.',
        ].join('\n'),
      },
    },
    schemas,
    responses,
  },
  paths,
};

export default openapiDocument;
