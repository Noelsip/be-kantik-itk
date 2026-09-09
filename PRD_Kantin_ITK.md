# Product Requirements Document (PRD)
## Kantin ITK — Aplikasi Pemesanan Kantin Kampus

## 1. Informasi Produk

| Item | Detail |
|---|---|
| Nama Produk | Kantin ITK |
| Platform | Mobile Application |
| Frontend | Flutter |
| Backend | Express.js |
| Database | PostgreSQL/MySQL dapat dipilih |
| Authentication | Google SSO |
| Pengguna | Pembeli dan Penjual |
| Lingkup | Kantin dalam lingkungan ITK |
| Bahasa | Bahasa Indonesia |
| Pembayaran | Offline di lokasi kantin |

---

## 2. Ringkasan Produk

**Kantin ITK** adalah aplikasi mobile untuk mempermudah proses pemesanan makanan dan minuman di lingkungan kampus Institut Teknologi Kalimantan.

Aplikasi memungkinkan pengguna untuk melihat kantin yang tersedia, melihat menu, mencari menu, memasukkan menu ke keranjang, melakukan pemesanan, dan memantau status pesanan tanpa harus melakukan pemesanan langsung di depan kantin.

Penjual menggunakan aplikasi untuk mengelola menu serta menerima dan memproses pesanan.

Sistem **tidak menangani pembayaran secara digital**. Pembeli melakukan pembayaran secara langsung kepada penjual ketika mengambil pesanan.

> **Pesan melalui aplikasi, ambil dan bayar langsung di kantin.**

---

## 3. Latar Belakang Masalah

Proses pemesanan makanan di lingkungan kampus umumnya dilakukan secara langsung.

Pembeli perlu:

1. datang ke kantin;
2. melihat makanan yang tersedia;
3. menanyakan harga;
4. melakukan pemesanan;
5. menunggu makanan diproses;
6. melakukan pembayaran;
7. mengambil makanan.

Pada jam sibuk, proses tersebut dapat menyebabkan antrean dan waktu tunggu.

Dari sisi penjual, pesanan yang datang secara langsung juga lebih sulit dikelola ketika jumlah pembeli meningkat.

Kantin ITK memindahkan proses **pemilihan dan pemesanan** ke aplikasi, sementara aktivitas **pengambilan dan pembayaran** tetap dilakukan secara langsung di kantin.

---

## 4. Problem Statement

### Untuk Pembeli

Pembeli membutuhkan cara yang lebih praktis untuk mengetahui:

- kantin apa saja yang tersedia;
- menu yang tersedia;
- harga menu;
- ketersediaan menu;
- status pesanan.

### Untuk Penjual

Penjual membutuhkan sistem untuk:

- mengelola menu;
- menerima pesanan;
- mengetahui detail pesanan;
- mengubah status pesanan;
- mengetahui pesanan yang siap diambil.

### Masalah Utama

> Belum adanya sistem terintegrasi yang menghubungkan proses pemesanan pembeli dengan pengelolaan pesanan oleh penjual di lingkungan kantin kampus.

---

## 5. Product Goals

1. Mempermudah pembeli menemukan menu kantin.
2. Memungkinkan pembeli melakukan pemesanan melalui aplikasi.
3. Mengurangi proses antrean untuk melakukan pemesanan.
4. Memberikan informasi status pesanan secara jelas.
5. Membantu penjual mengelola pesanan secara terstruktur.
6. Membantu penjual mengelola menu secara mandiri.
7. Memanfaatkan akun Google/ITK untuk autentikasi pengguna.

---

## 6. Non-Goals

Fitur berikut **tidak termasuk dalam MVP**:

- pembayaran online;
- payment gateway;
- GoPay/OVO/DANA/QRIS dalam aplikasi;
- delivery;
- driver;
- live GPS tracking;
- chat pembeli–penjual;
- voucher;
- loyalty point;
- rating/review;
- AI recommendation;
- integrasi kasir;
- laporan keuangan kompleks.

Pembatasan ini menjaga scope proyek tetap realistis untuk tugas pengembangan aplikasi perangkat bergerak.

---

## 7. User Roles

Sistem memiliki dua role utama:

- Pembeli
- Penjual

### 7.1 Pembeli

Pembeli merupakan pengguna yang memesan makanan/minuman.

Pembeli dapat:

- login dengan Google SSO;
- melihat kantin;
- melihat menu;
- mencari menu;
- menyaring menu;
- melihat detail menu;
- menambahkan menu ke keranjang;
- mengubah jumlah menu;
- menghapus menu dari keranjang;
- melakukan checkout;
- melihat status pesanan;
- membatalkan pesanan;
- melihat riwayat pesanan;
- melihat profil;
- mengubah profil.

#### Domain yang diperbolehkan

Pembeli hanya dapat mengakses aplikasi apabila akun Google yang digunakan memiliki email:

```text
@student.itk.ac.id
@lecture.itk.ac.id
@itk.ac.id
```

Contoh:

```text
nama@student.itk.ac.id     → DITERIMA
nama@lecture.itk.ac.id     → DITERIMA
nama@itk.ac.id             → DITERIMA
nama@gmail.com             → DITOLAK
nama@kampuslain.ac.id      → DITOLAK
```

Validasi domain **wajib dilakukan di backend**, bukan hanya di Flutter.

### 7.2 Penjual

Penjual merupakan pengguna yang mengelola kantin.

Penjual dapat:

- login;
- melihat dashboard;
- melihat menu yang dikelola;
- menambahkan menu;
- mengubah menu;
- menghapus menu;
- melihat pesanan masuk;
- menerima pesanan;
- menolak pesanan;
- memproses pesanan;
- menandai pesanan siap diambil;
- menyelesaikan pesanan;
- melihat profil;
- mengubah profil.

#### Otorisasi Penjual

Domain email dan role adalah dua hal berbeda.

Akun dengan `@itk.ac.id` **tidak otomatis menjadi Penjual**.

Role Penjual harus ditentukan oleh sistem melalui data otorisasi, misalnya:

```text
Google SSO
    ↓
Identifikasi email
    ↓
Cari user di database
    ↓
Ambil role
    ├── pembeli
    └── penjual
```

---

## 8. Authentication & Authorization

### 8.1 Google SSO

Tidak tersedia registrasi manual.

Flow:

```text
User
 ↓
Login dengan Google
 ↓
Google Authentication
 ↓
Backend menerima credential/token
 ↓
Validasi identitas
 ↓
Validasi email/domain
 ↓
Cari atau buat user
 ↓
Identifikasi role
 ↓
Generate session/JWT
 ↓
Masuk aplikasi
```

### 8.2 Validasi Domain

Untuk Pembeli:

```text
@student.itk.ac.id
@lecture.itk.ac.id
@itk.ac.id
```

Backend wajib melakukan validasi domain.

Validasi tidak boleh hanya dilakukan pada frontend karena request dapat dibuat langsung ke API.

### 8.3 Authorization

Setelah login, backend menentukan role pengguna.

Contoh:

```text
User
├── id
├── email
├── name
└── role
       ├── pembeli
       └── penjual
```

Endpoint yang membutuhkan autentikasi harus dilindungi middleware.

Contoh:

```text
authenticate()
    ↓
authorize("penjual")
    ↓
controller
```

---

## 9. Core User Journey — Pembeli

```text
Google SSO
    ↓
Validasi akun
    ↓
Home
    ↓
Pilih Kantin
    ↓
Lihat Menu
    ↓
Cari / Filter
    ↓
Lihat Detail
    ↓
Tambah ke Keranjang
    ↓
Keranjang
    ↓
Checkout
    ↓
Pesanan Dibuat
    ↓
Menunggu Konfirmasi
    ↓
Diterima
    ↓
Diproses
    ↓
Siap Diambil
    ↓
Datang ke Kantin
    ↓
Bayar secara langsung
    ↓
Ambil Pesanan
    ↓
Penjual menyelesaikan pesanan
    ↓
Selesai
```

---

## 10. Core User Journey — Penjual

```text
Google SSO
    ↓
Dashboard
    ↓
Pesanan Masuk
    ↓
┌───────────────┐
│               │
▼               ▼
Terima        Tolak
│               │
▼               ▼
Diproses      Selesai
│
▼
Siap Diambil
│
▼
Pembeli datang
│
▼
Pembayaran langsung
│
▼
Selesaikan Pesanan
│
▼
Selesai
```

---

# 11. Functional Requirements — Pembeli

## FR-01 — Masuk dengan Akun Google

Pembeli dapat masuk menggunakan Google SSO.

### Acceptance Criteria

- pengguna dapat memilih akun Google;
- backend memverifikasi identitas;
- sistem memvalidasi domain;
- akun yang tidak memenuhi aturan ditolak;
- pengguna yang valid diarahkan sesuai role;
- pengguna tidak perlu melakukan registrasi manual.

---

## FR-02 — Melihat Daftar Kantin

Pembeli dapat melihat daftar kantin.

Informasi minimal:

- nama kantin;
- lokasi;
- foto;
- status kantin.

Contoh:

```text
Kantin FSTI
Gedung A
Buka
```

---

## FR-03 — Melihat Daftar Menu

Pembeli dapat melihat menu suatu kantin.

Informasi:

- foto;
- nama;
- harga;
- kategori;
- ketersediaan.

---

## FR-04 — Mencari Menu

Pembeli dapat mencari menu berdasarkan nama.

---

## FR-05 — Menyaring Menu

Pembeli dapat menyaring menu berdasarkan kategori.

Contoh:

```text
Semua
Makanan
Minuman
Snack
```

---

## FR-06 — Melihat Detail Menu

Detail menu menampilkan:

- foto;
- nama;
- harga;
- deskripsi;
- kategori;
- status tersedia;
- jumlah;
- tombol tambah ke keranjang.

---

## FR-07 — Menambahkan Menu ke Keranjang

Pembeli dapat menambahkan menu dari:

- daftar menu;
- detail menu.

Pembeli **tidak wajib membuka detail menu terlebih dahulu**.

---

## FR-08 — Mengubah Jumlah Menu

Pembeli dapat menaikkan atau menurunkan quantity.

Contoh:

```text
[-] 1 [+]
```

---

## FR-09 — Menghapus Menu dari Keranjang

Pembeli dapat menghapus item dari keranjang.

---

# 12. Aturan Keranjang

Satu keranjang hanya boleh berisi menu dari **satu kantin**.

Valid:

```text
Kantin A
├── Nasi Goreng
├── Ayam Geprek
└── Es Teh
```

Tidak valid:

```text
Kantin A
├── Nasi Goreng

Kantin B
└── Bakso
```

Jika pembeli mencoba menambahkan menu dari kantin berbeda, sistem menampilkan konfirmasi:

```text
Keranjang berisi menu dari Kantin A.

Apakah Anda ingin mengosongkan
keranjang dan menambahkan menu
dari Kantin B?

[Batal] [Ganti Kantin]
```

---

# 13. FR-10 — Melakukan Checkout

Checkout menampilkan:

- kantin;
- item;
- quantity;
- harga;
- subtotal;
- total;
- catatan pesanan;
- informasi pengambilan.

Tidak ada pilihan pembayaran online.

Tampilkan informasi:

> **Pembayaran dilakukan langsung di kantin saat mengambil pesanan.**

Tombol:

> **Konfirmasi Pesanan**

Setelah dikonfirmasi, sistem membuat Order.

---

# 14. Order

Setiap order memiliki:

- nomor pesanan;
- pembeli;
- kantin;
- item;
- total;
- catatan;
- status;
- waktu dibuat.

Contoh:

```text
#ORD-20260910-001

Kantin FSTI

2 × Nasi Goreng
1 × Es Teh

Total
Rp35.000

Status
Menunggu Konfirmasi
```

---

# 15. Order Status

Status resmi:

```text
MENUNGGU KONFIRMASI
DITERIMA
DITOLAK
DIPROSES
SIAP DIAMBIL
SELESAI
DIBATALKAN
```

Lifecycle normal:

```text
Menunggu Konfirmasi
        ↓
     Diterima
        ↓
     Diproses
        ↓
   Siap Diambil
        ↓
      Selesai
```

Alternative:

```text
Menunggu Konfirmasi
        ↓
      Ditolak
```

atau:

```text
Menunggu Konfirmasi
        ↓
    Dibatalkan
```

---

# 16. FR-11 — Melihat Status Pesanan

Pembeli dapat melihat status pesanan melalui timeline.

```text
✓ Pesanan Dibuat

✓ Pesanan Diterima

● Sedang Diproses

○ Siap Diambil

○ Selesai
```

Ketika status `SIAP DIAMBIL`, tampilkan:

> **Pesanan siap diambil.**

> Silakan datang ke kantin dan lakukan pembayaran saat mengambil pesanan.

---

# 17. FR-12 — Membatalkan Pesanan

Pembeli dapat membatalkan pesanan hanya ketika status memenuhi aturan pembatalan.

Rekomendasi:

```text
Menunggu Konfirmasi → boleh
Diterima             → tidak
Diproses             → tidak
Siap Diambil         → tidak
Selesai              → tidak
Ditolak              → tidak
Dibatalkan           → tidak
```

Konfirmasi:

```text
Batalkan pesanan?

[Batal] [Ya, Batalkan]
```

---

# 18. FR-13 — Melihat Riwayat Pesanan

Pembeli dapat melihat pesanan:

- selesai;
- ditolak;
- dibatalkan.

---

# 19. FR-14 — Melihat Profil

Profil menampilkan:

- foto;
- nama;
- email;
- role.

---

# 20. FR-15 — Mengubah Profil

Pengguna dapat mengubah informasi profil yang diizinkan.

Email Google tidak boleh diedit sebagai email biasa karena merupakan identitas autentikasi.

---

# 21. Functional Requirements — Penjual

## FR-16 — Melihat Dashboard Penjual

Dashboard menampilkan:

```text
Pesanan Baru       5
Diproses           3
Siap Diambil       2
```

serta daftar pesanan terbaru.

---

## FR-17 — Melihat Daftar Menu yang Dikelola

Penjual dapat melihat seluruh menu milik kantinnya.

---

## FR-18 — Menambahkan Menu

Field:

- nama;
- foto;
- kategori;
- harga;
- deskripsi;
- ketersediaan.

---

## FR-19 — Mengubah Menu

Penjual dapat mengubah:

- nama;
- foto;
- kategori;
- harga;
- deskripsi;
- ketersediaan.

Catatan: ketersediaan menu tetap menjadi field dalam pengelolaan menu, bukan use case terpisah.

---

## FR-20 — Menghapus Menu

Penjual dapat menghapus menu.

Sistem meminta konfirmasi sebelum penghapusan.

---

# 22. Order Management — Penjual

## FR-21 — Melihat Pesanan Masuk

Penjual melihat:

- nomor pesanan;
- nama pembeli;
- waktu;
- item;
- quantity;
- catatan;
- total;
- status.

---

## FR-22 — Menerima Pesanan

Status:

```text
Menunggu Konfirmasi
        ↓
     Diterima
```

---

## FR-23 — Menolak Pesanan

Penjual dapat menolak pesanan.

Alasan dapat berupa:

- stok habis;
- kantin tutup;
- tidak dapat memenuhi pesanan;
- lainnya.

Status:

```text
Menunggu Konfirmasi
        ↓
      Ditolak
```

---

## FR-24 — Memproses Pesanan

```text
Diterima
   ↓
Diproses
```

Penjual mulai menyiapkan makanan.

---

## FR-25 — Menandai Pesanan Siap Diambil

Setelah makanan selesai:

```text
Diproses
   ↓
Siap Diambil
```

Pembeli mendapatkan informasi bahwa pesanan sudah dapat diambil.

---

## FR-26 — Menyelesaikan Pesanan

Flow:

```text
Siap Diambil
      ↓
Pembeli datang
      ↓
Penjual menyerahkan pesanan
      ↓
Pembeli membayar langsung
      ↓
Penjual memastikan pembayaran
      ↓
Penjual menekan "Selesaikan Pesanan"
      ↓
Selesai
```

Sistem **tidak menyimpan transaksi pembayaran**.

---

# 23. Business Rules

### BR-01 — Authentication

Semua pengguna harus melalui Google SSO.

### BR-02 — Pembeli Domain

Pembeli hanya diperbolehkan menggunakan:

```text
@student.itk.ac.id
@lecture.itk.ac.id
@itk.ac.id
```

### BR-03 — Server-side Validation

Validasi domain wajib dilakukan di backend Express.js.

### BR-04 — Role

Role pengguna tidak ditentukan hanya berdasarkan domain.

### BR-05 — No Manual Registration

Tidak tersedia fitur register manual.

### BR-06 — One Cart, One Canteen

Satu keranjang hanya berasal dari satu kantin.

### BR-07 — Menu Availability

Menu yang tidak tersedia tidak boleh ditambahkan ke keranjang.

### BR-08 — Price Snapshot

Harga pada `order_items` disimpan sebagai snapshot harga ketika order dibuat.

### BR-09 — Offline Payment

Pembayaran dilakukan secara langsung di lokasi kantin.

### BR-10 — No Payment Record

Sistem tidak menyimpan transaksi pembayaran digital.

### BR-11 — Order Completion

Hanya Penjual yang berwenang yang dapat menyelesaikan order.

### BR-12 — Seller Ownership

Penjual hanya dapat mengelola:

- kantin miliknya;
- menu kantinnya;
- order yang masuk ke kantinnya.

### BR-13 — Cancellation

Pembeli tidak dapat membatalkan pesanan setelah masuk tahap yang tidak memungkinkan pembatalan.

---

# 24. Arsitektur Sistem

```text
┌─────────────────────┐
│    Flutter Mobile   │
│                     │
│ Buyer UI            │
│ Seller UI           │
└──────────┬──────────┘
           │
           │ HTTPS / REST API
           ▼
┌─────────────────────┐
│     Express.js      │
│                     │
│ Authentication      │
│ Authorization       │
│ User                │
│ Canteen             │
│ Menu                │
│ Cart                │
│ Order               │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│      Database       │
│                     │
│ Users               │
│ Canteens            │
│ Categories          │
│ Menu Items          │
│ Carts               │
│ Cart Items          │
│ Orders              │
│ Order Items         │
└─────────────────────┘

           ▲
           │
           │ Google SSO
           ▼
┌─────────────────────┐
│    Google OAuth     │
└─────────────────────┘
```

---

# 25. Backend Express.js

Struktur API konseptual:

```text
/api/auth
/api/users
/api/canteens
/api/categories
/api/menu
/api/cart
/api/orders
/api/seller
```

Contoh endpoint:

```text
POST   /api/auth/google
GET    /api/me

GET    /api/canteens
GET    /api/canteens/:id
GET    /api/canteens/:id/menu

GET    /api/menu
GET    /api/menu/:id

GET    /api/cart
POST   /api/cart/items
PATCH  /api/cart/items/:id
DELETE /api/cart/items/:id

POST   /api/orders
GET    /api/orders
GET    /api/orders/:id
PATCH  /api/orders/:id/cancel

GET    /api/seller/orders
PATCH  /api/seller/orders/:id/accept
PATCH  /api/seller/orders/:id/reject
PATCH  /api/seller/orders/:id/process
PATCH  /api/seller/orders/:id/ready
PATCH  /api/seller/orders/:id/complete

GET    /api/seller/menu
POST   /api/seller/menu
PATCH  /api/seller/menu/:id
DELETE /api/seller/menu/:id
```

Endpoint final dapat disederhanakan saat implementasi.

---

# 26. Database

Entitas utama:

```text
users
canteens
categories
menu_items
carts
cart_items
orders
order_items
```

Relasi:

```text
USER
 ├────< CANTEEN
 ├────  CART
 └────< ORDER

CANTEEN
 └────< MENU_ITEM

CATEGORY
 └────< MENU_ITEM

CART
 └────< CART_ITEM
             │
             └──── MENU_ITEM

ORDER
 └────< ORDER_ITEM
             │
             └──── MENU_ITEM
```

Tidak ada tabel:

```text
payments
payment_methods
payment_transactions
delivery
drivers
```

karena fitur tersebut berada di luar scope.

---

# 27. Navigation — Pembeli

Bottom navigation:

```text
Home | Explore | Orders | Profile
```

Keranjang dapat ditampilkan sebagai icon pada AppBar atau floating cart indicator.

### Home

- greeting;
- search;
- daftar kantin;
- kategori;
- menu populer.

### Explore

- pencarian;
- filter;
- daftar menu/kantin.

### Orders

- pesanan aktif;
- riwayat.

### Profile

- profil;
- informasi akun;
- logout.

---

# 28. Navigation — Penjual

Bottom navigation:

```text
Dashboard | Orders | Menu | Profile
```

### Dashboard

- ringkasan order;
- order baru;
- order aktif.

### Orders

- pending;
- processing;
- ready;
- completed.

### Menu

- daftar menu;
- tambah;
- edit;
- delete.

### Profile

- data akun;
- logout.

---

# 29. Screen Requirements

## Authentication

1. Splash
2. Login Google
3. Unauthorized Account

## Pembeli

4. Home
5. Canteen List
6. Canteen Detail
7. Menu List
8. Search
9. Filter
10. Menu Detail
11. Cart
12. Checkout
13. Order Success
14. Active Order
15. Order Detail
16. Order History
17. Cancel Confirmation
18. Profile
19. Edit Profile

## Penjual

20. Seller Dashboard
21. Order List
22. Order Detail
23. Order Status
24. Menu List
25. Add Menu
26. Edit Menu
27. Delete Confirmation
28. Profile
29. Edit Profile

Tidak semua screen harus menjadi route terpisah. Dialog, bottom sheet, dan state dapat digunakan untuk beberapa fungsi.

---

# 30. UX untuk Order Status

Status pesanan merupakan elemen visual utama.

Contoh:

```text
┌──────────────────────────────┐
│ Pesanan #ORD-1024            │
│ Kantin FSTI                  │
│                              │
│       SIAP DIAMBIL           │
│                              │
│ ✓ Pesanan dibuat             │
│ │                            │
│ ✓ Pesanan diterima           │
│ │                            │
│ ✓ Sedang diproses            │
│ │                            │
│ ● Siap diambil               │
│ │                            │
│ ○ Selesai                    │
│                              │
│ Datang ke kantin untuk       │
│ mengambil pesanan.           │
│                              │
│ Pembayaran dilakukan         │
│ langsung di kantin.          │
└──────────────────────────────┘
```

---

# 31. Empty States

### Cart Kosong

> Keranjang masih kosong  
> Yuk cari makanan favoritmu.

### Tidak Ada Pesanan

> Belum ada pesanan  
> Pesanan yang kamu lakukan akan muncul di sini.

### Menu Kosong

> Belum ada menu  
> Penjual belum menambahkan menu ke kantin ini.

### Seller Menu Kosong

> Belum ada menu  
> Tambahkan menu pertama untuk mulai menerima pesanan.

---

# 32. Error States

Contoh:

> **Gagal memuat menu**  
> Periksa koneksi internet dan coba lagi.

Tombol:

> **Coba Lagi**

Jangan menampilkan error teknis seperti `500 Internal Server Error` langsung kepada pengguna.

---

# 33. Loading States

Skeleton/loading state digunakan ketika:

- daftar kantin dimuat;
- daftar menu dimuat;
- detail menu dimuat;
- order dimuat;
- dashboard seller dimuat.

---

# 34. Notification

Event penting:

```text
Pesanan diterima
Pesanan ditolak
Pesanan mulai diproses
Pesanan siap diambil
Pesanan selesai
```

Contoh:

> Pesanan #ORD-1024 siap diambil di Kantin FSTI.

Untuk MVP, notification dapat dimulai dengan in-app state atau refresh API. Firebase Cloud Messaging dapat ditambahkan sebagai enhancement.

---

# 35. Security Requirements

## Authentication

Google digunakan sebagai Identity Provider.

## Authorization

Backend menentukan role pengguna.

## Domain Restriction

Backend memvalidasi email pengguna.

## API Protection

Endpoint yang membutuhkan autentikasi harus dilindungi middleware.

Contoh:

```text
authenticate()
    ↓
authorize("penjual")
    ↓
controller
```

## Ownership

Penjual tidak boleh mengubah menu milik penjual lain hanya dengan mengganti ID pada URL.

Backend harus memastikan bahwa resource memang dimiliki atau berada di bawah otorisasi user tersebut.

---

# 36. Performance Requirements

Target MVP:

- halaman utama dapat dimuat dengan cepat;
- gambar menu dikompresi;
- API menggunakan pagination untuk daftar panjang;
- database menggunakan index pada field penting;
- loading state tersedia;
- aplikasi tetap usable ketika koneksi lambat.

---

# 37. Usability Requirements

Pembeli harus dapat melakukan:

```text
Login
→ pilih kantin
→ pilih menu
→ tambah keranjang
→ checkout
```

dengan jumlah interaksi seminimal mungkin.

Informasi yang paling penting:

1. nama makanan;
2. harga;
3. ketersediaan;
4. jumlah;
5. total;
6. status pesanan.

---

# 38. MVP

## Authentication

- Google SSO;
- domain validation;
- role-based access.

## Pembeli

- Home;
- Kantin;
- Menu;
- Search;
- Filter;
- Detail menu;
- Cart;
- Checkout;
- Order status;
- Cancel order;
- Order history;
- Profile.

## Penjual

- Dashboard;
- Menu CRUD;
- Order list;
- Accept;
- Reject;
- Process;
- Ready;
- Complete;
- Profile.

---

# 39. Fitur di Luar MVP

Jika waktu memungkinkan, fitur berikut dapat dipertimbangkan:

- favorite menu;
- favorite kantin;
- notification push;
- promo;
- statistik penjualan;
- dark mode;
- reorder;
- QR pickup.

Fitur tersebut tidak menjadi requirement utama.

---

# 40. Prioritas Pengembangan

## Phase 1 — Foundation

- Flutter project;
- Express.js project;
- database;
- Google SSO;
- authentication middleware;
- role authorization.

## Phase 2 — Buyer

- canteen;
- menu;
- search;
- filter;
- cart;
- checkout;
- order.

## Phase 3 — Seller

- seller dashboard;
- menu CRUD;
- order management;
- order status.

## Phase 4 — Polish

- loading state;
- error handling;
- empty state;
- validation;
- UI refinement;
- notification;
- testing.

---

# 41. Definition of Done

Fitur dianggap selesai apabila:

1. UI Flutter telah dibuat.
2. API Express.js tersedia.
3. Flutter dapat berkomunikasi dengan API.
4. Database menyimpan data dengan benar.
5. Google SSO berjalan.
6. Domain pengguna divalidasi.
7. Role pengguna diterapkan.
8. Unauthorized access ditolak.
9. Error state ditangani.
10. Happy path berhasil dari awal sampai akhir.

### Happy Path Order

```text
Pembeli login
    ↓
Pilih kantin
    ↓
Pilih menu
    ↓
Tambah keranjang
    ↓
Checkout
    ↓
Order masuk
    ↓
Penjual menerima
    ↓
Penjual memproses
    ↓
Penjual menandai siap
    ↓
Pembeli mengambil + membayar
    ↓
Penjual menyelesaikan
    ↓
Order selesai
```

---

# 42. Use Case Final

| ID | Use Case | Aktor |
|---|---|---|
| UC-01 | Masuk dengan Akun Kampus | Pembeli, Penjual |
| UC-02 | Melihat Daftar Kantin | Pembeli |
| UC-03 | Melihat Daftar Menu | Pembeli |
| UC-04 | Mencari Menu | Pembeli |
| UC-05 | Menyaring Menu | Pembeli |
| UC-06 | Melihat Detail Menu | Pembeli |
| UC-07 | Menambahkan Menu ke Keranjang | Pembeli |
| UC-08 | Mengubah Jumlah Menu | Pembeli |
| UC-09 | Menghapus Menu dari Keranjang | Pembeli |
| UC-10 | Melakukan Checkout | Pembeli |
| UC-11 | Melihat Status Pesanan | Pembeli |
| UC-12 | Membatalkan Pesanan | Pembeli |
| UC-13 | Melihat Riwayat Pesanan | Pembeli |
| UC-14 | Melihat Profil | Pembeli, Penjual |
| UC-15 | Mengubah Profil | Pembeli, Penjual |
| UC-16 | Melihat Dasbor Penjual | Penjual |
| UC-17 | Melihat Daftar Menu yang Dikelola | Penjual |
| UC-18 | Menambahkan Menu | Penjual |
| UC-19 | Mengubah Menu | Penjual |
| UC-20 | Menghapus Menu | Penjual |
| UC-21 | Melihat Pesanan Masuk | Penjual |
| UC-22 | Menerima Pesanan | Penjual |
| UC-23 | Menolak Pesanan | Penjual |
| UC-24 | Memproses Pesanan | Penjual |
| UC-25 | Menandai Pesanan Siap Diambil | Penjual |
| UC-26 | Menyelesaikan Pesanan | Penjual |

**Catatan:** Tidak ada use case pembayaran karena pembayaran dilakukan secara offline di lokasi kantin dan berada di luar sistem.
