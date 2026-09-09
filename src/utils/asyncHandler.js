/**
 * Pembungkus handler asinkron agar kesalahan yang terjadi diteruskan ke
 * penanganan kesalahan terpusat, bukan menjadi rejection yang tidak tertangani.
 */
export function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export default asyncHandler;
