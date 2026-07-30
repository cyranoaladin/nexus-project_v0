import { defineConfig, globalIgnores } from 'eslint/config';
import eslintReact from '@eslint-react/eslint-plugin';
import nextPlugin from '@next/eslint-plugin-next';
import importX from 'eslint-plugin-import-x';
import jsxA11yModule from 'eslint-plugin-jsx-a11y-x';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const jsxA11y = jsxA11yModule.default ?? jsxA11yModule;
const typescriptRecommended = tseslint.configs.recommended.map((config) => ({
  ...config,
  files: ['**/*.{ts,tsx}'],
}));

export default defineConfig([
  globalIgnores([
    '.artifacts/**',
    '.next/**',
    'assets/**',
    'coverage/**',
    'node_modules/**',
    'public/**',
    'src/static-pages/**',
  ]),
  ...typescriptRecommended,
  nextPlugin.configs['core-web-vitals'],
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    plugins: {
      '@eslint-react': eslintReact.configs.recommended.plugins['@eslint-react'],
      'import-x': importX,
      'jsx-a11y': jsxA11y,
      'react-hooks': reactHooks,
    },
    rules: {
      '@eslint-react/dom-no-dangerously-set-innerhtml-with-children': 'error',
      '@eslint-react/dom-no-find-dom-node': 'error',
      '@eslint-react/dom-no-render-return-value': 'error',
      '@eslint-react/jsx-no-children-prop': 'error',
      '@eslint-react/jsx-no-children-prop-with-children': 'error',
      '@eslint-react/jsx-no-comment-textnodes': 'error',
      '@eslint-react/no-direct-mutation-state': 'error',
      '@eslint-react/no-missing-component-display-name': 'error',
      '@eslint-react/no-missing-key': 'error',
      'import-x/no-anonymous-default-export': 'warn',
      'jsx-a11y/alt-text': [
        'warn',
        {
          elements: ['img'],
          img: ['Image'],
        },
      ],
      'jsx-a11y/aria-props': 'warn',
      'jsx-a11y/aria-proptypes': 'warn',
      'jsx-a11y/aria-unsupported-elements': 'warn',
      'jsx-a11y/role-has-required-aria-props': 'warn',
      'jsx-a11y/role-supports-aria-props': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['app/api/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'none',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: [
      'app/**/*.{ts,tsx}',
      'components/**/*.{ts,tsx}',
      'lib/**/*.{ts,tsx}',
    ],
    rules: {
      '@next/next/no-img-element': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'none',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
]);
