# Kantin ITK — Backend API

REST API untuk aplikasi pemesanan kantin kampus Institut Teknologi Kalimantan.

Pembeli menelusuri kantin, mencari menu, mengisi keranjang, membuat pesanan, dan
memantau statusnya. Penjual memakai API yang sama dengan peran berbeda untuk
mengelola menu serta memproses pesanan yang masuk.

Pembayaran dilakukan langsung di kantin saat pesanan diambil. Sistem tidak
menyimpan data pembayaran dalam bentuk apa pun.

---

## Teknologi

| Bagian | Pilihan |
|---|---|
| Runtime | Node.js 20.11 ke atas (diuji pada Node 22) |
| Framework | Express 5 |
| Database | MySQL 8.0 |
| Akses data | `mysql2` dengan prepared statement, tanpa ORM |
| Autentikasi | Google SSO, sesi memakai JWT |
| Pemeriksaan data | Zod |
| Dokumentasi | Scalar, dibangun dari berkas OpenAPI 3.1 |
| Pengujian | `node:test` bawaan Node |

---

## Kebutuhan Awal

- Node.js 20.11 ke atas
- MySQL 8.0 yang sedang berjalan
- Akun Google Cloud Console untuk memperoleh OAuth Client ID (dibutuhkan saat
  aplikasi Flutter sudah dihubungkan)

---

## Pemasangan

```bash
npm install
cp .env.example .env
```

Isi berkas `.env`, minimal bagian berikut:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=kata-sandi-mysql-anda
DB_NAME=kantin_itk

JWT_SECRET=
```

Nilai `JWT_SECRET` wajib diisi minimal 32 karakter. Nilai acak dapat dibuat
dengan perintah:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Aplikasi menolak berjalan bila konfigurasi tidak lengkap, disertai pesan yang
menyebutkan variabel mana yang bermasalah.

---

## Menyiapkan Database

```bash
npm run db:migrate    # membuat database dan seluruh tabelnya
npm run db:seed       # mengisi data contoh untuk pengembangan
```

Perintah lain yang tersedia:

```bash
npm run db:migrate -- --fresh   # menghapus database lalu membangun ulang
npm run db:reset                # gabungan --fresh dan seed
```

Berkas migrasi berada di `database/migrations/`. Setiap berkas dijalankan sekali
dan dicatat pada tabel `schema_migrations`.

### Akun contoh

Seluruh akun berikut merupakan data uji coba dan tidak memiliki kata sandi.

| Peran | Email | Kantin |
|---|---|---|
| Penjual | `penjual.fsti@itk.ac.id` | Kantin FSTI |
| Penjual | `penjual.teknik@itk.ac.id` | Kantin Teknik |
| Penjual | `penjual.kampus@itk.ac.id` | Kantin Kampus (tutup) |
| Pembeli | `budi.santoso@student.itk.ac.id` | — |
| Pembeli | `siti.rahayu@student.itk.ac.id` | — |
| Pembeli | `andi.wijaya@lecture.itk.ac.id` | — |

Agar ketiga akun penjual tetap berperan penjual saat masuk, alamatnya perlu
dicantumkan pada `SELLER_EMAILS`:

```env
SELLER_EMAILS=penjual.fsti@itk.ac.id,penjual.teknik@itk.ac.id,penjual.kampus@itk.ac.id
```

---

## Menjalankan Server

```bash
npm run dev     # mode pengembangan, memuat ulang saat berkas berubah
npm start       # mode biasa
```

Server berjalan pada `http://localhost:3000`.

| Alamat | Isi |
|---|---|
| `/docs` | Dokumentasi API (Scalar) |
| `/openapi.json` | Berkas OpenAPI mentah |
| `/api/health` | Pemeriksaan status layanan |

---

## Pengujian

```bash
npm test                # pengujian satuan, tidak memerlukan database
npm run test:integration  # pengujian terpadu, memerlukan MySQL
npm run test:all
```

Pengujian terpadu memakai database terpisah bernama `kantin_itk_test`. Database
tersebut dihapus dan dibangun ulang otomatis pada setiap kali dijalankan,
sehingga data pengembangan tidak ikut terpengaruh.

Cakupan pengujian meliputi aturan domain email dan penetapan peran, perhitungan
uang, seluruh kemungkinan perpindahan status pesanan, aturan keranjang,
pembuatan pesanan beserta pembatalannya bila gagal, penyimpanan salinan harga,
serta pembatasan kepemilikan data antar pembeli dan antar penjual.

---

## Alur Masuk

```
Aplikasi Flutter
      |
      |  menjalankan proses masuk Google, memperoleh idToken
      v
POST /api/auth/google
      |
      |  server memeriksa identitas langsung ke Google
      |  server memeriksa apakah alamat email diizinkan
      |  server menentukan peran dari daftar di konfigurasi
      v
{ user, accessToken }
      |
      v
Permintaan berikutnya memakai header:
Authorization: Bearer <accessToken>
```

Tidak ada pendaftaran manual. Akun pembeli dibuat otomatis saat pertama kali
masuk, selama alamat emailnya memakai domain kampus.

### Aturan email dan peran

Aturan domain dan penetapan peran merupakan dua hal berbeda.

**Domain** menentukan siapa yang boleh memakai aplikasi:

```
@student.itk.ac.id
@lecture.itk.ac.id
@itk.ac.id
```

**Peran** ditentukan oleh `SELLER_EMAILS` di berkas `.env`. Sistem ini tidak
memiliki peran admin, sehingga variabel tersebutlah satu-satunya cara menetapkan
penjual:

1. Alamat email penjual ditambahkan pada `SELLER_EMAILS`.
2. Server dijalankan ulang.
3. Penjual masuk melalui Google seperti biasa.
4. Akunnya otomatis dibuat atau diperbarui dengan peran `penjual`.

Beberapa hal yang perlu diketahui:

- Peran diselaraskan ulang setiap kali masuk. Menghapus sebuah alamat dari daftar
  akan menurunkan akun tersebut menjadi `pembeli` pada saat masuk berikutnya.
- Alamat pada daftar ini dikecualikan dari aturan domain kampus, sehingga penjual
  kantin boleh memakai email di luar domain ITK.
- Domain email saja tidak pernah memberikan peran penjual. Akun `@itk.ac.id`
  tetap menjadi pembeli selama tidak terdaftar pada `SELLER_EMAILS`.

### Masuk cepat saat pengembangan

Selama `NODE_ENV` bukan `production` dan `ENABLE_DEV_LOGIN=true`, tersedia jalur
`POST /api/auth/dev-login` yang menerbitkan kunci akses untuk akun hasil seed
tanpa melalui Google. Jalur ini berguna untuk menguji API sebelum konfigurasi
Google siap, tidak pernah membuat akun baru, dan bahkan tidak didaftarkan ketika
`NODE_ENV=production`.

---

## Daftar Endpoint

Seluruh endpoint berawalan `/api` dan memerlukan proses masuk, kecuali
`/api/health` dan jalur masuk itu sendiri.

### Autentikasi dan profil

| Metode | Alamat | Keterangan |
|---|---|---|
| POST | `/api/auth/google` | Masuk dengan akun Google |
| POST | `/api/auth/dev-login` | Masuk cepat, hanya saat pengembangan |
| GET | `/api/auth/me` | Data akun yang sedang masuk |
| POST | `/api/auth/logout` | Keluar dan membatalkan kunci akses |
| GET | `/api/users/me` | Melihat profil |
| PATCH | `/api/users/me` | Mengubah nama dan foto profil |

### Kantin dan menu

| Metode | Alamat | Keterangan |
|---|---|---|
| GET | `/api/canteens` | Daftar kantin |
| GET | `/api/canteens/:id` | Detail kantin |
| GET | `/api/canteens/:id/menu` | Menu sebuah kantin |
| GET | `/api/menu` | Cari dan saring menu |
| GET | `/api/menu/:id` | Detail menu |
| GET | `/api/categories` | Daftar kategori |

Contoh pencarian: `/api/menu?search=nasi&categoryId=1&page=1&limit=20`

### Keranjang (pembeli)

| Metode | Alamat | Keterangan |
|---|---|---|
| GET | `/api/cart` | Isi keranjang |
| POST | `/api/cart/items` | Menambahkan menu |
| PATCH | `/api/cart/items/:id` | Mengubah jumlah |
| DELETE | `/api/cart/items/:id` | Menghapus satu menu |
| DELETE | `/api/cart` | Mengosongkan keranjang |

### Pesanan (pembeli)

| Metode | Alamat | Keterangan |
|---|---|---|
| POST | `/api/orders` | Membuat pesanan dari keranjang |
| GET | `/api/orders` | Daftar pesanan, dapat disaring `scope=active` atau `scope=history` |
| GET | `/api/orders/:id` | Detail pesanan |
| PATCH | `/api/orders/:id/cancel` | Membatalkan pesanan |

### Penjual

| Metode | Alamat | Keterangan |
|---|---|---|
| GET | `/api/seller/dashboard` | Ringkasan pesanan |
| GET | `/api/seller/canteen` | Data kantin sendiri |
| POST | `/api/seller/canteen` | Membuat kantin sendiri |
| PATCH | `/api/seller/canteen` | Mengubah kantin, termasuk status buka dan tutup |
| GET | `/api/seller/menu` | Daftar menu sendiri |
| GET | `/api/seller/menu/:id` | Detail menu sendiri |
| POST | `/api/seller/menu` | Menambah menu |
| PATCH | `/api/seller/menu/:id` | Mengubah menu |
| DELETE | `/api/seller/menu/:id` | Menghapus menu |
| GET | `/api/seller/orders` | Pesanan yang masuk |
| GET | `/api/seller/orders/:id` | Detail pesanan masuk |
| PATCH | `/api/seller/orders/:id/accept` | Menerima pesanan |
| PATCH | `/api/seller/orders/:id/reject` | Menolak pesanan |
| PATCH | `/api/seller/orders/:id/process` | Memproses pesanan |
| PATCH | `/api/seller/orders/:id/ready` | Menandai siap diambil |
| PATCH | `/api/seller/orders/:id/complete` | Menyelesaikan pesanan |

Penjelasan lengkap setiap endpoint tersedia pada `/docs`.

---

## Bentuk Respons

Berhasil:

```json
{
  "success": true,
  "message": "Pesanan berhasil dibuat",
  "data": {}
}
```

Gagal:

```json
{
  "success": false,
  "message": "Menu tidak tersedia",
  "error": { "code": "MENU_UNAVAILABLE" }
}
```

Isi `message` ditulis dalam bahasa Indonesia yang aman ditampilkan langsung
kepada pengguna. Untuk percabangan logika di aplikasi, gunakan `error.code`
karena teks pesan dapat berubah sewaktu-waktu.

Daftar respons yang memakai halaman menyertakan bagian `meta`:

```json
{
  "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3,
            "hasNextPage": true, "hasPrevPage": false }
}
```

---

## Status Pesanan

```
MENUNGGU KONFIRMASI
        |
        +--> DITOLAK      (oleh penjual)
        +--> DIBATALKAN   (oleh pembeli)
        |
        v
     DITERIMA
        |
        v
     DIPROSES
        |
        v
  SIAP DIAMBIL
        |
        v
      SELESAI
```

Perpindahan yang diizinkan hanya enam pasangan di atas. Perpindahan lain, baik
melompati tahap maupun mundur ke tahap sebelumnya, ditolak dengan kode
`INVALID_ORDER_STATUS_TRANSITION`.

Pembatalan oleh pembeli hanya dimungkinkan selama pesanan masih berstatus
Menunggu Konfirmasi. Setelah penjual menerima pesanan, pembatalan tidak lagi
tersedia.

---

## Struktur Proyek

```
be-kantin-itk/
├── database/migrations/     berkas SQL skema database
├── scripts/                 skrip migrasi dan pengisian data contoh
├── src/
│   ├── config/              konfigurasi environment dan koneksi database
│   ├── constants/           peran, status pesanan, kode kesalahan
│   ├── controllers/         penanganan permintaan dan penyusunan respons
│   ├── docs/                berkas OpenAPI untuk dokumentasi
│   ├── middlewares/         pemeriksaan sesi, peran, data, dan kesalahan
│   ├── repositories/        seluruh akses ke database
│   ├── routes/              pendaftaran alamat endpoint
│   ├── services/            aturan bisnis
│   ├── utils/               alat bantu umum
│   ├── app.js               penyusun aplikasi Express
│   └── server.js            titik masuk proses
└── tests/
    ├── unit/                pengujian tanpa database
    └── integration/         pengujian melalui API dan database sungguhan
```

Pembagian tanggung jawab antar lapisan:

- **Controller** hanya mengurus permintaan dan respons.
- **Service** memuat aturan bisnis.
- **Repository** memuat seluruh kueri database.
- **Validator** memeriksa bentuk dan isi permintaan.
- **Middleware** menangani sesi, peran, dan kesalahan.

---

## Keputusan Skema Database

Skema pada `database/migrations/001_init.sql` disusun dari berkas `db.sql` dan
ERD milik proyek ini, dengan beberapa penyesuaian:

| Penyesuaian | Alasan |
|---|---|
| Tipe ENUM PostgreSQL menjadi kolom ENUM MySQL | Proyek memakai MySQL |
| Peran `mahasiswa` menjadi `pembeli` | Dokumen kebutuhan menyebut peran pembeli sebagai `pembeli` |
| Kolom `users.password` dihapus | Proses masuk sepenuhnya melalui Google, tidak ada kata sandi yang disimpan |
| Kolom `users.google_id` ditambahkan | Menyimpan identitas akun Google sebagai penanda akun yang tetap |
| Kolom `users.token_version` ditambahkan | Agar proses keluar dapat membatalkan kunci akses yang sudah diterbitkan |
| Kolom `canteens.is_open` ditambahkan | Menyimpan status buka dan tutup kantin |
| Kolom `orders.reject_reason` ditambahkan | Menyimpan alasan penolakan pesanan |
| Kolom `menu_items.deleted_at` ditambahkan | Menu dihapus dengan penandaan agar riwayat pesanan tetap utuh |
| Indeks unik `(cart_id, menu_item_id)` | Menu yang sama pada satu keranjang hanya menambah jumlahnya |

Nilai `campus_id` diturunkan dari bagian depan alamat email, karena Google tidak
menyediakan nomor induk sementara kolom tersebut bersifat wajib dan unik.

---

## Catatan Keamanan

- Seluruh kueri memakai prepared statement dengan parameter terikat. Satu-satunya
  nilai yang disisipkan langsung ke teks SQL adalah angka halaman dan batas data,
  yang sudah dibulatkan serta dibatasi lebih dulu.
- Identitas pengguna hanya berasal dari hasil pemeriksaan identitas Google. Nilai
  `role`, `email`, dan `userId` yang dikirim aplikasi tidak pernah dipakai.
- Data pengguna dibaca ulang dari database pada setiap permintaan, sehingga
  perubahan peran dan proses keluar langsung berlaku.
- Aturan pemeriksaan bersifat ketat. Field yang tidak dideklarasikan ditolak,
  sehingga upaya menyisipkan `role` atau `total_amount` terlihat jelas.
- Kepemilikan data ditegakkan pada klausa WHERE. Menebak id milik penjual atau
  pembeli lain menghasilkan jawaban tidak ditemukan, bukan data orang lain.
- Harga dan total selalu dibaca serta dihitung di server.
- Pembuatan pesanan berjalan dalam satu transaksi dengan penguncian baris,
  sehingga tidak ada pesanan separuh jadi maupun perubahan harga di tengah proses.
- Kunci akses memakai algoritma yang dikunci, dan isinya hanya memuat id pengguna
  beserta nomor versi sesi.
- Jumlah permintaan dibatasi, dengan batas yang lebih ketat pada jalur masuk.
- Rincian teknis kesalahan tidak pernah dikirim ke aplikasi pada mode produksi.
- Berkas `.env` tidak pernah masuk ke Git.

---

## Batasan yang Diketahui

- Gambar menu dan foto profil disimpan sebagai alamat URL. Belum ada fasilitas
  unggah berkas.
- Pemberitahuan masih mengandalkan pembacaan ulang status oleh aplikasi. Belum ada
  pengiriman notifikasi.
- Belum ada jalur untuk mengelola kategori dari sisi penjual. Kategori diisi
  melalui data contoh.
- Fitur di luar cakupan, seperti pembayaran daring, pengantaran, percakapan, dan
  penilaian, memang tidak dibuat.
