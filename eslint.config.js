// Flat ESLint config covering both apps from the repo root:
//   • backend/  + tools/  → CommonJS, Node globals
//   • frontend/           → ES modules + JSX, browser globals, React hooks rules
// Run with `npm run lint` (or `npm run lint:fix`). Correctness rules are errors;
// unused-vars / empty-blocks are warnings so the signal stays actionable.
const js = require('@eslint/js');
const globals = require('globals');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');

const unusedVars = ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }];

module.exports = [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      'frontend/dist/**',
      'backend/storage/**',
      'tools/shots/**',
      'tools/node_modules/**',
      '.source/**', // the reference PHP/Laravel app (vendored JS) — not our code
      'backend/scripts/_qa_*', // throwaway live-validation harnesses, not shipped code
      '**/*.min.js',
    ],
  },

  js.configs.recommended,

  // ── Backend: CommonJS, Node ──
  {
    files: ['backend/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': unusedVars,
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-console': 'off',
    },
  },

  // ── Tooling (Playwright/CLI): CJS, Node + browser (page.evaluate callbacks) ──
  {
    files: ['tools/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-unused-vars': unusedVars, 'no-empty': ['warn', { allowEmptyCatch: true }], 'no-console': 'off' },
  },
  {
    files: ['tools/**/*.mjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-unused-vars': unusedVars, 'no-console': 'off' },
  },

  // ── Frontend: ES modules + JSX, browser ──
  {
    files: ['frontend/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      'react/jsx-uses-vars': 'error', // don't flag components referenced only in JSX
      'react/jsx-uses-react': 'off', // React 17+ automatic runtime
      'react-hooks/rules-of-hooks': 'error',
      // Advisory rule, off by project decision: the pages use a deliberate mount-load
      // pattern (`useEffect(load, [])`) and the i18n `t`/store callbacks are stable, so the
      // dozens of flags here are intentional, not bugs. rules-of-hooks (the bug-catcher) stays on.
      'react-hooks/exhaustive-deps': 'off',
      'no-unused-vars': unusedVars,
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },

  // ── Root ESLint config is CommonJS ──
  {
    files: ['eslint.config.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
  },
  // ── Frontend build configs (vite/tailwind/postcss): ESM, run in Node ──
  {
    files: ['frontend/*.config.{js,cjs,mjs}'],
    languageOptions: { sourceType: 'module', globals: { ...globals.node } },
  },
];
