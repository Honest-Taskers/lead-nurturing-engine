import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    // DB-backed integration tests share one pool; keep them in one process.
    fileParallelism: false,
  },
});
