/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import * as fs from 'fs';
import * as path from 'path';

// Plugin to copy config files from root to public
const copyConfigFilesPlugin = {
  name: 'copy-config-files',
  apply: 'build' as const,
  async closeBundle() {
    const rootDir = path.resolve(__dirname, '../../..');
    const publicDir = path.resolve(__dirname, './public');

    // Files to copy from root to public
    const filesToCopy = [
      'docker-compose.yml',
      'config/servicebus-config.json',
    ];

    for (const file of filesToCopy) {
      const srcPath = path.join(rootDir, file);
      const destPath = path.join(publicDir, path.basename(file));

      try {
        // Ensure directory exists
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        // Copy file
        fs.copyFileSync(srcPath, destPath);
        console.log(`✓ Copied ${file} to public/`);
      } catch (error) {
        console.warn(`⚠ Could not copy ${file}:`, error instanceof Error ? error.message : error);
      }
    }
  },
};

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/monitor',
  server: {
    port: 4200,
    host: 'localhost',
  },
  preview: {
    port: 4200,
    host: 'localhost',
  },
  plugins: [react(), tailwindcss(), nxViteTsPaths(), copyConfigFilesPlugin],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  optimizeDeps: {
    exclude: ['ssh2', 'cpu-features'],
  },
  test: {
    projects: [{ extends: './vitest.config.mts' }],
    name: '@e2e-monitor/monitor',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
