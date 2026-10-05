// Local replacement for `next/core-web-vitals` + `next/typescript` (eslint-config-next 15.5.25), minus
// `plugin:@next/next/*`. Reason: @next/eslint-plugin-next depends on fast-glob 3.3.1 -> micromatch -> braces,
// and braces <= 3.0.3 (GHSA-vfj7-8cjw-p6xm) has no patched release. Rules, plugins, settings and parser options
// below are copied from eslint-config-next@15.5.25 (index.js, typescript.js), so the other findings are unchanged.
module.exports = {
  extends: ['plugin:react/recommended', 'plugin:react-hooks/recommended', 'plugin:@typescript-eslint/recommended'],
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
