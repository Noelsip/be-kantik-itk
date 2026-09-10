import { ORDER_STATUS_VALUES } from '../constants/orderStatus.js';

/**
 * Kumpulan definisi jalur OpenAPI.
 * Dipisahkan dari berkas skema agar ukuran tiap berkas wajar.
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

  // Jalur proses masuk dan keluar.

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
        '**Asal akun pembeli**',
        '- `<NIM>@student.itk.ac.id` mengisi `faculty` dan `studyProgram` dari dua digit awal NIM.',
        '- `@lecture.itk.ac.id` mengisi `affiliation` menjadi `Dosen ITK`, tanpa program studi.',
        '- `@itk.ac.id` mengisi `affiliation` menjadi `Email Umum ITK`, tanpa program studi.',
        '- Kedua domain terakhir hanya berlaku bila bagian depan alamat bukan angka, karena NIM hanya sah pada domain mahasiswa.',
        '- Nilai ini diselaraskan ulang pada setiap kali masuk dan tidak dapat diisi dari aplikasi.',
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

  // Jalur profil pengguna.

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
                whatsapp: {
                  type: ['string', 'null'],
                  example: '081234567890',
                  description:
                    'Nomor WhatsApp. Penulisan 08xx, 8xx, 62xx, maupun +62xx diterima dan ' +
                    'dibakukan server menjadi bentuk berawalan 62. Kirim `null` untuk mengosongkan.',
                },
              },
            },
            example: { name: 'Budi Santoso' },
          },
        },
      },
      responses: { 200: ok('Profil berhasil diperbarui.', objectOf('User')), ...commonErrors },
    },
    put: {
      tags: ['Profil'],
      summary: 'Ubah profil (bentuk lain)',
      description:
        'Berperilaku persis sama dengan PATCH pada alamat ini, disediakan karena kedua metode ' +
        'sama-sama lazim dipakai aplikasi untuk menyunting profil.',
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
                whatsapp: {
                  type: ['string', 'null'],
                  example: '081234567890',
                  description:
                    'Nomor WhatsApp. Penulisan 08xx, 8xx, 62xx, maupun +62xx diterima dan ' +
                    'dibakukan server menjadi bentuk berawalan 62. Kirim `null` untuk mengosongkan.',
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

  // Jalur notifikasi dan perangkat penerimanya.

  '/api/notifications': {
    get: {
      tags: ['Notifikasi'],
      summary: 'Daftar notifikasi',
      description: [
        'Menampilkan riwayat notifikasi milik pengguna yang sedang masuk, terbaru lebih dahulu.',
        '',
        'Jumlah yang belum dibaca ikut dikirim pada `meta.unreadCount`, sehingga lencana pada aplikasi dapat langsung diperbarui tanpa panggilan tambahan.',
      ].join('\n'),
      parameters: [
        ...pageParams,
        {
          name: 'unreadOnly',
          in: 'query',
          schema: { type: 'string', enum: ['true', 'false'] },
          description: 'Bila `true`, hanya notifikasi yang belum dibaca yang ditampilkan.',
        },
      ],
      responses: {
        200: ok('Daftar notifikasi.', listOf('Notification'), { withMeta: true }),
        ...commonErrors,
      },
    },
  },

  '/api/notifications/unread-count': {
    get: {
      tags: ['Notifikasi'],
      summary: 'Jumlah notifikasi belum dibaca',
      description:
        'Jawaban yang sangat ringan, cocok dipanggil berkala saat aplikasi terbuka untuk menyegarkan lencana notifikasi.',
      responses: {
        200: ok('Jumlah notifikasi belum dibaca.', {
          type: 'object',
          properties: { unreadCount: { type: 'integer', example: 3 } },
        }),
        ...commonErrors,
      },
    },
  },

  '/api/notifications/read-all': {
    patch: {
      tags: ['Notifikasi'],
      summary: 'Tandai seluruh notifikasi sudah dibaca',
      responses: {
        200: ok('Seluruh notifikasi ditandai sudah dibaca.', {
          type: 'object',
          properties: {
            markedCount: { type: 'integer', example: 5 },
            unreadCount: { type: 'integer', example: 0 },
          },
        }),
        ...commonErrors,
      },
    },
  },

  '/api/notifications/{id}/read': {
    patch: {
      tags: ['Notifikasi'],
      summary: 'Tandai satu notifikasi sudah dibaca',
      parameters: [idPathParam],
      responses: {
        200: ok('Notifikasi ditandai sudah dibaca.', objectOf('Notification')),
        404: err('NotFound'),
        ...commonErrors,
      },
    },
  },

  '/api/notifications/devices': {
    post: {
      tags: ['Notifikasi'],
      summary: 'Daftarkan perangkat penerima pesan push',
      description: [
        'Menyimpan token perangkat dari Firebase Cloud Messaging agar akun ini dapat menerima pesan push.',
        '',
        '**Kapan dipanggil**',
        '- Sesudah pengguna berhasil masuk dan izin notifikasi diberikan.',
        '- Setiap kali Firebase memperbarui token perangkat.',
        '',
        'Satu token hanya dimiliki satu akun. Bila perangkat yang sama dipakai akun lain, tokennya otomatis berpindah sehingga pesan tidak salah alamat.',
        '',
        'Mendaftarkan token yang sama berulang kali tidak dianggap kesalahan.',
      ].join('\n'),
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['token'],
              additionalProperties: false,
              properties: {
                token: { type: 'string', maxLength: 255, description: 'Token perangkat dari Firebase.' },
                platform: {
                  type: 'string',
                  enum: ['android', 'ios', 'web'],
                  default: 'android',
                },
              },
            },
            example: { token: 'fcm-token-perangkat', platform: 'android' },
          },
        },
      },
      responses: {
        201: ok('Perangkat didaftarkan.', {
          type: 'object',
          properties: { registered: { type: 'boolean', const: true } },
        }),
        ...commonErrors,
      },
    },
  },

  '/api/notifications/devices/{token}': {
    delete: {
      tags: ['Notifikasi'],
      summary: 'Cabut pendaftaran perangkat',
      description:
        'Menghentikan pengiriman pesan push ke perangkat tersebut. Panggil sebelum pengguna keluar, agar pemilik berikutnya tidak menerima notifikasi milik akun sebelumnya.',
      parameters: [
        {
          name: 'token',
          in: 'path',
          required: true,
          schema: { type: 'string', maxLength: 255 },
          description: 'Token perangkat yang hendak dicabut.',
        },
      ],
      responses: {
        200: ok('Perangkat dicabut.', {
          type: 'object',
          properties: { unregistered: { type: 'boolean', const: true } },
        }),
        404: err('NotFound'),
        ...commonErrors,
      },
    },
  },

  // Jalur unggah berkas gambar.

  '/api/uploads': {
    post: {
      tags: ['Unggahan'],
      summary: 'Unggah gambar',
      description: [
        'Mengunggah satu berkas gambar dan mengembalikan alamatnya.',
        '',
        'Permintaan dikirim sebagai `multipart/form-data` dengan nama field `file`.',
        '',
        'Alamat pada `data.url` dapat langsung dipasang ke field `imageUrl` saat menambah atau mengubah menu maupun kantin.',
        '',
        '**Batasan**',
        '- Jenis berkas: JPG, PNG, atau WebP.',
        '- Ukuran maksimal 5 MB; berkas yang lebih besar ditolak dengan kode 413.',
        '- Satu berkas untuk tiap permintaan.',
      ].join('\n'),
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['file'],
              properties: {
                file: {
                  type: 'string',
                  format: 'binary',
                  description: 'Berkas gambar JPG, PNG, atau WebP, maksimal 5 MB.',
                },
              },
            },
          },
        },
      },
      responses: {
        201: ok('Gambar berhasil diunggah.', {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              example: 'https://api-kantinitk.noelsipayung.me/uploads/m1a2b3-9f8e7d.jpg',
            },
            fileName: { type: 'string', example: 'm1a2b3-9f8e7d.jpg' },
            mimeType: { type: 'string', example: 'image/jpeg' },
            size: { type: 'integer', example: 204800, description: 'Ukuran berkas dalam byte.' },
          },
        }),
        413: err('PayloadTooLarge'),
        ...commonErrors,
      },
    },
  },

  '/api/users/me/stats': {
    get: {
      tags: ['Profil'],
      summary: 'Ringkasan angka profil',
      description: [
        'Menampilkan jumlah pesanan beserta rinciannya untuk halaman profil.',
        '',
        'Angka dihitung langsung dengan COUNT di database, sehingga aplikasi tidak perlu mengunduh seluruh pesanan hanya untuk menampilkan beberapa angka.',
        '',
        'Isinya menyesuaikan peran: pembeli memperoleh `favoriteCount`, penjual memperoleh `menuCount`.',
      ].join('\n'),
      responses: { 200: ok('Ringkasan profil.', objectOf('ProfileStats')), ...commonErrors },
    },
  },

  '/api/users/me/photo': {
    post: {
      tags: ['Profil'],
      summary: 'Unggah foto profil',
      description:
        'Mengunggah berkas gambar sekaligus memasangnya sebagai foto profil, sehingga aplikasi tidak perlu memanggil dua endpoint. ' +
        'Batasan jenis dan ukuran berkasnya sama dengan `/api/uploads`.',
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['file'],
              properties: {
                file: {
                  type: 'string',
                  format: 'binary',
                  description: 'Berkas gambar JPG, PNG, atau WebP, maksimal 5 MB.',
                },
              },
            },
          },
        },
      },
      responses: {
        200: ok('Foto profil berhasil diperbarui.', objectOf('User')),
        413: err('PayloadTooLarge'),
        ...commonErrors,
      },
    },
  },

  // Jalur katalog kantin.

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
        {
          name: 'sortBy',
          in: 'query',
          schema: { type: 'string', enum: ['name', 'menuCount', 'createdAt'] },
          description: 'Dasar pengurutan. Kantin yang buka tetap didahulukan.',
        },
        {
          name: 'sortOrder',
          in: 'query',
          schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
          description: 'Arah pengurutan.',
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
        {
          name: 'sortBy',
          in: 'query',
          schema: { type: 'string', enum: ['name', 'price', 'createdAt'] },
          description: 'Dasar pengurutan. Menu yang tersedia tetap didahulukan.',
        },
        {
          name: 'sortOrder',
          in: 'query',
          schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
          description: 'Arah pengurutan.',
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

  // Jalur katalog menu.

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
        {
          name: 'sortBy',
          in: 'query',
          schema: { type: 'string', enum: ['name', 'price', 'createdAt'] },
          description: 'Dasar pengurutan. Menu yang tersedia tetap didahulukan.',
        },
        {
          name: 'sortOrder',
          in: 'query',
          schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
          description: 'Arah pengurutan.',
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
    post: {
      tags: ['Kantin'],
      summary: 'Buat kategori menu',
      description: [
        'Menambah kategori menu. Hanya penjual yang dapat memanggilnya.',
        '',
        'Sistem ini tidak memiliki peran admin, sehingga penambahan kategori dipercayakan kepada penjual yang membutuhkannya saat menyusun menu.',
        '',
        '**Nama yang sudah ada dipakai kembali**',
        'Pencocokan mengabaikan besar kecil huruf, sehingga `makanan` akan memakai kategori `Makanan` yang sudah ada alih-alih membuat kategori kedua.',
        'Kategori yang baru dibuat dijawab `201`, sedangkan yang dipakai kembali dijawab `200`.',
      ].join('\n'),
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name'],
              additionalProperties: false,
              properties: { name: { type: 'string', minLength: 1, maxLength: 100 } },
            },
            example: { name: 'Gorengan' },
          },
        },
      },
      responses: {
        200: ok('Kategori sudah ada dan dipakai kembali.', objectOf('Category')),
        201: ok('Kategori dibuat.', objectOf('Category')),
        ...sellerErrors,
      },
    },
    get: {
      tags: ['Menu'],
      summary: 'Daftar kategori',
      description: 'Menampilkan seluruh kategori yang dapat dipakai untuk menyaring menu.',
      responses: { 200: ok('Daftar kategori.', listOf('Category')), ...commonErrors },
    },
  },

  // Jalur menu favorit milik pembeli.

  '/api/favorites': {
    get: {
      tags: ['Favorit'],
      summary: 'Daftar menu favorit',
      description:
        'Menampilkan menu yang ditandai favorit oleh pembeli yang sedang masuk, terbaru lebih dahulu. ' +
        'Menu yang sudah dihapus penjual tidak ikut ditampilkan.',
      parameters: [...pageParams],
      responses: { 200: ok('Daftar menu favorit.', listOf('MenuItem'), { withMeta: true }), ...buyerErrors },
    },
    post: {
      tags: ['Favorit'],
      summary: 'Tandai menu sebagai favorit',
      description: [
        'Menandai sebuah menu sebagai favorit.',
        '',
        'Penandaan bersifat idempoten: menandai menu yang sama berulang kali tetap menghasilkan satu baris favorit dan tidak dianggap kesalahan.',
        '',
        'Menu yang sedang tidak tersedia tetap boleh ditandai, karena favorit bukan penambahan ke keranjang.',
      ].join('\n'),
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['menuItemId'],
              properties: { menuItemId: { type: 'integer', minimum: 1, example: 5 } },
            },
          },
        },
      },
      responses: {
        201: ok('Menu ditambahkan ke favorit.', objectOf('MenuItem')),
        404: err('MenuNotFound'),
        ...buyerErrors,
      },
    },
  },

  '/api/favorites/{menuItemId}': {
    delete: {
      tags: ['Favorit'],
      summary: 'Batalkan favorit sebuah menu',
      description:
        'Mengeluarkan menu dari daftar favorit. Menu yang memang belum ditandai tetap menghasilkan jawaban berhasil, ' +
        'sehingga tombol favorit pada aplikasi aman ditekan berulang.',
      parameters: [
        {
          name: 'menuItemId',
          in: 'path',
          required: true,
          schema: { type: 'integer', minimum: 1 },
          description: 'Id menu yang dibatalkan favoritnya.',
        },
      ],
      responses: {
        200: ok('Menu dikeluarkan dari favorit.', objectOf('MenuItem')),
        404: err('MenuNotFound'),
        ...buyerErrors,
      },
    },
  },

  // Jalur keranjang belanja.

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
        '- Keranjang boleh memuat menu dari beberapa kantin sekaligus.',
        '- Menambahkan menu yang sama akan menambah jumlahnya, bukan membuat baris baru.',
        '',
        'Isi keranjang dikelompokkan per kantin pada field `canteens`, dan pemisahannya menjadi beberapa pesanan dikerjakan saat pesanan dibuat.',
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
                note: {
                  type: ['string', 'null'],
                  maxLength: 255,
                  example: 'Pedas sedikit',
                  description:
                    'Catatan khusus untuk menu ini. Menambahkan menu yang sama disertai catatan baru akan menimpa catatan sebelumnya.',
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
        ...buyerErrors,
      },
    },
  },

  '/api/cart/items/{id}': {
    patch: {
      tags: ['Keranjang'],
      summary: 'Ubah jumlah atau catatan menu',
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
              properties: {
                quantity: { type: 'integer', minimum: 1, maximum: 99 },
                note: { type: ['string', 'null'], maxLength: 255, example: 'Tanpa sambal' },
              },
              minProperties: 1,
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

  // Jalur pesanan dari sisi pembeli.

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
        '3. Mengelompokkan isi keranjang menurut kantin asalnya.',
        '4. Memastikan setiap kantin tersebut sedang buka.',
        '5. Membaca harga terbaru langsung dari data menu.',
        '6. Menghitung subtotal dan total di sisi server, terpisah untuk tiap kantin.',
        '7. Menyimpan salinan nama dan harga menu agar riwayat tidak berubah di kemudian hari.',
        '8. Mengosongkan keranjang.',
        '',
        '**Bentuk jawaban**',
        'Keranjang boleh memuat menu dari beberapa kantin, dan tiap kantin menjadi satu pesanan tersendiri dengan nomor pesanannya masing-masing.',
        'Karena itu `data` **selalu berupa daftar**, walau isinya hanya satu pesanan. Catatan pada `note` disalin ke seluruh pesanan yang terbentuk.',
        '',
        'Seluruh langkah di atas dijalankan sekaligus. Bila salah satu gagal, misalnya ada satu kantin yang sedang tutup, tidak ada satu pun pesanan yang tersimpan dan isi keranjang tetap utuh.',
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
        201: ok('Pesanan berhasil dibuat, satu untuk tiap kantin.', listOf('Order')),
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

  // Jalur dasbor dan kantin milik penjual.

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
                whatsapp: {
                  type: ['string', 'null'],
                  example: '081234567890',
                  description: 'Nomor WhatsApp kantin, dibakukan server menjadi bentuk berawalan 62.',
                },
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
                whatsapp: {
                  type: ['string', 'null'],
                  example: '081234567890',
                  description: 'Nomor WhatsApp kantin, dibakukan server menjadi bentuk berawalan 62.',
                },
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

  // Jalur pengelolaan menu oleh penjual.

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

  // Jalur pengelolaan pesanan oleh penjual.

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
    to: 'Sedang Disiapkan',
    detail:
      'Menyatakan pesanan diterima. Status langsung berpindah ke `diproses`, sehingga pembeli ' +
      'segera melihat pesanannya sedang disiapkan tanpa menunggu tindakan penjual berikutnya.',
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
    summary: 'Proses pesanan (pesanan lama)',
    from: 'Diterima',
    to: 'Sedang Disiapkan',
    detail:
      'Hanya berlaku bagi pesanan lama yang masih berstatus `diterima`. Alur baru tidak lagi ' +
      'melewati status tersebut karena penerimaan pesanan sudah langsung menuju `diproses`.',
  },
  {
    path: 'ready',
    summary: 'Tandai siap diambil',
    from: 'Sedang Disiapkan',
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
