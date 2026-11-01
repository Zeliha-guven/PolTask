import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const noFetch = {
  'no-restricted-globals': ['error', { name: 'fetch', message: 'HTTP yalnız web/src/api üzerinden (AC-3).' }],
  'no-restricted-properties': [
    'error',
    { object: 'window', property: 'fetch', message: 'HTTP yalnız web/src/api üzerinden (AC-3).' },
    { object: 'globalThis', property: 'fetch', message: 'HTTP yalnız web/src/api üzerinden (AC-3).' },
  ],
};

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-restricted-syntax': [
        'error',
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'dangerouslySetInnerHTML yasak (docs/security.md).' },
        { selector: "CallExpression[callee.property.name='toISOString']", message: 'toISOString UTC verir; lib/dates yardımcılarını kullan.' },
      ],
      ...noFetch,
    },
  },
  {
    // Tek HTTP katmanı ve testlerin stub'ları fetch'e dokunabilir.
    files: ['src/api/**/*.ts', 'src/test/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off' },
  },
);
