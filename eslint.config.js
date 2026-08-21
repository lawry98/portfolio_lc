import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier/flat';

export default defineConfig(
  globalIgnores(['dist', 'node_modules', '.superpowers']),
  js.configs.recommended,
  tseslint.configs.recommended,
  // Must stay last: disables stylistic rules that would conflict with Prettier.
  eslintConfigPrettier,
);
