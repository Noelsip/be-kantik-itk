/**
 * Status pesanan sekaligus sumber tunggal aturan perpindahan statusnya.
 *
 * Nilai yang disimpan dan dikirim melalui API memakai huruf kecil, sama seperti
 * ENUM di database. Bentuk huruf besar hanya dipakai pada pesan untuk pengguna.
 */
export const ORDER_STATUS = Object.freeze({
  MENUNGGU_KONFIRMASI: 'menunggu_konfirmasi',
  DITERIMA: 'diterima',
  DITOLAK: 'ditolak',
  DIPROSES: 'diproses',
  SIAP_DIAMBIL: 'siap_diambil',
  SELESAI: 'selesai',
  DIBATALKAN: 'dibatalkan',
});

export const ORDER_STATUS_VALUES = Object.freeze(Object.values(ORDER_STATUS));

/** Nama status dalam bentuk yang siap ditampilkan. */
export const ORDER_STATUS_LABELS = Object.freeze({
  [ORDER_STATUS.MENUNGGU_KONFIRMASI]: 'Menunggu Konfirmasi',
  [ORDER_STATUS.DITERIMA]: 'Diterima',
  [ORDER_STATUS.DITOLAK]: 'Ditolak',
  [ORDER_STATUS.DIPROSES]: 'Diproses',
  [ORDER_STATUS.SIAP_DIAMBIL]: 'Siap Diambil',
  [ORDER_STATUS.SELESAI]: 'Selesai',
  [ORDER_STATUS.DIBATALKAN]: 'Dibatalkan',
});

/**
 * Perpindahan status yang diizinkan.
 * Perpindahan di luar daftar ini selalu ditolak.
 */
export const ORDER_STATUS_TRANSITIONS = Object.freeze({
  [ORDER_STATUS.MENUNGGU_KONFIRMASI]: Object.freeze([
    ORDER_STATUS.DITERIMA,
    ORDER_STATUS.DITOLAK,
    ORDER_STATUS.DIBATALKAN,
  ]),
  [ORDER_STATUS.DITERIMA]: Object.freeze([ORDER_STATUS.DIPROSES]),
  [ORDER_STATUS.DIPROSES]: Object.freeze([ORDER_STATUS.SIAP_DIAMBIL]),
  [ORDER_STATUS.SIAP_DIAMBIL]: Object.freeze([ORDER_STATUS.SELESAI]),
  [ORDER_STATUS.DITOLAK]: Object.freeze([]),
  [ORDER_STATUS.SELESAI]: Object.freeze([]),
  [ORDER_STATUS.DIBATALKAN]: Object.freeze([]),
});

/** Status yang masih memungkinkan pembeli membatalkan pesanannya. */
export const BUYER_CANCELLABLE_STATUSES = Object.freeze([ORDER_STATUS.MENUNGGU_KONFIRMASI]);

/** Status yang termasuk kelompok riwayat pesanan. */
export const ORDER_HISTORY_STATUSES = Object.freeze([
  ORDER_STATUS.SELESAI,
  ORDER_STATUS.DITOLAK,
  ORDER_STATUS.DIBATALKAN,
]);

/** Status yang termasuk kelompok pesanan berjalan. */
export const ORDER_ACTIVE_STATUSES = Object.freeze([
  ORDER_STATUS.MENUNGGU_KONFIRMASI,
  ORDER_STATUS.DITERIMA,
  ORDER_STATUS.DIPROSES,
  ORDER_STATUS.SIAP_DIAMBIL,
]);

/** Menandai status akhir yang tidak punya perpindahan lanjutan. */
export function isTerminalStatus(status) {
  return ORDER_STATUS_TRANSITIONS[status]?.length === 0;
}

/** Memeriksa apakah perpindahan dari satu status ke status lain diizinkan. */
export function canTransition(from, to) {
  const allowed = ORDER_STATUS_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/** Mengubah status menjadi bentuk huruf besar untuk pesan pengguna. */
export function formatStatus(status) {
  return (ORDER_STATUS_LABELS[status] ?? status).toUpperCase();
}

export default ORDER_STATUS;
