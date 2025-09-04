import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'lib/**/*.spec.ts',
      'apps/**/server/**/*.unit.spec.ts',
    ],
    exclude: [
      'e2e/**',
      '__tests__/**',
      'node_modules/**'
    ],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
});
