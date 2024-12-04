import { defineConfig } from 'vite';
import path from 'path';
import tsconfigPaths from 'vite-tsconfig-paths'

// Vite configuration for library development
export default defineConfig({
  plugins: [tsconfigPaths()], // Use TypeScript paths plugin
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'), // Entry point for the library
      name: 'SdkBuilder',                            // Global variable for UMD build
      formats: ['es', 'cjs', 'umd'],                 // Output formats
      fileName: (format) => `sdk-builder.${format}.js`, // Output file naming
    },
    rollupOptions: {
      external: ['ioredis', 'cross-fetch'], // Mark dependencies as external
      output: {
        globals: {
          'cross-fetch': 'fetch',           // Use fetch in the browser
          'ioredis': 'Redis',               // Global for Redis in Node.js
        },
      },
    },
    sourcemap: true,                           // Enable source maps for debugging
    emptyOutDir: true,                         // Clean output directory before building
  },
  resolve: {
    alias: {
      '@api': path.resolve(__dirname, 'src/api'),
      '@cache': path.resolve(__dirname, 'src/cache'),
      '@transformers': path.resolve(__dirname, 'src/transformers'),
    },
  },
  server: {
    open: true,                                // Open browser on dev server start
    port: 3000,                                // Dev server port
  },
});
