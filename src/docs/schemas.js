import { ORDER_STATUS_VALUES, ORDER_STATUS_LABELS } from '../constants/orderStatus.js';
import { ROLE_VALUES } from '../constants/roles.js';
import ERROR_CODES from '../constants/errorCodes.js';

/**
 * Kumpulan skema komponen OpenAPI.
 * Daftar nilai tetap diambil dari konstanta yang dipakai aplikasi, sehingga
 * dokumentasi tidak menyimpang dari perilakunya.
 */

export const schemas = {
  // Bentuk amplop respons.

  SuccessEnvelope: {
    type: 'object',
    description:
      'Bentuk baku semua respons yang berhasil. Aplikasi Flutter dapat memakai satu model untuk seluruh endpoint.',
    required: ['success', 'message', 'data'],
    properties: {
      success: { type: 'boolean', const: true, description: 'Selalu `true` bila permintaan berhasil.' },
      message: {
        type: 'string',
        description: 'Pesan singkat berbahasa Indonesia yang aman untuk ditampilkan langsung kepada pengguna.',
        example: 'Pesanan berhasil dibuat',
      },
      data: { description: 'Isi data. Bentuknya berbeda-beda per endpoint, bisa objek, array, atau `null`.' },
      meta: {
        allOf: [{ $ref: '#/components/schemas/PaginationMeta' }],
        description: 'Hanya muncul pada endpoint daftar yang menggunakan halaman.',
      },
    },
  },

  ErrorEnvelope: {
    type: 'object',
    description: [
      'Bentuk baku semua respons gagal.',
      '',
      '`message` ditulis dalam bahasa Indonesia yang ramah pengguna dan boleh ditampilkan apa adanya.',
      'Untuk percabangan logika di aplikasi, gunakan `error.code`, bukan teks `message`,',
      'karena teks dapat berubah sewaktu-waktu tanpa pemberitahuan.',
    ].join('\n'),
    required: ['success', 'message', 'error'],
    properties: {
      success: { type: 'boolean', const: false },
      message: {
        type: 'string',
        description: 'Penjelasan yang aman ditampilkan kepada pengguna.',
        example: 'Menu "Ayam Geprek" sedang tidak tersedia',
      },
      error: {
        type: 'object',
        required: ['code'],
        properties: {
          code: {
            type: 'string',
            enum: Object.values(ERROR_CODES),
            description: 'Kode tetap yang bisa dipakai aplikasi untuk menentukan tindakan lanjutan.',
            example: 'MENU_UNAVAILABLE',
          },
          details: {
            description:
              'Rincian tambahan bila ada. Pada kesalahan validasi berisi daftar field yang bermasalah.',
            oneOf: [
              { type: 'array', items: { $ref: '#/components/schemas/ValidationIssue' } },
              { type: 'object', additionalProperties: true },
            ],
          },
        },
      },
    },
  },

  ValidationIssue: {
    type: 'object',
    description: 'Satu field yang gagal divalidasi.',
    properties: {
      field: { type: 'string', example: 'quantity', description: 'Nama field yang bermasalah.' },
      message: { type: 'string', example: 'Jumlah minimal 1', description: 'Penjelasan untuk pengguna.' },
    },
  },

  PaginationMeta: {
    type: 'object',
    description: 'Informasi halaman untuk daftar yang panjang.',
    properties: {
      page: { type: 'integer', example: 1, description: 'Halaman yang sedang ditampilkan.' },
      limit: { type: 'integer', example: 20, description: 'Jumlah data per halaman.' },
      total: { type: 'integer', example: 42, description: 'Total data yang cocok dengan filter.' },
      totalPages: { type: 'integer', example: 3 },
      hasNextPage: { type: 'boolean', example: true },
      hasPrevPage: { type: 'boolean', example: false },
    },
  },

  // Skema akun pengguna.

  User: {
    type: 'object',
    description: 'Data akun pengguna. Email dan role berasal dari sistem dan tidak dapat diubah pengguna.',
    properties: {
      id: { type: 'integer', example: 12 },
      campusId: {
        type: 'string',
        example: '10231076',
        description:
          'Identitas kampus (NIM/NIP). Diturunkan otomatis dari bagian depan alamat email saat akun pertama kali dibuat.',
      },
      nim: {
        type: ['string', 'null'],
        example: '11231001',
        description:
          'NIM mahasiswa, diambil dari bagian depan alamat email ketika seluruhnya angka dan ' +
          'domainnya @student.itk.ac.id. Bernilai null untuk dosen maupun akun umum kampus.',
      },
      name: { type: 'string', example: 'Budi Santoso' },
      email: { type: 'string', format: 'email', example: 'budi@student.itk.ac.id' },
      role: {
        type: 'string',
        enum: ROLE_VALUES,
        example: 'pembeli',
        description: 'Peran pengguna. Hanya ada dua: `pembeli` dan `penjual`.',
      },
      roleLabel: { type: 'string', example: 'Pembeli', description: 'Nama peran yang siap ditampilkan.' },
      profileImage: { type: ['string', 'null'], example: 'https://lh3.googleusercontent.com/a/foto.jpg' },
      whatsapp: {
        type: ['string', 'null'],
        example: '6281234567890',
        description:
          'Nomor WhatsApp dalam bentuk baku berawalan 62 tanpa tanda tambah, siap dipakai pada ' +
          'tautan wa.me. Penulisan 08xx, 8xx, 62xx, maupun +62xx diterima saat menyimpan dan ' +
          'dibakukan oleh server.',
      },
      affiliation: {
        type: ['string', 'null'],
        example: 'Fakultas Sains dan Teknologi Informasi',
        description:
          'Asal pengguna yang siap ditampilkan. Berisi nama fakultas untuk alamat NIM ' +
          'di @student.itk.ac.id, `Dosen ITK` untuk @lecture.itk.ac.id, dan `Email Umum ITK` ' +
          'untuk @itk.ac.id. Dua domain terakhir hanya berlaku bila bagian depan alamat ' +
          'bukan angka, karena NIM hanya sah pada domain mahasiswa.',
      },
      faculty: {
        type: ['string', 'null'],
        example: 'Fakultas Sains dan Teknologi Informasi',
        description: 'Nama fakultas. Hanya terisi untuk mahasiswa.',
      },
      studyProgram: {
        type: ['string', 'null'],
        example: 'Informatika',
        description: 'Nama program studi. Hanya terisi untuk mahasiswa.',
      },
      studyProgramCode: {
        type: ['string', 'null'],
        example: '11',
        description:
          'Dua digit awal NIM yang menentukan program studi. Hanya dibaca ketika bagian ' +
          'depan alamat seluruhnya angka dan domainnya tepat @student.itk.ac.id.',
      },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  Session: {
    type: 'object',
    description: 'Hasil masuk. Simpan `accessToken` dan sertakan pada setiap permintaan berikutnya.',
    properties: {
      user: { $ref: '#/components/schemas/User' },
      accessToken: {
        type: 'string',
        description: 'Kunci akses. Kirim pada header `Authorization` dengan awalan `Bearer `.',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      },
      tokenType: { type: 'string', example: 'Bearer' },
      expiresIn: { type: 'string', example: '7d', description: 'Masa berlaku kunci akses.' },
    },
  },

  // Skema kantin dan menu.

  Canteen: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      name: { type: 'string', example: 'Kantin FSTI' },
      description: { type: ['string', 'null'], example: 'Kantin Fakultas Sains dan Teknologi Informasi' },
      location: { type: ['string', 'null'], example: 'Gedung A, Lantai 1' },
      imageUrl: { type: ['string', 'null'] },
      whatsapp: {
        type: ['string', 'null'],
        example: '6281211112222',
        description: 'Nomor WhatsApp kantin dalam bentuk baku berawalan 62, siap dipakai pada tautan wa.me.',
      },
      isOpen: { type: 'boolean', example: true, description: 'Kantin sedang buka atau tutup.' },
      statusLabel: { type: 'string', enum: ['Buka', 'Tutup'], example: 'Buka' },
      menuCount: { type: 'integer', example: 8, description: 'Jumlah menu aktif. Hanya ada pada endpoint daftar kantin.' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  OwnedCanteen: {
    allOf: [
      { $ref: '#/components/schemas/Canteen' },
      {
        type: 'object',
        properties: { ownerId: { type: 'integer', example: 3, description: 'Pemilik kantin.' } },
      },
    ],
    description: 'Kantin dilihat dari sisi penjual pemiliknya.',
  },

  Category: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      name: { type: 'string', example: 'Makanan' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  MenuItem: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 5 },
      canteenId: { type: 'integer', example: 1 },
      canteenName: { type: ['string', 'null'], example: 'Kantin FSTI' },
      canteenIsOpen: { type: 'boolean', example: true },
      category: {
        type: ['object', 'null'],
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: ['string', 'null'], example: 'Makanan' },
        },
      },
      name: { type: 'string', example: 'Nasi Goreng' },
      description: { type: ['string', 'null'], example: 'Nasi goreng spesial dengan telur dan acar' },
      price: { type: 'number', example: 15000, description: 'Harga satuan dalam rupiah.' },
      imageUrl: { type: ['string', 'null'] },
      isAvailable: {
        type: 'boolean',
        example: true,
        description: 'Menu yang bernilai `false` tidak dapat dimasukkan ke keranjang.',
      },
      isFavorite: {
        type: 'boolean',
        example: false,
        description:
          'Penanda menu favorit milik pembeli yang sedang masuk. Hanya ikut terkirim pada jalur ' +
          'katalog dan favorit yang diakses pembeli, tidak pada jalur penjual.',
      },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  // Skema keranjang belanja.

  CartItem: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 9, description: 'Dipakai untuk mengubah jumlah atau menghapus item ini.' },
      menuItemId: { type: 'integer', example: 5 },
      menuName: { type: 'string', example: 'Nasi Goreng' },
      price: { type: 'number', example: 15000 },
      quantity: { type: 'integer', example: 2 },
      subtotal: { type: 'number', example: 30000, description: 'Harga dikali jumlah, dihitung oleh server.' },
      note: {
        type: ['string', 'null'],
        example: 'Pedas sedikit',
        maxLength: 255,
        description:
          'Catatan khusus untuk menu ini saja, terpisah dari catatan tingkat pesanan. ' +
          'Ikut tersalin ke baris pesanan saat pesanan dibuat.',
      },
      imageUrl: { type: ['string', 'null'] },
      isAvailable: { type: 'boolean', example: true },
      category: {
        type: ['object', 'null'],
        properties: { id: { type: 'integer' }, name: { type: ['string', 'null'] } },
      },
    },
  },

  Cart: {
    type: 'object',
    description:
      'Keranjang milik pembeli. Satu pembeli hanya punya satu keranjang, dan isinya boleh berasal dari beberapa kantin sekaligus.',
    properties: {
      id: { type: 'integer', example: 4 },
      canteen: {
        allOf: [{ $ref: '#/components/schemas/Canteen' }],
        description:
          'Kantin asal isi keranjang, hanya terisi bila seluruh isinya berasal dari satu kantin. ' +
          'Bernilai `null` ketika keranjang kosong maupun bercampur.',
      },
      canteenCount: {
        type: 'integer',
        example: 2,
        description: 'Banyaknya kantin yang terwakili pada keranjang, sekaligus jumlah pesanan yang akan terbentuk.',
      },
      canteens: {
        type: 'array',
        description:
          'Isi keranjang yang dikelompokkan per kantin, lengkap dengan total tiap kelompok. ' +
          'Tiap kelompok akan menjadi satu pesanan tersendiri.',
        items: {
          type: 'object',
          properties: {
            canteen: {
              type: 'object',
              properties: {
                id: { type: 'integer', example: 1 },
                name: { type: ['string', 'null'], example: 'Kantin FSTI' },
                isOpen: { type: 'boolean', example: true },
              },
            },
            items: { type: 'array', items: { $ref: '#/components/schemas/CartItem' } },
            itemCount: { type: 'integer', example: 2 },
            totalQuantity: { type: 'integer', example: 3 },
            totalAmount: { type: 'number', example: 35000 },
          },
        },
      },
      items: {
        type: 'array',
        description: 'Seluruh isi keranjang tanpa pengelompokan.',
        items: { $ref: '#/components/schemas/CartItem' },
      },
      itemCount: { type: 'integer', example: 2, description: 'Banyaknya baris menu.' },
      totalQuantity: { type: 'integer', example: 3, description: 'Total seluruh jumlah porsi.' },
      totalAmount: { type: 'number', example: 35000, description: 'Total harga, dihitung oleh server.' },
      hasUnavailableItem: {
        type: 'boolean',
        example: false,
        description:
          'Bernilai `true` bila ada menu yang menjadi tidak tersedia setelah dimasukkan. Tampilkan peringatan sebelum pengguna memesan.',
      },
    },
  },

  ProfileStats: {
    type: 'object',
    description:
      'Ringkasan angka untuk halaman profil, dihitung langsung di database. Isinya menyesuaikan peran pengguna.',
    properties: {
      role: { type: 'string', enum: ['pembeli', 'penjual'] },
      orders: {
        type: 'object',
        description:
          'Bagi pembeli, dihitung dari pesanan miliknya. Bagi penjual, dari pesanan yang masuk ke kantinnya.',
        properties: {
          total: { type: 'integer', example: 12 },
          active: { type: 'integer', example: 1, description: 'Pesanan yang masih berjalan.' },
          completed: { type: 'integer', example: 9 },
          rejected: { type: 'integer', example: 1 },
          cancelled: { type: 'integer', example: 1 },
          history: { type: 'integer', example: 11, description: 'Selesai, ditolak, dan dibatalkan.' },
        },
      },
      favoriteCount: {
        type: 'integer',
        example: 5,
        description: 'Hanya untuk pembeli. Tidak disertakan pada penjual.',
      },
      menuCount: {
        type: 'integer',
        example: 8,
        description: 'Hanya untuk penjual. Jumlah menu aktif pada kantinnya.',
      },
    },
  },

  // Skema notifikasi.

  Notification: {
    type: 'object',
    description:
      'Satu baris riwayat notifikasi. Riwayat tetap tersimpan walau pesan push tidak sampai, sehingga halaman notifikasi selalu utuh.',
    properties: {
      id: { type: 'integer', example: 12 },
      type: {
        type: 'string',
        enum: ['order_created', 'order_status_changed', 'order_cancelled'],
        example: 'order_status_changed',
      },
      title: { type: 'string', example: 'Pesanan sedang disiapkan' },
      body: {
        type: 'string',
        example: 'Kantin FSTI menerima pesanan ORD-20260909-1234 dan sedang menyiapkannya.',
      },
      isRead: { type: 'boolean', example: false },
      readAt: { type: ['string', 'null'], format: 'date-time' },
      order: {
        type: ['object', 'null'],
        description: 'Pesanan yang dirujuk notifikasi ini, bila ada.',
        properties: {
          id: { type: 'integer', example: 7 },
          orderNumber: { type: ['string', 'null'], example: 'ORD-20260909-1234' },
          status: { type: ['string', 'null'], example: 'diproses' },
        },
      },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },

  // Skema pesanan.

  OrderItem: {
    type: 'object',
    description:
      'Satu baris pesanan. Nama dan harga disalin saat pesanan dibuat, sehingga riwayat tidak ikut berubah bila menu diubah kemudian.',
    properties: {
      id: { type: 'integer', example: 21 },
      menuItemId: { type: 'integer', example: 5 },
      menuName: { type: 'string', example: 'Nasi Goreng' },
      price: { type: 'number', example: 15000, description: 'Harga satuan pada saat pesanan dibuat.' },
      quantity: { type: 'integer', example: 2 },
      subtotal: { type: 'number', example: 30000 },
      note: {
        type: ['string', 'null'],
        example: 'Pedas sedikit',
        maxLength: 255,
        description: 'Catatan khusus untuk menu ini saja, terpisah dari catatan tingkat pesanan.',
      },
    },
  },

  Order: {
    type: 'object',
    description: 'Pesanan dilihat dari sisi pembeli.',
    properties: {
      id: { type: 'integer', example: 17 },
      orderNumber: { type: 'string', example: 'ORD-20260910-4831', description: 'Nomor pesanan yang ditunjukkan di kantin.' },
      status: {
        type: 'string',
        enum: ORDER_STATUS_VALUES,
        example: 'menunggu_konfirmasi',
        description: 'Status pesanan saat ini.',
      },
      statusLabel: {
        type: 'string',
        enum: Object.values(ORDER_STATUS_LABELS),
        example: 'Menunggu Konfirmasi',
        description: 'Status yang siap ditampilkan.',
      },
      isCancellable: {
        type: 'boolean',
        example: true,
        description: 'Menandakan tombol "Batalkan Pesanan" boleh ditampilkan.',
      },
      note: { type: ['string', 'null'], example: 'Pedas sedikit' },
      rejectReason: { type: ['string', 'null'], example: 'Stok habis', description: 'Terisi bila pesanan ditolak penjual.' },
      totalAmount: { type: 'number', example: 35000, description: 'Total yang dibayar langsung di kantin.' },
      canteen: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: ['string', 'null'], example: 'Kantin FSTI' },
          location: { type: ['string', 'null'], example: 'Gedung A, Lantai 1' },
          imageUrl: { type: ['string', 'null'] },
        },
      },
      items: { type: 'array', items: { $ref: '#/components/schemas/OrderItem' } },
      itemCount: { type: 'integer', example: 2 },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  SellerOrder: {
    allOf: [
      { $ref: '#/components/schemas/Order' },
      {
        type: 'object',
        properties: {
          buyer: {
            type: 'object',
            description: 'Identitas pemesan, agar penjual dapat mencocokkan saat pengambilan.',
            properties: {
              id: { type: 'integer', example: 12 },
              name: { type: ['string', 'null'], example: 'Budi Santoso' },
              campusId: { type: ['string', 'null'], example: '10231076' },
              email: { type: ['string', 'null'], example: 'budi@student.itk.ac.id' },
            },
          },
        },
      },
    ],
    description: 'Pesanan dilihat dari sisi penjual. Field `isCancellable` tidak dipakai di sini.',
  },

  SellerDashboard: {
    type: 'object',
    properties: {
      canteen: { $ref: '#/components/schemas/OwnedCanteen' },
      summary: {
        type: 'object',
        description: 'Jumlah pesanan per status untuk kartu ringkasan di dasbor.',
        properties: {
          pesananBaru: { type: 'integer', example: 5, description: 'Pesanan berstatus Menunggu Konfirmasi.' },
          diterima: { type: 'integer', example: 1 },
          diproses: { type: 'integer', example: 3 },
          siapDiambil: { type: 'integer', example: 2 },
          selesai: { type: 'integer', example: 40 },
          ditolak: { type: 'integer', example: 2 },
          dibatalkan: { type: 'integer', example: 1 },
        },
      },
      recentOrders: {
        type: 'array',
        description: 'Sepuluh pesanan terakhir, terbaru lebih dulu.',
        items: { $ref: '#/components/schemas/SellerOrder' },
      },
    },
  },

  DeletedMenuResult: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 5 },
      name: { type: 'string', example: 'Nasi Goreng' },
      removedFromCarts: {
        type: 'integer',
        example: 2,
        description: 'Banyaknya keranjang pembeli yang otomatis dibersihkan dari menu ini.',
      },
    },
  },
};

export default schemas;
