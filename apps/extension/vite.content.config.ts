import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@sara/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@sara/site-adapters': path.resolve(__dirname, '../../packages/site-adapters/src/index.ts'),
      '@sara/recommendation-engine': path.resolve(__dirname, '../../packages/recommendation-engine/src/index.ts')
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'src/content/index.ts'),
      name: 'SaraContent',
      formats: ['iife'],
      fileName: () => 'content.js'
    }
  }
});
