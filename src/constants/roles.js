/**
 * Peran pengguna dalam sistem, hanya ada dua.
 * Peran selalu dibaca dari baris pengguna di database, bukan dari permintaan.
 */
export const ROLES = Object.freeze({
  PEMBELI: 'pembeli',
  PENJUAL: 'penjual',
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

/** Nama peran dalam bentuk yang siap ditampilkan di antarmuka. */
export const ROLE_LABELS = Object.freeze({
  [ROLES.PEMBELI]: 'Pembeli',
  [ROLES.PENJUAL]: 'Penjual',
});

export default ROLES;
