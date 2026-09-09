import { ORDER_STATUS_VALUES, ORDER_STATUS_LABELS } from '../constants/orderStatus.js';
import { ROLE_VALUES } from '../constants/roles.js';
import ERROR_CODES from '../constants/errorCodes.js';

/**
 * Kumpulan skema komponen OpenAPI.
 *
 * Daftar nilai tetap diambil dari konstanta yang sama dengan yang dipakai saat
 * aplikasi berjalan, sehingga dokumentasi tidak akan menyimpang dari perilaku
 * API yang sebenarnya.
 */

export const schemas = {
  // --- Envelope -------------------------------------------------------------

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

  // --- Akun -----------------------------------------------------------------

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

  // --- Kantin & menu --------------------------------------------------------

  Canteen: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      name: { type: 'string', example: 'Kantin FSTI' },
      description: { type: ['string', 'null'], example: 'Kantin Fakultas Sains dan Teknologi Informasi' },
      location: { type: ['string', 'null'], example: 'Gedung A, Lantai 1' },
      imageUrl: { type: ['string', 'null'] },
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
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  // --- Keranjang ------------------------------------------------------------

  CartItem: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 9, description: 'Dipakai untuk mengubah jumlah atau menghapus item ini.' },
      menuItemId: { type: 'integer', example: 5 },
      menuName: { type: 'string', example: 'Nasi Goreng' },
      price: { type: 'number', example: 15000 },
      quantity: { type: 'integer', example: 2 },
      subtotal: { type: 'number', example: 30000, description: 'Harga dikali jumlah, dihitung oleh server.' },
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
      'Keranjang milik pembeli. Satu pembeli hanya punya satu keranjang, dan seluruh isinya harus berasal dari satu kantin yang sama.',
    properties: {
      id: { type: 'integer', example: 4 },
      canteen: {
        allOf: [{ $ref: '#/components/schemas/Canteen' }],
        description: 'Kantin asal isi keranjang. Bernilai `null` bila keranjang kosong.',
      },
      items: { type: 'array', items: { $ref: '#/components/schemas/CartItem' } },
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

  // --- Pesanan --------------------------------------------------------------

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
