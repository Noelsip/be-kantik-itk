import { toCategoryResponse } from '../utils/presenters.js';
import * as categoryRepository from '../repositories/category.repository.js';

/** Fungsi untuk menyajikan kategori yang dipakai menyaring menu. */
export async function listCategories() {
  const rows = await categoryRepository.findAll();
  return rows.map(toCategoryResponse);
}

/**
 * Membuat kategori baru, atau memakai kembali yang sudah ada.
 *
 * Pencocokan nama mengabaikan besar kecil huruf karena kolom `categories.name`
 * memakai collation utf8mb4_0900_ai_ci, sehingga "Makanan" dan "makanan" tidak
 * pernah menjadi dua kategori berbeda.
 */
export async function createCategory({ name }) {
  const existing = await categoryRepository.findByName(name);
  if (existing) {
    return { category: toCategoryResponse(existing), created: false };
  }

  const created = await categoryRepository.create({ name });
  return { category: toCategoryResponse(created), created: true };
}
