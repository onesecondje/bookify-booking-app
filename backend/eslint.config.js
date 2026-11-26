import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'src/generated/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.ts'],
  })),
  {
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "IfStatement[consequent.type!='BlockStatement']",
          message: 'Wrap the if body in braces.',
        },
        {
          selector: "IfStatement[alternate.type][alternate.type!='BlockStatement'][alternate.type!='IfStatement']",
          message: 'Wrap the else body in braces.',
        },
      ],
    },
  },
];
