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
  aplikasi Flutter sudah dihubungkan). Dalam satu project dibuat dua client:
  bertipe **Android** untuk aplikasi Flutter, dan bertipe **Web application**
  yang client ID-nya diisikan ke `GOOGLE_CLIENT_ID` pada server.

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

Akun di atas hanya data contoh untuk pengembangan. Peran penjual yang
sesungguhnya ditentukan oleh `SELLER_EMAILS` pada berkas `.env`, yang diisi
sendiri sesuai penjual nyata dan tidak berkaitan dengan perintah seed:

```env
SELLER_EMAILS=alamat.penjual@contoh.com
```

Menambahkan alamat baru cukup diikuti menjalankan ulang server, tanpa migrasi
maupun seed, sehingga data yang sudah ada tetap utuh.

---

## Menjalankan dengan Docker

Server ini tidak memiliki Node maupun MySQL terpasang, sehingga keduanya
dijalankan sebagai container:

```bash
docker compose up -d          # menyalakan mysql dan api
docker compose logs -f api    # membaca catatan aplikasi
docker compose down           # mematikan keduanya
```

Perintah npm dijalankan di dalam container:

```bash
docker compose exec api npm run db:migrate
docker compose exec api npm run db:seed
```

---

## Melihat Isi Database

Database berada di container `kantin-itk-mysql` dan kata sandinya dibaca dari
`.env`, sehingga tidak perlu ditulis ulang:

```bash
PW=$(grep ^DB_PASSWORD= .env | cut -d= -f2-)

# Masuk ke prompt MySQL
docker exec -it kantin-itk-mysql mysql -uroot -p"$PW" kantin_itk

# Sekali jalan tanpa masuk prompt
docker exec kantin-itk-mysql mysql -uroot -p"$PW" kantin_itk \
  -e "SELECT id, name, price FROM menu_items;"
```

Perintah yang sering dipakai di dalam prompt:

| Perintah | Isi |
|---|---|
| `SHOW TABLES;` | daftar seluruh tabel |
| `DESCRIBE orders;` | struktur kolom sebuah tabel |
| `SELECT * FROM users\G` | data pengguna, satu kolom per baris |
| `SELECT status, COUNT(*) FROM orders GROUP BY status;` | jumlah pesanan per status |

Membuat salinan cadangan:

```bash
docker exec kantin-itk-mysql mysqldump -uroot -p"$PW" \
  --single-transaction --databases kantin_itk > cadangan.sql
```

Database juga terbuka pada `127.0.0.1:13306`, sehingga dapat dibuka memakai
DBeaver, TablePlus, atau MySQL Workbench lewat terowongan SSH. Porta itu hanya
mendengarkan di localhost dan tidak dapat dijangkau dari internet.

---

## Menyiapkan Firebase untuk Pesan Push

Bagian ini hanya dibutuhkan bila pesan push ingin diaktifkan. Tanpa langkah ini
API tetap berjalan penuh, hanya pesan push yang tidak dikirim.

### 1. Membuat project Firebase

Buka [console.firebase.google.com](https://console.firebase.google.com) lalu
**Add project**. Pilih project Google Cloud yang sudah dipakai untuk OAuth agar
tidak terpisah, atau buat baru bila memang dikehendaki.

### 2. Mendaftarkan aplikasi Android

Pada Project settings, bagian **Your apps**, pilih ikon Android:

1. Isi package name, sama persis dengan `applicationId` pada
   `android/app/build.gradle`.
2. Isi sidik jari SHA-1, diperoleh dengan `cd android && ./gradlew signingReport`.
3. Unduh `google-services.json` dan letakkan di `android/app/`.

### 3. Mengambil kredensial untuk server

Project settings → tab **Service accounts** → **Generate new private key**.
Sebuah berkas JSON akan terunduh. Berkas ini adalah kunci penuh ke project
Firebase, sehingga jangan sekali-kali masuk ke Git.

Letakkan pada server:

```bash
mkdir -p secrets
mv ~/Unduhan/nama-berkas.json secrets/firebase-service-account.json
chmod 600 secrets/firebase-service-account.json
```

Direktori `secrets/` sudah tercantum pada `.gitignore`.

### 4. Menunjuk berkas tersebut dari konfigurasi

Isi pada `.env`:

```env
FIREBASE_SERVICE_ACCOUNT=/app/secrets/firebase-service-account.json
```

Perhatikan awalan `/app`. Jalur tersebut merupakan jalur **di dalam container**,
sedangkan `secrets/` pada server dipasang ke `/app/secrets` oleh
`docker-compose.yml`. Menuliskan `/secrets/...` saja akan membuat berkasnya tidak
ditemukan, dan pesan push dilewati tanpa pemberitahuan yang mencolok.

Nama berkasnya bebas, asalkan sama dengan yang tertulis pada `.env`.

Jalankan ulang, lalu periksa catatannya:

```bash
docker compose up -d api
docker compose logs api | grep -i firebase
```

Catatan itu baru muncul pada pengiriman pertama, karena kredensial dibaca saat
dibutuhkan. Untuk memastikannya tanpa menunggu ada pesanan masuk:

```bash
docker compose exec api node -e "
import('./src/services/fcm.service.js').then(async (m) => {
  console.log('push aktif:', m.isPushEnabled());
  console.log(await m.sendToTokens(['token-palsu'], { title: 'uji', body: 'uji' }));
});"
```

Kredensial yang benar akan memunculkan `Firebase siap mengirim pesan untuk
project ...`, lalu token palsunya ditolak Firebase. Penolakan token itu justru
tanda otentikasinya berhasil. Bila kredensialnya salah, kegagalannya terjadi
lebih awal saat mengambil akses token.

Pesan push dilewati begitu saja bila kredensial belum benar, tanpa mengganggu
jalannya API.

### 5. Menyambungkan dari sisi Flutter

Alurnya:

1. Aplikasi meminta izin notifikasi kepada pengguna.
2. Aplikasi mengambil token perangkat dari Firebase Messaging.
3. Token dikirim ke `POST /api/notifications/devices`.
4. Token dikirim ulang setiap kali Firebase memperbaruinya.
5. Sebelum pengguna keluar, token dicabut lewat
   `DELETE /api/notifications/devices/:token`.

Server menyertakan `data.type`, `data.orderId`, `data.notificationId`, dan
`data.status` pada tiap pesan, sehingga aplikasi dapat membuka halaman pesanan
yang tepat ketika notifikasinya disentuh.

Token yang ditolak Firebase, misalnya karena aplikasi dicopot, dibersihkan
sendiri oleh server pada pengiriman berikutnya.

---

## Menjalankan Server

```bash
npm run dev     # mode pengembangan, memuat ulang saat berkas berubah
npm start       # mode biasa
```

Server berjalan pada `http://localhost:3000`.

| Alamat | Isi |
|---|---|
| `/docs-api` | Dokumentasi API (Scalar) |
| `/openapi.json` | Berkas OpenAPI mentah |
| `/api/health` | Pemeriksaan status layanan |

---

## Pengujian

```bash
npm test                # pengujian satuan, tidak memerlukan database
npm run test:integration  # pengujian terpadu, memerlukan MySQL
npm run test:all
```

Citra produksi sengaja tidak memuat berkas pengujian, sehingga pengujian
dijalankan pada container terpisah yang memasang direktori proyek:

```bash
docker exec kantin-itk-dev npm run test:all
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
      |  menjalankan proses masuk Google memakai client Android,
      |  dengan serverClientId berisi client ID Web, lalu memperoleh idToken
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

### Asal akun pembeli

Fakultas dan program studi diisi otomatis saat masuk, dibaca dari alamat email.
Pengguna tidak dapat mengisinya sendiri.

| Bentuk alamat | Hasil |
|---|---|
| `<NIM>@student.itk.ac.id` | fakultas dan program studi sesuai dua digit awal NIM |
| bukan angka `@lecture.itk.ac.id` | `Dosen ITK`, tanpa program studi |
| bukan angka `@itk.ac.id` | `Email Umum ITK`, tanpa program studi |
| selain itu | kosong |

Bagian depan yang seluruhnya angka merupakan NIM, dan hanya sah bila
berpasangan dengan `student.itk.ac.id`. Alamat berawalan angka pada domain lain
tidak dikenali, karena dosen maupun unit kampus tidak memiliki NIM.

Nomor WhatsApp tersedia pada akun pengguna maupun pada kantin. Penulisan `08xx`,
`8xx`, `62xx`, dan `+62xx` sama-sama diterima, lalu dibakukan server menjadi
bentuk berawalan `62` tanpa tanda tambah sehingga siap dipakai pada tautan
`wa.me`. Nomor selain nomor seluler Indonesia ditolak.

Field `affiliation` selalu berisi keterangan yang siap ditampilkan, sedangkan
`nim`, `faculty`, `studyProgram`, dan `studyProgramCode` hanya terisi untuk
mahasiswa. Field `nim` berisi bagian depan alamat email apa adanya, dan tetap
terisi walau dua digit awalnya belum terdaftar sebagai program studi.

Kode program studi mengikuti daftar berikut:

| Fakultas | Kode |
|---|---|
| Sains dan Teknologi Informasi | 01 Fisika, 02 Matematika, 04 Teknik Elektro, 10 Sistem Informasi, 11 Informatika, 16 Statistika, 17 Ilmu Aktuaria, 20 Bisnis Digital, 25 Biomedis |
| Pembangunan Berkelanjutan | 07 Teknik Sipil, 08 Perencanaan Wilayah dan Kota, 09 Teknik Perkapalan, 13 Teknik Lingkungan, 14 Teknik Kelautan, 15 Arsitektur, 22 Desain Komunikasi Visual, 23 Sistem Perkapalan, 24 Transportasi Laut |
| Rekayasa dan Teknik Industri | 03 Teknik Mesin, 05 Teknik Kimia, 06 Teknik Material dan Metalurgi, 12 Teknik Industri, 18 Rekayasa Keselamatan, 19 Teknologi Pangan, 21 Teknik Logistik |

Daftar tersebut berada di `src/constants/studyPrograms.js`.

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
| PATCH | `/api/users/me` | Mengubah nama, foto profil, dan nomor WhatsApp |
| PUT | `/api/users/me` | Sama dengan PATCH di atas |
| POST | `/api/users/me/photo` | Unggah berkas gambar sekaligus memasangnya sebagai foto profil |
| GET | `/api/users/me/stats` | Ringkasan jumlah pesanan, favorit, dan menu |
| POST | `/api/uploads` | Unggah gambar dan memperoleh alamatnya |

### Kantin dan menu

| Metode | Alamat | Keterangan |
|---|---|---|
| GET | `/api/canteens` | Daftar kantin |
| GET | `/api/canteens/:id` | Detail kantin |
| GET | `/api/canteens/:id/menu` | Menu sebuah kantin |
| GET | `/api/menu` | Cari dan saring menu |
| GET | `/api/menu/:id` | Detail menu |
| GET | `/api/categories` | Daftar kategori |
| POST | `/api/categories` | Menambah kategori, khusus penjual |

Contoh pencarian: `/api/menu?search=nasi&categoryId=1&page=1&limit=20`

Kategori dapat ditambah penjual lewat `POST /api/categories`, karena sistem ini
tidak memiliki peran admin. Nama yang sudah ada dipakai kembali tanpa peduli
besar kecil hurufnya, sehingga `Makanan` dan `makanan` tidak pernah menjadi dua
kategori terpisah. Kategori baru dijawab `201`, yang dipakai kembali `200`.

Daftar kantin dan menu dapat diurutkan lewat `sortBy` dan `sortOrder`. Untuk
kantin, `sortBy` menerima `name`, `menuCount`, atau `createdAt`; untuk menu,
`name`, `price`, atau `createdAt`. Kantin yang buka dan menu yang tersedia tetap
didahulukan. Nilai di luar daftar tersebut ditolak.

Ketika diakses pembeli, setiap menu menyertakan `isFavorite` sehingga tombol
favorit pada aplikasi dapat langsung menampilkan keadaan yang benar.

### Unggah gambar

Berkas dikirim sebagai `multipart/form-data` dengan nama field `file`. Diterima
JPG, PNG, dan WebP, maksimal 5 MB. Nama berkas ditentukan server secara acak,
sehingga nama kiriman tidak dipakai sama sekali.

`POST /api/uploads` mengembalikan `data.url` yang dapat langsung dipasang pada
field `imageUrl` menu maupun kantin.

Tersedia pula jalan pintas yang mengunggah sekaligus memasang, sehingga aplikasi
cukup satu panggilan:

| Metode | Alamat | Memasang pada |
|---|---|---|
| POST | `/api/users/me/photo` | Foto profil pengguna |
| POST | `/api/seller/menu/:id/photo` | Foto sebuah menu |
| POST | `/api/seller/canteen/photo` | Foto kantin |

Bila pemasangannya gagal, misalnya menu tersebut milik penjual lain, berkas yang
terlanjur terunggah ikut dibuang sehingga tidak meninggalkan sisa di server.

Berkas disimpan pada volume `uploads_data` dan disajikan di `/uploads/...`.

### Ringkasan profil

`GET /api/users/me/stats` menghitung langsung di database, sehingga aplikasi
tidak perlu mengunduh seluruh pesanan hanya untuk menampilkan beberapa angka.
Isinya menyesuaikan peran: pembeli memperoleh `favoriteCount`, penjual
memperoleh `menuCount`.

```json
{
  "role": "pembeli",
  "orders": { "total": 12, "active": 1, "completed": 9, "rejected": 1, "cancelled": 1, "history": 11 },
  "favoriteCount": 5
}
```

### Notifikasi

| Metode | Alamat | Keterangan |
|---|---|---|
| GET | `/api/notifications` | Riwayat notifikasi, `meta.unreadCount` ikut terkirim |
| GET | `/api/notifications/unread-count` | Jumlah belum dibaca, jawaban ringan |
| PATCH | `/api/notifications/:id/read` | Menandai satu notifikasi sudah dibaca |
| PATCH | `/api/notifications/read-all` | Menandai seluruhnya sudah dibaca |
| POST | `/api/notifications/devices` | Mendaftarkan token perangkat |
| DELETE | `/api/notifications/devices/:token` | Mencabut token, panggil sebelum keluar |

Notifikasi dibuat otomatis ketika pesanan masuk, statusnya berpindah, atau
dibatalkan pembeli. Riwayatnya selalu tersimpan, sedangkan pesan push bersifat
pelengkap: bila Firebase belum disiapkan atau sedang bermasalah, pesanan tetap
berjalan normal dan halaman notifikasi tetap terisi.

### Favorit (pembeli)

| Metode | Alamat | Keterangan |
|---|---|---|
| GET | `/api/favorites` | Daftar menu favorit |
| POST | `/api/favorites` | Menandai menu sebagai favorit |
| DELETE | `/api/favorites/:menuItemId` | Membatalkan favorit |

Penandaan bersifat idempoten, sehingga tombol favorit aman ditekan berulang.
Menu yang sedang tidak tersedia tetap boleh ditandai, dan menu yang dihapus
penjual otomatis hilang dari daftar favorit.

### Keranjang (pembeli)

| Metode | Alamat | Keterangan |
|---|---|---|
| GET | `/api/cart` | Isi keranjang |
| POST | `/api/cart/items` | Menambahkan menu |
| PATCH | `/api/cart/items/:id` | Mengubah jumlah |
| DELETE | `/api/cart/items/:id` | Menghapus satu menu |
| DELETE | `/api/cart` | Mengosongkan keranjang |

Keranjang boleh memuat menu dari beberapa kantin sekaligus. Isinya dikelompokkan
per kantin pada field `canteens`, masing-masing dengan totalnya sendiri.

Tiap baris menu punya `note` sendiri, terpisah dari catatan tingkat pesanan.
Catatan ini ikut tersalin ke baris pesanan saat pesanan dibuat.

### Pesanan (pembeli)

| Metode | Alamat | Keterangan |
|---|---|---|
| POST | `/api/orders` | Membuat pesanan dari keranjang |
| GET | `/api/orders` | Daftar pesanan, dapat disaring `scope=active` atau `scope=history` |
| GET | `/api/orders/:id` | Detail pesanan |
| PATCH | `/api/orders/:id/cancel` | Membatalkan pesanan |

`POST /api/orders` memecah isi keranjang menjadi satu pesanan untuk tiap kantin,
sehingga `data` **selalu berupa daftar** walau isinya hanya satu pesanan.
Bila salah satu kantin sedang tutup, seluruh pembuatan pesanan dibatalkan dan
isi keranjang tetap utuh.

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

Penjelasan lengkap setiap endpoint tersedia pada `/docs-api`.

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
        v  (penjual menekan Terima)
     DIPROSES            ditampilkan sebagai "Sedang Disiapkan"
        |
        v
  SIAP DIAMBIL
        |
        v
      SELESAI
```

Penerimaan pesanan langsung memindahkan status ke `diproses`, sehingga penjual
cukup satu tindakan dan pembeli segera melihat pesanannya sedang disiapkan.

Status `diterima` masih ada pada database dan tetap dapat dilanjutkan ke
`diproses`, namun tidak lagi dihasilkan alur baru. Endpoint
`PATCH /api/seller/orders/:id/process` karenanya hanya berguna bagi pesanan lama.

Perpindahan lain, baik melompati tahap maupun mundur ke tahap sebelumnya,
ditolak dengan kode `INVALID_ORDER_STATUS_TRANSITION`.

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
