import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';
import tokensPlugin from '@creno/tokens/eslint';

// Layers go interface -> API -> services -> repositories -> database (docs/conventions.md, section 4).
const forbid = (patterns) => ({
  'no-restricted-imports': ['error', { patterns }],
});

const noRepository = {
  group: ['**/*.repository', '**/*.repository.ts', '**/modules/*/repository*'],
  message: 'Only services may use repositories.',
};
const noService = {
  group: ['**/*.service', '**/*.service.ts'],
  message: 'The interface calls the API, never a service.',
};
const noPrisma = {
  group: ['@prisma/client', '**/prisma/**'],
  message: 'Only repositories may import Prisma.',
};
const noUpperLayer = {
  group: ['@/app/*', '@/components/*', '**/app/api/**'],
  message: 'A lower layer never imports a higher one.',
};
const onlyModuleIndex = {
  group: ['@/modules/*/*', '**/modules/*/*'],
  message: 'Import another module through its index.ts only.',
};

export default tseslint.config(
  { ignores: ['.next/**', 'next-env.d.ts', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { plugins: { '@next/next': nextPlugin }, rules: nextPlugin.configs['core-web-vitals'].rules },
  // ADR-0010: no hardcoded style value in the interface.
  {
    files: ['src/**/*.tsx'],
    plugins: { creno: tokensPlugin },
    rules: { 'creno/no-hardcoded-style': 'error' },
  },
  // Interface: pages and components.
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    ignores: ['src/app/api/**'],
    rules: forbid([noService, noRepository, noPrisma, onlyModuleIndex]),
  },
  // API layer: routes call services only.
  {
    files: ['src/app/api/**/*.ts'],
    rules: forbid([noRepository, noPrisma, onlyModuleIndex]),
  },
  // Services: no upper layer, no Prisma.
  {
    files: ['src/modules/**/*.service.ts'],
    rules: forbid([noUpperLayer, noPrisma, onlyModuleIndex]),
  },
  // Repositories: no upper layer, no service.
  {
    files: ['src/modules/**/*.repository.ts'],
    rules: forbid([noUpperLayer, noService, onlyModuleIndex]),
  },
  // Module index files re-export their own module; cross-module use goes through index.ts.
  {
    files: ['src/modules/**/index.ts'],
    rules: forbid([noUpperLayer]),
  },
);
