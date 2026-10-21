import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: './tests/globalSetup.js',
    setupFiles: './tests/setup.js',
    // The first run downloads MongoDB, which can take a while.
    hookTimeout: 120_000,
  },
});
