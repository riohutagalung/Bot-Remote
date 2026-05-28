import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Konfigurasi Vite utama
export default defineConfig({
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