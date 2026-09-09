export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * Perapian nilai halaman dan batas data menjadi bilangan bulat yang aman.
 *
 * MySQL tidak menerima parameter terikat pada klausa LIMIT dan OFFSET, sehingga
 * kedua angka inilah satu-satunya nilai yang disisipkan langsung ke teks SQL.
 * Pembulatan dan pembatasan di sini yang menjaga penyisipan tersebut tetap aman.
 */
export function resolvePagination({ page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = {}) {
  const safePage = Math.max(1, Math.trunc(Number(page)) || DEFAULT_PAGE);
  const requestedLimit = Math.trunc(Number(limit)) || DEFAULT_LIMIT;
  const safeLimit = Math.min(MAX_LIMIT, Math.max(1, requestedLimit));

  return {
    page: safePage,
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  };
}

export default resolvePagination;
