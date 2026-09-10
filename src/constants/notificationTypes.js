import { ORDER_STATUS, ORDER_STATUS_LABELS } from './orderStatus.js';

/**
 * Jenis notifikasi beserta penyusun isi pesannya.
 * Teks di sini langsung dibaca pengguna, sehingga tidak memuat istilah teknis.
 */

export const NOTIFICATION_TYPES = Object.freeze({
  ORDER_CREATED: 'order_created',
  ORDER_STATUS_CHANGED: 'order_status_changed',
  ORDER_CANCELLED: 'order_cancelled',
});

export const NOTIFICATION_TYPE_VALUES = Object.freeze(Object.values(NOTIFICATION_TYPES));

/** Menyusun pesan untuk pembeli ketika status pesanannya berpindah. */
export function buildBuyerStatusMessage(order, { rejectReason = null } = {}) {
  const nomor = order.order_number ?? order.orderNumber;
  const kantin = order.canteen_name ?? order.canteen?.name ?? 'kantin';

  switch (order.status) {
    case ORDER_STATUS.DIPROSES:
      return {
        title: 'Pesanan sedang disiapkan',
        body: `${kantin} menerima pesanan ${nomor} dan sedang menyiapkannya.`,
      };
    case ORDER_STATUS.SIAP_DIAMBIL:
      return {
        title: 'Pesanan siap diambil',
        body: `Pesanan ${nomor} sudah dapat diambil di ${kantin}. Pembayaran dilakukan saat mengambil.`,
      };
    case ORDER_STATUS.SELESAI:
      return {
        title: 'Pesanan selesai',
        body: `Pesanan ${nomor} telah selesai. Terima kasih sudah memesan di ${kantin}.`,
      };
    case ORDER_STATUS.DITOLAK:
      return {
        title: 'Pesanan ditolak',
        body: rejectReason
          ? `${kantin} menolak pesanan ${nomor}. Alasan: ${rejectReason}`
          : `${kantin} menolak pesanan ${nomor}.`,
      };
    default:
      return {
        title: 'Status pesanan berubah',
        body: `Pesanan ${nomor} kini berstatus ${ORDER_STATUS_LABELS[order.status] ?? order.status}.`,
      };
  }
}

/** Menyusun pesan untuk penjual ketika ada pesanan baru masuk. */
export function buildSellerNewOrderMessage(order, buyerName) {
  const nomor = order.order_number ?? order.orderNumber;
  return {
    title: 'Pesanan baru masuk',
    body: `${buyerName ?? 'Seorang pembeli'} membuat pesanan ${nomor}. Segera konfirmasi.`,
  };
}

/** Menyusun pesan untuk penjual ketika pembeli membatalkan pesanannya. */
export function buildSellerCancelMessage(order, buyerName) {
  const nomor = order.order_number ?? order.orderNumber;
  return {
    title: 'Pesanan dibatalkan',
    body: `${buyerName ?? 'Pembeli'} membatalkan pesanan ${nomor}.`,
  };
}

export default NOTIFICATION_TYPES;
