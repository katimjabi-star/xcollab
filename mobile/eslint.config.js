const tseslint = require('typescript-eslint');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'android/**',
      'ios/**',
      '.expo/**',
      'dist/**',
      'expo-env.d.ts',
    ],
  },
  ...tseslint.configs.recommended,
  {
    // Metro/Babel configs and Expo config plugins run under Node as CommonJS.
    files: ['**/*.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    rules: {
      // Same file budget as the rest of xcollab-platform.
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
    },
  },
];
