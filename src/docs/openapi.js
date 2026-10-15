import { schemas } from './schemas.js';
import { paths } from './paths.js';
import config from '../config/env.js';

/**
 * Berkas OpenAPI yang menjadi sumber tampilan dokumentasi Scalar.
 * Disajikan pada /openapi.json, dengan halaman bacanya di /docs-api.
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
  '',
  '## Sesi berakhir',
  '',
  'Tidak ada refresh token. Bila jawaban berstatus 401 dengan kode `TOKEN_EXPIRED`,',
  '`INVALID_TOKEN`, atau `UNAUTHENTICATED`, hapus kunci akses yang tersimpan lalu',
  'arahkan pengguna ke halaman masuk.',
  '',
  '## Endpoint per halaman aplikasi',
  '',
  '**Masuk**',
  '- Login Google: `POST /api/auth/google`, lalu arahkan sesuai `data.user.role`.',
  '- Akun ditolak: tampilkan `message` dari kode `EMAIL_DOMAIN_NOT_ALLOWED`.',
  '- Splash: `GET /api/auth/me` untuk memeriksa kunci akses yang tersimpan.',
  '',
  '**Pembeli**',
  '- Home: `GET /api/canteens`, `GET /api/categories`, dan menu populer',
  '  `GET /api/menu?sortBy=popular&isAvailable=true&limit=10`.',
  '- Explore, cari, dan saring: `GET /api/menu?search=...&categoryId=...`.',
  '- Detail kantin dan menunya: `GET /api/canteens/{id}/menu`.',
  '- Detail menu: `GET /api/menu/{id}`.',
  '- Favorit: `GET /api/favorites`, `POST /api/favorites`, `DELETE /api/favorites/{menuItemId}`.',
  '- Keranjang: `GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items/{id}`,',
  '  `DELETE /api/cart/items/{id}`. Ikon jumlah di AppBar memakai `data.totalQuantity`.',
  '- Checkout: `POST /api/orders`. Jawabannya selalu daftar pesanan, satu per kantin.',
  '- Pesanan aktif: `GET /api/orders?scope=active`. Riwayat: `GET /api/orders?scope=history`.',
  '- Detail dan timeline pesanan: `GET /api/orders/{id}`. Timeline disusun dari `status`, dengan',
  '  urutan menunggu_konfirmasi, diproses, siap_diambil, selesai.',
  '- Batalkan: `PATCH /api/orders/{id}/cancel`, tombol tampil bila `isCancellable` bernilai `true`.',
  '',
  '**Penjual**',
  '- Dasbor: `GET /api/seller/dashboard`.',
  '- Tab pesanan: `GET /api/seller/orders?status=menunggu_konfirmasi`, `status=diproses`,',
  '  `status=siap_diambil`, dan `scope=history` untuk yang sudah berakhir.',
  '- Tindakan pesanan: `PATCH /api/seller/orders/{id}/accept`, `/reject`, `/ready`, `/complete`.',
  '- Menu: `GET /api/seller/menu`, `POST /api/seller/menu`, `PATCH /api/seller/menu/{id}`,',
  '  `DELETE /api/seller/menu/{id}`, foto lewat `POST /api/seller/menu/{id}/photo`.',
  '- Kantin sendiri: `GET`, `POST`, `PATCH /api/seller/canteen`, foto lewat `POST /api/seller/canteen/photo`.',
  '',
  '**Kedua peran**',
  '- Profil: `GET /api/users/me`, `PATCH /api/users/me`, `GET /api/users/me/stats`,',
  '  foto lewat `POST /api/users/me/photo`.',
  '- Notifikasi: `GET /api/notifications`, `GET /api/notifications/unread-count`,',
  '  `PATCH /api/notifications/{id}/read`, `PATCH /api/notifications/read-all`.',
  '- Pesan push: daftarkan token FCM lewat `POST /api/notifications/devices` setelah masuk,',
  '  dan hapus lewat `DELETE /api/notifications/devices/{token}` saat keluar.',
  '- Keluar: `POST /api/auth/logout`.',
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
    name: 'Notifikasi',
    description:
      'Riwayat notifikasi dan pendaftaran perangkat penerima pesan push. Tersedia untuk kedua peran.',
  },
  {
    name: 'Unggahan',
    description: 'Mengunggah berkas gambar untuk foto profil, foto menu, maupun foto kantin.',
  },
  {
    name: 'Favorit',
    description: 'Menandai menu favorit milik pembeli. Penandaan bersifat idempoten.',
  },
  {
    name: 'Keranjang',
    description:
      'Mengelola isi keranjang pembeli. Keranjang boleh memuat menu dari beberapa kantin, dan saat ' +
      'pesanan dibuat isinya dipecah menjadi satu pesanan untuk tiap kantin.',
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
    'Belum masuk, atau sesi sudah tidak berlaku. Kode yang mungkin: `UNAUTHENTICATED` (tanpa kunci akses), ' +
      '`TOKEN_EXPIRED` (kunci akses kedaluwarsa), dan `INVALID_TOKEN` (kunci akses rusak atau akunnya sudah ' +
      'tidak ada). Ketiganya ditangani sama: hapus kunci akses lalu arahkan ke halaman masuk.',
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
  CanteenNotFound: errorResponse('Kantin tidak ditemukan.', 'CANTEEN_NOT_FOUND', 'Kantin tidak ditemukan'),
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
  CheckoutFailed: {
    description: [
      'Pesanan tidak dapat dibuat. Kemungkinan penyebabnya:',
      '',
      '- `CART_EMPTY` — keranjang masih kosong.',
      '- `MENU_UNAVAILABLE` — ada menu yang sudah tidak tersedia.',
      '- `MENU_NOT_FOUND` — ada menu yang sudah dihapus penjual.',
      '- `CANTEEN_CLOSED` — salah satu kantin pada keranjang sedang tutup.',
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
  PayloadTooLarge: errorResponse(
    'Berkas yang diunggah melebihi batas ukuran.',
    'PAYLOAD_TOO_LARGE',
    'Ukuran gambar melebihi batas 5 MB.',
  ),
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
