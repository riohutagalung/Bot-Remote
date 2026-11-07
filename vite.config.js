import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Konfigurasi Vite utama
export default defineConfig({
  server: { proxy: { '/api': 'http://localhost:8080', '/': { target: 'ws://localhost:8080', ws: true, bypass(req) { if (req.headers.upgrade !== 'websocket') return req.url; } } } },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'react-vendor';
            if (id.includes('lucide-react')) return 'icons-vendor';
            return 'vendor'; // sisa library lainnya
          }
        },
      },
    },
  },
});