import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 60000, // Integration tests may take longer
    hookTimeout: 60000,
    include: ['**/*.test.ts'],
    globals: true
  }
});

