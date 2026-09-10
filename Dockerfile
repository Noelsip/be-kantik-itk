# Citra produksi Kantin ITK API.
# Tahap pertama memasang dependensi produksi saja, tahap kedua menyalin hasilnya
# agar citra akhir tidak membawa perkakas pembangunan.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app

# Menjalankan aplikasi sebagai pengguna biasa bawaan citra Node.
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node database ./database

# Direktori unggahan dibuat lebih dulu agar dapat ditulis pengguna node,
# dan isinya dipertahankan lewat volume pada berkas compose.
RUN mkdir -p /app/uploads && chown node:node /app/uploads

USER node
EXPOSE 3000

# Pemeriksaan kesehatan memakai jalur terbuka yang tidak memerlukan proses masuk.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
