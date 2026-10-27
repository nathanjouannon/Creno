import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: { name: 'unit', include: ['src/**/*.test.ts'], setupFiles: ['./tests/setup-env.ts'] },
      },
      {
        // Component rendering tests (Testing Library) run in a simulated browser
        resolve: { alias },
        esbuild: { jsx: 'automatic' },
        test: {
          name: 'components',
          include: ['src/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['./tests/setup-dom.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          setupFiles: ['./tests/setup-env.ts'],
        },
      },
    ],
  },
});
