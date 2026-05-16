import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Served from fbcorp.ai/estimating/ in production. All asset URLs and the
  // OAuth redirect target use this as their prefix.
  base: '/estimating/',
  plugins: [react()],
  optimizeDeps: {
    include: ['pdfjs-dist/build/pdf'],
  },
  worker: {
    format: 'es',
  },
});
