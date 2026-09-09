import { toCategoryResponse } from '../utils/presenters.js';
import * as categoryRepository from '../repositories/category.repository.js';

/** Fungsi untuk menyajikan kategori yang dipakai menyaring menu. */
export async function listCategories() {
  const rows = await categoryRepository.findAll();
  return rows.map(toCategoryResponse);
}
