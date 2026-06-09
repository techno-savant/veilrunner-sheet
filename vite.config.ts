import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@lexicon-core': resolve(__dirname, '../lexicon-core/src'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/module.ts'),
      name: 'veilrunnerSheet',
      fileName: 'veilrunner-sheet',
      formats: ['es'],
    },
    outDir: 'dist',
    rollupOptions: { external: [] },
    target: 'es2022',
    minify: false,
    sourcemap: true,
  },
});
