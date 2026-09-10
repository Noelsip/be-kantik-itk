import config from '../config/env.js';

/**
 * Pencatat log sederhana dengan tingkat keparahan dan penanda waktu.
 * Dibuat tanpa pustaka tambahan; penggantian cukup menyentuh berkas ini.
 */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const activeLevel = config.isTest ? LEVELS.error : config.isProduction ? LEVELS.info : LEVELS.debug;

function emit(level, stream, args) {
  if (LEVELS[level] > activeLevel) return;
  const timestamp = new Date().toISOString();
  // eslint-disable-next-line no-console
  console[stream](`[${timestamp}] [${level.toUpperCase()}]`, ...args);
}

export const logger = {
  error: (...args) => emit('error', 'error', args),
  warn: (...args) => emit('warn', 'warn', args),
  info: (...args) => emit('info', 'log', args),
  debug: (...args) => emit('debug', 'log', args),
};

export default logger;
