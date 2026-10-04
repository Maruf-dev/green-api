import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite 4 (совместим с Node >= 16.14, который стоит в окружении).
// Запросы к /api проксируются на локальный сервер Telegram Bot API (server.mjs).
// Для варианта MAX (GREEN-API) прокси не нужен — запросы идут напрямую из браузера.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
});