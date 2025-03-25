import { defineConfig } from 'vite';
import path from 'path';
import tsconfigPaths from 'vite-tsconfig-paths'
import dts from 'vite-plugin-dts'

// Vite configuration for library development
export default defineConfig({
  plugins: [tsconfigPaths(), dts()], // Use TypeScript paths plugin
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'), // Entry point for the library
      name: 'SdkBuilder',                            // Global variable for UMD build
      formats: ['es', 'cjs'],                 // Output formats
      fileName: (format) => {
        return format === 'es' ? 'index.es.js' : 'index.js';
      }
    },
    rollupOptions: {
      external: ['ioredis', 'cross-fetch', 'util'], // Mark dependencies as external
      output: {
        globals: {
          'cross-fetch': 'fetch',           // Use fetch in the browser
          'ioredis': 'Redis',               // Global for Redis in Node.js
        },
      },
    },
    sourcemap: false,                           // Enable source maps for debugging
    emptyOutDir: true,                         // Clean output directory before building
  },
  resolve: {
    alias: {
      '@api': path.resolve(__dirname, 'src/api'),
      '@cache': path.resolve(__dirname, 'src/cache'),
      '@transformers': path.resolve(__dirname, 'src/transformers'),
    },
  }
});
