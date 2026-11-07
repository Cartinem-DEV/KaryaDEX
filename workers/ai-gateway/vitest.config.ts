import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts', 'src/emails/__tests__/**/*.test.ts'],
    testTimeout: 30000,
  },
});