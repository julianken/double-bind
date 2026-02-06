import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import { flatConfigs as importXFlatConfigs } from 'eslint-plugin-import-x';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // Global ignores
  {
    ignores: ['**/dist/', '**/node_modules/', '**/src-tauri/', '**/*.js'],
  },

  // Base ESLint recommended rules
  eslint.configs.recommended,

  // TypeScript ESLint recommended rules
  ...tseslint.configs.recommended,

  // Import plugin for TypeScript
  importXFlatConfigs.recommended,
  importXFlatConfigs.typescript,

  // Custom import rules
  {
    rules: {
      'import-x/no-cycle': 'error',
    },
  },

  // Project-specific rules
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'packages/*/test/*.ts',
            'packages/*/test/*/*.ts',
            'packages/*/test/*/*/*.ts',
            'packages/*/test/*/*/*/*.ts',
            'packages/*/test/*.tsx',
            'packages/*/test/*/*.tsx',
            'packages/*/test/*/*/*.tsx',
            'packages/*/test/*/*/*/*.tsx',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Warn on console.log - use structured logging in services
      'no-console': 'warn',

      // Enforce explicit types - no any
      '@typescript-eslint/no-explicit-any': 'error',

      // Allow unused vars with underscore prefix (common pattern for intentionally unused)
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },

  // Prettier compatibility (must be last to override conflicting rules)
  eslintConfigPrettier
);
