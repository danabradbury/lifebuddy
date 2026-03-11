const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended')

module.exports = [
  {
    ignores: ['dist/**', 'jest.config.js'],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        project: ['./tsconfig.json'],
      },
    },
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
      prettier: require('eslint-plugin-prettier'),
    },
    rules: {
      ...eslintPluginPrettierRecommended.rules,
    },
  },
]

