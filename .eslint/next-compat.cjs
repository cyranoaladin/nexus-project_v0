// Preserve the Next 15 framework gates with the official pinned plugin.
// Its unused monorepo glob dependency is overridden to tinyglobby to avoid
// vulnerable braces. This single-root project MUST leave settings.next.rootDir
// unset; next-lint-gate.test.js enforces that boundary and a real rule sentinel.
// Introducing rootDir globbing requires a tested adapter before changing it.
module.exports = {
  extends: ['plugin:@next/next/core-web-vitals', 'plugin:react/recommended', 'plugin:react-hooks/recommended', 'plugin:@typescript-eslint/recommended'],
  plugins: ['import', 'react', 'jsx-a11y'],
  rules: {
    'import/no-anonymous-default-export': 'warn',
    'react/no-unknown-property': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'jsx-a11y/alt-text': ['warn', { elements: ['img'], img: ['Image'] }],
    'jsx-a11y/aria-props': 'warn',
    'jsx-a11y/aria-proptypes': 'warn',
    'jsx-a11y/aria-unsupported-elements': 'warn',
    'jsx-a11y/role-has-required-aria-props': 'warn',
    'jsx-a11y/role-supports-aria-props': 'warn',
    'react/jsx-no-target-blank': 'off',
    '@typescript-eslint/no-unused-vars': 1,
    '@typescript-eslint/no-unused-expressions': 1,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: { sourceType: 'module' },
  settings: {
    react: { version: 'detect' },
    'import/parsers': { '@typescript-eslint/parser': ['.ts', '.mts', '.cts', '.tsx', '.d.ts'] },
    'import/resolver': {
      node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
      typescript: { alwaysTryTypes: true },
    },
  },
  env: { browser: true, node: true },
};
