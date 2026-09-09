import { ORDER_STATUS_VALUES } from '../constants/orderStatus.js';

/**
 * Kumpulan definisi jalur OpenAPI.
 *
 * Dipisahkan dari berkas skema semata-mata agar ukuran tiap berkas wajar.
 * Keduanya digabungkan pada berkas openapi.js.
 */

const idPathParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'integer', minimum: 1 },
  description: 'Nomor identitas data yang dituju.',
};

const pageParams = [
  {
    name: 'page',
    in: 'query',
    schema: { type: 'integer', minimum: 1, default: 1 },
    description: 'Halaman yang ingin diambil.',
  },
  {
    name: 'limit',
    in: 'query',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    description: 'Jumlah data per halaman. Maksimal 100.',
  },
];

const searchParam = {
  name: 'search',
  in: 'query',
  schema: { type: 'string', maxLength: 100 },
  description: 'Kata kunci pencarian berdasarkan nama. Pencarian dilakukan di server.',
  example: 'nasi',
};

/** Menyusun satu respons berhasil yang membungkus data. */
function ok(description, dataSchema, { withMeta = false, example } = {}) {
  const properties = {
    success: { type: 'boolean', const: true },
    message: { type: 'string' },
    data: dataSchema,
  };
  if (withMeta) properties.meta = { $ref: '#/components/schemas/PaginationMeta' };

  return {
    description,
    content: {
      'application/json': {
        schema: { type: 'object', properties },
        ...(example ? { example } : {}),
      },
    },
  };
}

const listOf = (ref) => ({ type: 'array', items: { $ref: `#/components/schemas/${ref}` } });
const objectOf = (ref) => ({ $ref: `#/components/schemas/${ref}` });

const err = (ref) => ({ $ref: `#/components/responses/${ref}` });

const commonErrors = {
  401: err('Unauthorized'),
  422: err('ValidationError'),
  429: err('TooManyRequests'),
  500: err('ServerError'),
};

const buyerErrors = { ...commonErrors, 403: err('ForbiddenBuyerOnly') };
const sellerErrors = { ...commonErrors, 403: err('ForbiddenSellerOnly') };

export const paths = {
  '/api/health': {
    get: {
      tags: ['Umum'],
      summary: 'Cek status layanan',
      description:
        'Memeriksa apakah layanan sedang berjalan. Endpoint ini terbuka dan tidak memerlukan proses masuk.',
      security: [],
      responses: {
        200: ok('Layanan berjalan normal.', {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        }),
      },
    },
  },

  // === Autentikasi ==========================================================

  '/api/auth/google': {
    post: {
      tags: ['Autentikasi'],
      summary: 'Masuk dengan akun Google',
      description: [
        'Menukar identitas Google menjadi kunci akses aplikasi.',
        '',
        '**Alur singkat**',
        '1. Aplikasi Flutter menjalankan proses masuk Google dan memperoleh `idToken`.',
        '2. `idToken` dikirim ke endpoint ini.',
        '3. Server memverifikasi identitas tersebut langsung ke Google.',
        '4. Server memeriksa apakah alamat email diizinkan.',
        '5. Server menentukan peran pengguna dari data di server, lalu menerbitkan kunci akses.',
        '',
        '**Aturan email**',
        '- Pembeli wajib memakai email kampus: `@student.itk.ac.id`, `@lecture.itk.ac.id`, atau `@itk.ac.id`.',
        '- Peran penjual **tidak** ditentukan oleh domain email, melainkan dari daftar penjual yang dikelola pengelola aplikasi di sisi server.',
        '- Alamat yang terdaftar sebagai penjual dikecualikan dari aturan domain kampus.',
        '',
        'Tidak ada pendaftaran manual. Akun pembeli dibuat otomatis pada saat pertama kali masuk.',
        '',
        'Peran dan alamat email yang dikirim dari aplikasi akan diabaikan; keduanya hanya diambil dari identitas Google yang sudah diverifikasi.',
      ].join('\n'),
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['idToken'],
              additionalProperties: false,
              properties: {
                idToken: {
                  type: 'string',
                  maxLength: 4096,
                  description: 'Identitas Google yang diperoleh aplikasi setelah pengguna memilih akun.',
                },
              },
            },
            example: { idToken: 'eyJhbGciOiJSUzI1NiIsImtpZCI6...' },
          },
        },
      },
      responses: {
        200: ok('Berhasil masuk.', objectOf('Session')),
        401: err('GoogleRejected'),
        403: err('EmailNotAllowed'),
        422: err('ValidationError'),
        429: err('TooManyRequests'),
        500: err('ServerError'),
      },
    },
  },

  '/api/auth/dev-login': {
    post: {
      tags: ['Autentikasi'],
      summary: 'Masuk cepat untuk pengembangan',
      description: [
        '**Hanya tersedia saat pengembangan.**',
        '',
        'Menerbitkan kunci akses untuk akun yang sudah ada tanpa melalui Google, agar API dapat diuji sebelum konfigurasi Google siap.',
        '',
        'Endpoint ini otomatis dinonaktifkan pada lingkungan produksi dan tidak pernah membuat akun baru.',
      ].join('\n'),
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email'],
              additionalProperties: false,
              properties: { email: { type: 'string', format: 'email' } },
            },
            example: { email: 'budi.santoso@student.itk.ac.id' },
          },
        },
      },
      responses: {
        200: ok('Berhasil masuk.', objectOf('Session')),
        403: err('DevLoginDisabled'),
        404: err('NotFound'),
        422: err('ValidationError'),
      },
    },
  },

  '/api/auth/me': {
    get: {
      tags: ['Autentikasi'],
      summary: 'Lihat akun yang sedang masuk',
      description:
        'Mengambil data akun terbaru berdasarkan kunci akses. Berguna untuk memastikan kunci masih berlaku dan mengetahui peran pengguna saat aplikasi dibuka.',
      responses: { 200: ok('Data akun.', objectOf('User')), ...commonErrors },
    },
  },

  '/api/auth/logout': {
    post: {
      tags: ['Autentikasi'],
      summary: 'Keluar',
      description:
        'Mengakhiri sesi. Seluruh kunci akses yang pernah diterbitkan untuk akun ini langsung tidak berlaku, termasuk kunci di perangkat lain.',
      responses: { 200: ok('Berhasil keluar.', { type: 'null' }), ...commonErrors },
    },
  },

  // === Profil ===============================================================

  '/api/users/me': {
    get: {
      tags: ['Profil'],
      summary: 'Lihat profil',
      description: 'Menampilkan foto, nama, email, dan peran pengguna yang sedang masuk.',
      responses: { 200: ok('Data profil.', objectOf('User')), ...commonErrors },
    },
    patch: {
      tags: ['Profil'],
      summary: 'Ubah profil',
      description: [
        'Mengubah data profil yang boleh disunting pengguna.',
        '',
        'Hanya `name` dan `profileImage` yang dapat diubah.',
        'Email, peran, dan identitas kampus berasal dari akun Google serta pengaturan di server, sehingga tidak dapat diubah melalui endpoint ini.',
        'Mengirimkan field selain kedua field tersebut akan ditolak.',
      ].join('\n'),
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              additionalProperties: false,
              minProperties: 1,
              properties: {
                name: { type: 'string', minLength: 1, maxLength: 100 },
                profileImage: {
                  type: ['string', 'null'],
                  maxLength: 255,
                  description: 'Alamat gambar. Wajib diawali `http://` atau `https://`.',
                },
              },
            },
            example: { name: 'Budi Santoso' },
          },
        },
      },
      responses: { 200: ok('Profil berhasil diperbarui.', objectOf('User')), ...commonErrors },
    },
  },

  // === Kantin ===============================================================

  '/api/canteens': {
    get: {
      tags: ['Kantin'],
      summary: 'Daftar kantin',
      description:
        'Menampilkan kantin yang tersedia beserta lokasi, foto, dan status buka/tutup. Kantin yang sedang buka ditampilkan lebih dulu.',
      parameters: [
        ...pageParams,
        { ...searchParam, description: 'Kata kunci nama atau lokasi kantin.', example: 'FSTI' },
        {
          name: 'isOpen',
          in: 'query',
          schema: { type: 'string', enum: ['true', 'false'] },
          description: 'Saring hanya kantin yang buka (`true`) atau tutup (`false`).',
        },
      ],
      responses: { 200: ok('Daftar kantin.', listOf('Canteen'), { withMeta: true }), ...commonErrors },
    },
  },

  '/api/canteens/{id}': {
    get: {
      tags: ['Kantin'],
      summary: 'Detail kantin',
      description: 'Menampilkan informasi lengkap satu kantin.',
      parameters: [idPathParam],
      responses: { 200: ok('Detail kantin.', objectOf('Canteen')), 404: err('NotFound'), ...commonErrors },
    },
  },

  '/api/canteens/{id}/menu': {
    get: {
      tags: ['Kantin'],
      summary: 'Menu sebuah kantin',
      description:
        'Menampilkan menu milik satu kantin, lengkap dengan pencarian dan penyaringan kategori. Menu yang tersedia ditampilkan lebih dulu.',
      parameters: [
        idPathParam,
        ...pageParams,
        searchParam,
        {
          name: 'categoryId',
          in: 'query',
          schema: { type: 'integer', minimum: 1 },
          description: 'Saring berdasarkan kategori, misalnya Makanan atau Minuman.',
        },
        {
          name: 'isAvailable',
          in: 'query',
          schema: { type: 'string', enum: ['true', 'false'] },
          description: 'Saring hanya menu yang tersedia.',
        },
      ],
      responses: {
        200: ok(
          'Menu kantin.',
          {
            type: 'object',
            properties: {
              canteen: objectOf('Canteen'),
              menu: listOf('MenuItem'),
            },
          },
          { withMeta: true },
        ),
        404: err('NotFound'),
        ...commonErrors,
      },
    },
  },

  // === Menu =================================================================

  '/api/menu': {
    get: {
      tags: ['Menu'],
      summary: 'Cari dan saring menu',
      description: [
        'Menampilkan menu dari seluruh kantin.',
        '',
        'Pencarian dan penyaringan dikerjakan di server, sehingga aplikasi tidak perlu mengunduh seluruh menu terlebih dahulu.',
        '',
        'Contoh: `/api/menu?search=nasi&categoryId=1`',
      ].join('\n'),
      parameters: [
        ...pageParams,
        searchParam,
        {
          name: 'categoryId',
          in: 'query',
          schema: { type: 'integer', minimum: 1 },
          description: 'Saring berdasarkan kategori.',
        },
        {
          name: 'canteenId',
          in: 'query',
          schema: { type: 'integer', minimum: 1 },
          description: 'Saring berdasarkan kantin.',
        },
        {
          name: 'isAvailable',
          in: 'query',
          schema: { type: 'string', enum: ['true', 'false'] },
          description: 'Saring hanya menu yang tersedia.',
        },
      ],
      responses: { 200: ok('Daftar menu.', listOf('MenuItem'), { withMeta: true }), ...commonErrors },
    },
  },

  '/api/menu/{id}': {
    get: {
      tags: ['Menu'],
      summary: 'Detail menu',
      description: 'Menampilkan foto, nama, harga, deskripsi, kategori, dan status ketersediaan satu menu.',
      parameters: [idPathParam],
      responses: { 200: ok('Detail menu.', objectOf('MenuItem')), 404: err('MenuNotFound'), ...commonErrors },
    },
  },

  '/api/categories': {
    get: {
      tags: ['Menu'],
      summary: 'Daftar kategori',
      description: 'Menampilkan seluruh kategori yang dapat dipakai untuk menyaring menu.',
      responses: { 200: ok('Daftar kategori.', listOf('Category')), ...commonErrors },
    },
  },

  // === Keranjang ============================================================

  '/api/cart': {
    get: {
      tags: ['Keranjang'],
      summary: 'Lihat keranjang',
      description:
        'Menampilkan isi keranjang beserta total harga yang dihitung server. Keranjang dibuat otomatis saat pertama kali diakses.',
      responses: { 200: ok('Isi keranjang.', objectOf('Cart')), ...buyerErrors },
    },
    delete: {
      tags: ['Keranjang'],
      summary: 'Kosongkan keranjang',
      description: 'Menghapus seluruh isi keranjang sekaligus.',
      responses: { 200: ok('Keranjang dikosongkan.', objectOf('Cart')), ...buyerErrors },
    },
  },

  '/api/cart/items': {
    post: {
      tags: ['Keranjang'],
      summary: 'Tambah menu ke keranjang',
      description: [
        'Menambahkan satu menu ke keranjang.',
        '',
        '**Aturan penting**',
        '- Menu yang sedang tidak tersedia tidak dapat ditambahkan.',
        '- Satu keranjang hanya boleh berisi menu dari **satu kantin**.',
        '- Menambahkan menu yang sama akan menambah jumlahnya, bukan membuat baris baru.',
        '',
        '**Bila menu berasal dari kantin berbeda**',
        'Permintaan ditolak dengan kode `CART_DIFFERENT_CANTEEN`, dan bagian `error.details` berisi kantin lama serta kantin baru.',
        'Tampilkan konfirmasi kepada pengguna, lalu kirim ulang permintaan yang sama dengan `replaceCanteen: true` bila pengguna setuju mengosongkan keranjang.',
      ].join('\n'),
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['menuItemId'],
              additionalProperties: false,
              properties: {
                menuItemId: { type: 'integer', minimum: 1 },
                quantity: { type: 'integer', minimum: 1, maximum: 99, default: 1 },
                replaceCanteen: {
                  type: 'boolean',
                  default: false,
                  description: 'Bila `true`, keranjang dikosongkan lebih dulu saat menu berasal dari kantin lain.',
                },
              },
            },
            example: { menuItemId: 5, quantity: 2 },
          },
        },
      },
      responses: {
        201: ok('Menu ditambahkan ke keranjang.', objectOf('Cart')),
        404: err('MenuNotFound'),
        409: err('CartConflict'),
        ...buyerErrors,
      },
    },
  },

  '/api/cart/items/{id}': {
    patch: {
      tags: ['Keranjang'],
      summary: 'Ubah jumlah menu',
      description:
        'Mengubah jumlah salah satu item di keranjang. Gunakan `id` dari objek item keranjang, bukan `menuItemId`.',
      parameters: [{ ...idPathParam, description: 'Nomor item keranjang.' }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['quantity'],
              additionalProperties: false,
              properties: { quantity: { type: 'integer', minimum: 1, maximum: 99 } },
            },
            example: { quantity: 3 },
          },
        },
      },
      responses: {
        200: ok('Jumlah menu diperbarui.', objectOf('Cart')),
        404: err('CartItemNotFound'),
        409: err('MenuUnavailable'),
        ...buyerErrors,
      },
    },
    delete: {
      tags: ['Keranjang'],
      summary: 'Hapus menu dari keranjang',
      description: 'Menghapus satu item dari keranjang.',
      parameters: [{ ...idPathParam, description: 'Nomor item keranjang.' }],
      responses: {
        200: ok('Menu dihapus dari keranjang.', objectOf('Cart')),
        404: err('CartItemNotFound'),
        ...buyerErrors,
      },
    },
  },

  // === Pesanan (pembeli) ====================================================

  '/api/orders': {
    post: {
      tags: ['Pesanan'],
      summary: 'Buat pesanan dari keranjang',
      description: [
        'Mengubah isi keranjang menjadi pesanan.',
        '',
        '**Yang dilakukan server**',
        '1. Memastikan keranjang tidak kosong.',
        '2. Memastikan seluruh menu masih ada dan masih tersedia.',
        '3. Memastikan seluruh menu berasal dari satu kantin yang sama, dan kantin tersebut sedang buka.',
        '4. Membaca harga terbaru langsung dari data menu.',
        '5. Menghitung subtotal dan total di sisi server.',
        '6. Menyimpan salinan nama dan harga menu agar riwayat tidak berubah di kemudian hari.',
        '7. Mengosongkan keranjang.',
        '',
        'Seluruh langkah di atas dijalankan sekaligus. Bila salah satu gagal, tidak ada pesanan yang tersimpan dan isi keranjang tetap utuh.',
        '',
        'Total pesanan **tidak** diambil dari aplikasi. Mengirimkan nilai harga atau total akan ditolak.',
        '',
        'Pembayaran dilakukan langsung di kantin saat pesanan diambil.',
      ].join('\n'),
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                note: {
                  type: ['string', 'null'],
                  maxLength: 500,
                  description: 'Catatan untuk penjual, misalnya tingkat kepedasan.',
                },
              },
            },
            example: { note: 'Pedas sedikit, tanpa acar' },
          },
        },
      },
      responses: {
        201: ok('Pesanan berhasil dibuat.', objectOf('Order')),
        404: err('NotFound'),
        422: err('CheckoutFailed'),
        ...buyerErrors,
      },
    },
    get: {
      tags: ['Pesanan'],
      summary: 'Daftar pesanan saya',
      description: [
        'Menampilkan pesanan milik pengguna yang sedang masuk.',
        '',
        'Gunakan `scope` untuk memisahkan tampilan:',
        '- `active` — pesanan yang sedang berjalan.',
        '- `history` — pesanan selesai, ditolak, atau dibatalkan.',
        '- `all` — seluruhnya (bawaan).',
      ].join('\n'),
      parameters: [
        ...pageParams,
        {
          name: 'scope',
          in: 'query',
          schema: { type: 'string', enum: ['active', 'history', 'all'], default: 'all' },
          description: 'Kelompok pesanan yang ingin ditampilkan.',
        },
        {
          name: 'status',
          in: 'query',
          schema: { type: 'string', enum: ORDER_STATUS_VALUES },
          description: 'Saring berdasarkan satu status tertentu. Mengabaikan `scope`.',
        },
      ],
      responses: { 200: ok('Daftar pesanan.', listOf('Order'), { withMeta: true }), ...buyerErrors },
    },
  },

  '/api/orders/{id}': {
    get: {
      tags: ['Pesanan'],
      summary: 'Detail pesanan saya',
      description:
        'Menampilkan rincian satu pesanan beserta statusnya. Pesanan milik pengguna lain tidak dapat diakses.',
      parameters: [idPathParam],
      responses: { 200: ok('Detail pesanan.', objectOf('Order')), 404: err('OrderNotFound'), ...buyerErrors },
    },
  },

  '/api/orders/{id}/cancel': {
    patch: {
      tags: ['Pesanan'],
      summary: 'Batalkan pesanan',
      description: [
        'Membatalkan pesanan milik sendiri.',
        '',
        'Pembatalan hanya dapat dilakukan selama pesanan masih berstatus **Menunggu Konfirmasi**.',
        'Setelah penjual menerima pesanan, pembatalan tidak lagi dimungkinkan.',
        '',
        'Gunakan field `isCancellable` pada data pesanan untuk menentukan apakah tombol pembatalan perlu ditampilkan.',
      ].join('\n'),
      parameters: [idPathParam],
      responses: {
        200: ok('Pesanan berhasil dibatalkan.', objectOf('Order')),
        404: err('OrderNotFound'),
        409: err('OrderNotCancellable'),
        ...buyerErrors,
      },
    },
  },

  // === Penjual: dasbor & kantin ============================================

  '/api/seller/dashboard': {
    get: {
      tags: ['Penjual - Dasbor'],
      summary: 'Ringkasan dasbor penjual',
      description:
        'Menampilkan jumlah pesanan per status beserta sepuluh pesanan terbaru, untuk halaman utama penjual.',
      responses: {
        200: ok('Data dasbor.', objectOf('SellerDashboard')),
        404: err('SellerNoCanteen'),
        ...sellerErrors,
      },
    },
  },

  '/api/seller/canteen': {
    get: {
      tags: ['Penjual - Kantin'],
      summary: 'Lihat kantin saya',
      description: 'Menampilkan data kantin milik penjual yang sedang masuk.',
      responses: {
        200: ok('Data kantin.', objectOf('OwnedCanteen')),
        404: err('SellerNoCanteen'),
        ...sellerErrors,
      },
    },
    post: {
      tags: ['Penjual - Kantin'],
      summary: 'Buat kantin saya',
      description: [
        'Membuat kantin milik penjual yang sedang masuk.',
        '',
        'Setiap penjual hanya boleh memiliki satu kantin. Bila kantin sudah ada, gunakan pengubahan data alih-alih membuat baru.',
      ].join('\n'),
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name'],
              additionalProperties: false,
              properties: {
                name: { type: 'string', minLength: 1, maxLength: 100 },
                description: { type: ['string', 'null'], maxLength: 1000 },
                location: { type: ['string', 'null'], maxLength: 255 },
                imageUrl: { type: ['string', 'null'], maxLength: 255 },
                isOpen: { type: 'boolean', default: true },
              },
            },
            example: { name: 'Kantin FSTI', location: 'Gedung A, Lantai 1', isOpen: true },
          },
        },
      },
      responses: {
        201: ok('Kantin berhasil dibuat.', objectOf('OwnedCanteen')),
        409: err('AlreadyHasCanteen'),
        ...sellerErrors,
      },
    },
    patch: {
      tags: ['Penjual - Kantin'],
      summary: 'Ubah kantin saya',
      description:
        'Mengubah data kantin sendiri, termasuk membuka atau menutup kantin melalui field `isOpen`. Saat kantin tutup, pembeli tidak dapat membuat pesanan baru ke kantin tersebut.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              additionalProperties: false,
              minProperties: 1,
              properties: {
                name: { type: 'string', minLength: 1, maxLength: 100 },
                description: { type: ['string', 'null'], maxLength: 1000 },
                location: { type: ['string', 'null'], maxLength: 255 },
                imageUrl: { type: ['string', 'null'], maxLength: 255 },
                isOpen: { type: 'boolean' },
              },
            },
            example: { isOpen: false },
          },
        },
      },
      responses: {
        200: ok('Kantin berhasil diperbarui.', objectOf('OwnedCanteen')),
        404: err('SellerNoCanteen'),
        ...sellerErrors,
      },
    },
  },

  // === Penjual: menu ========================================================

  '/api/seller/menu': {
    get: {
      tags: ['Penjual - Menu'],
      summary: 'Daftar menu saya',
      description: 'Menampilkan seluruh menu milik kantin sendiri. Menu kantin lain tidak akan pernah muncul di sini.',
      parameters: [
        ...pageParams,
        searchParam,
        { name: 'categoryId', in: 'query', schema: { type: 'integer', minimum: 1 }, description: 'Saring berdasarkan kategori.' },
        {
          name: 'isAvailable',
          in: 'query',
          schema: { type: 'string', enum: ['true', 'false'] },
          description: 'Saring berdasarkan ketersediaan.',
        },
      ],
      responses: {
        200: ok(
          'Daftar menu.',
          { type: 'object', properties: { canteen: objectOf('OwnedCanteen'), menu: listOf('MenuItem') } },
          { withMeta: true },
        ),
        404: err('SellerNoCanteen'),
        ...sellerErrors,
      },
    },
    post: {
      tags: ['Penjual - Menu'],
      summary: 'Tambah menu',
      description: [
        'Menambahkan menu baru ke kantin sendiri.',
        '',
        'Kantin tujuan diambil otomatis dari akun penjual yang sedang masuk, sehingga menu tidak dapat dimasukkan ke kantin milik orang lain.',
      ].join('\n'),
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'price'],
              additionalProperties: false,
              properties: {
                name: { type: 'string', minLength: 1, maxLength: 150 },
                description: { type: ['string', 'null'], maxLength: 1000 },
                price: { type: 'number', minimum: 0, description: 'Harga satuan dalam rupiah.' },
                categoryId: { type: ['integer', 'null'], minimum: 1 },
                imageUrl: { type: ['string', 'null'], maxLength: 255 },
                isAvailable: { type: 'boolean', default: true },
              },
            },
            example: {
              name: 'Nasi Goreng',
              description: 'Nasi goreng spesial dengan telur dan acar',
              price: 15000,
              categoryId: 1,
              isAvailable: true,
            },
          },
        },
      },
      responses: {
        201: ok('Menu berhasil ditambahkan.', objectOf('MenuItem')),
        404: err('SellerNoCanteen'),
        ...sellerErrors,
      },
    },
  },

  '/api/seller/menu/{id}': {
    get: {
      tags: ['Penjual - Menu'],
      summary: 'Detail menu saya',
      description: 'Menampilkan satu menu milik kantin sendiri.',
      parameters: [idPathParam],
      responses: { 200: ok('Detail menu.', objectOf('MenuItem')), 404: err('MenuNotFound'), ...sellerErrors },
    },
    patch: {
      tags: ['Penjual - Menu'],
      summary: 'Ubah menu',
      description: [
        'Mengubah menu milik kantin sendiri. Kirim hanya field yang ingin diubah.',
        '',
        'Ketersediaan menu diatur melalui field `isAvailable` di sini, bukan endpoint terpisah.',
        '',
        'Mengubah harga **tidak** memengaruhi pesanan yang sudah dibuat sebelumnya.',
        '',
        'Menu milik penjual lain tidak dapat diubah, sekalipun nomornya diketahui.',
      ].join('\n'),
      parameters: [idPathParam],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              additionalProperties: false,
              minProperties: 1,
              properties: {
                name: { type: 'string', minLength: 1, maxLength: 150 },
                description: { type: ['string', 'null'], maxLength: 1000 },
                price: { type: 'number', minimum: 0 },
                categoryId: { type: ['integer', 'null'], minimum: 1 },
                imageUrl: { type: ['string', 'null'], maxLength: 255 },
                isAvailable: { type: 'boolean' },
              },
            },
            example: { price: 17000, isAvailable: false },
          },
        },
      },
      responses: { 200: ok('Menu berhasil diperbarui.', objectOf('MenuItem')), 404: err('MenuNotFound'), ...sellerErrors },
    },
    delete: {
      tags: ['Penjual - Menu'],
      summary: 'Hapus menu',
      description: [
        'Menghapus menu dari kantin sendiri.',
        '',
        'Menu langsung hilang dari daftar untuk pembeli dan otomatis dikeluarkan dari keranjang yang masih memuatnya.',
        '',
        'Riwayat pesanan yang pernah memuat menu ini tetap utuh, lengkap dengan nama dan harga saat pesanan dibuat.',
      ].join('\n'),
      parameters: [idPathParam],
      responses: {
        200: ok('Menu berhasil dihapus.', objectOf('DeletedMenuResult')),
        404: err('MenuNotFound'),
        ...sellerErrors,
      },
    },
  },

  // === Penjual: pesanan =====================================================

  '/api/seller/orders': {
    get: {
      tags: ['Penjual - Pesanan'],
      summary: 'Daftar pesanan masuk',
      description:
        'Menampilkan pesanan yang masuk ke kantin sendiri, terbaru lebih dulu, lengkap dengan identitas pemesan dan rincian item.',
      parameters: [
        ...pageParams,
        {
          name: 'scope',
          in: 'query',
          schema: { type: 'string', enum: ['active', 'history', 'all'], default: 'all' },
          description: 'Gunakan `active` untuk menampilkan pesanan yang masih berjalan.',
        },
        {
          name: 'status',
          in: 'query',
          schema: { type: 'string', enum: ORDER_STATUS_VALUES },
          description: 'Saring berdasarkan satu status tertentu.',
        },
      ],
      responses: { 200: ok('Daftar pesanan masuk.', listOf('SellerOrder'), { withMeta: true }), ...sellerErrors },
    },
  },

  '/api/seller/orders/{id}': {
    get: {
      tags: ['Penjual - Pesanan'],
      summary: 'Detail pesanan masuk',
      description: 'Menampilkan rincian satu pesanan yang masuk ke kantin sendiri.',
      parameters: [idPathParam],
      responses: { 200: ok('Detail pesanan.', objectOf('SellerOrder')), 404: err('OrderNotFound'), ...sellerErrors },
    },
  },
};

/**
 * Kelima tindakan penjual memiliki bentuk yang sama persis, sehingga jalurnya
 * disusun secara berulang alih-alih ditulis satu per satu.
 */
const SELLER_ACTIONS = [
  {
    path: 'accept',
    summary: 'Terima pesanan',
    from: 'Menunggu Konfirmasi',
    to: 'Diterima',
    detail: 'Menyatakan pesanan diterima dan akan disiapkan.',
  },
  {
    path: 'reject',
    summary: 'Tolak pesanan',
    from: 'Menunggu Konfirmasi',
    to: 'Ditolak',
    detail:
      'Menolak pesanan, misalnya karena stok habis atau kantin akan tutup. Alasan bersifat opsional dan akan ditampilkan kepada pembeli.',
    hasBody: true,
  },
  {
    path: 'process',
    summary: 'Proses pesanan',
    from: 'Diterima',
    to: 'Diproses',
    detail: 'Menandakan makanan mulai disiapkan.',
  },
  {
    path: 'ready',
    summary: 'Tandai siap diambil',
    from: 'Diproses',
    to: 'Siap Diambil',
    detail: 'Memberi tahu pembeli bahwa pesanan sudah dapat diambil di kantin.',
  },
  {
    path: 'complete',
    summary: 'Selesaikan pesanan',
    from: 'Siap Diambil',
    to: 'Selesai',
    detail: [
      'Menutup pesanan setelah pembeli mengambil pesanan dan membayar langsung di kantin.',
      '',
      'Sistem tidak mencatat data pembayaran apa pun, karena pembayaran terjadi di luar aplikasi.',
    ].join('\n'),
  },
];

for (const action of SELLER_ACTIONS) {
  paths[`/api/seller/orders/{id}/${action.path}`] = {
    patch: {
      tags: ['Penjual - Pesanan'],
      summary: action.summary,
      description: [
        action.detail,
        '',
        `**Perubahan status:** ${action.from} → ${action.to}`,
        '',
        'Perubahan status hanya dapat dilakukan mengikuti urutan yang berlaku. Melompati tahap atau mundur ke tahap sebelumnya akan ditolak dengan kode `INVALID_ORDER_STATUS_TRANSITION`.',
        '',
        'Pesanan milik kantin lain tidak dapat diubah, sekalipun nomornya diketahui.',
      ].join('\n'),
      parameters: [idPathParam],
      ...(action.hasBody
        ? {
            requestBody: {
              required: false,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      reason: {
                        type: ['string', 'null'],
                        maxLength: 255,
                        description: 'Alasan penolakan yang akan dilihat pembeli.',
                      },
                    },
                  },
                  example: { reason: 'Stok habis' },
                },
              },
            },
          }
        : {}),
      responses: {
        200: ok(`Pesanan berhasil diubah menjadi ${action.to}.`, objectOf('SellerOrder')),
        404: err('OrderNotFound'),
        409: err('InvalidTransition'),
        ...sellerErrors,
      },
    },
  };
}

export default paths;
