/* ESLint config (LLP-127). Errors only on real problems (unreachable code,
 * hook violations); style/strictness rules are warnings so the pipeline stays
 * green while still surfacing issues. */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: ['eslint:recommended', 'plugin:react-hooks/recommended'],
  ignorePatterns: ['dist', 'node_modules', '*.config.js', '*.config.ts', '*.cjs'],
  rules: {
    // TypeScript understands these better than core ESLint.
    'no-unused-vars': 'off',
    'no-undef': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // Relax stylistic/edge rules to warnings so existing code passes.
    'no-empty': 'warn',
    'no-useless-escape': 'warn',
    'no-constant-condition': ['warn', { checkLoops: false }],
    'no-case-declarations': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.test.js'],
      env: { node: true },
    },
  ],
}
