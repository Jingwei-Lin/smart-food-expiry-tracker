// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  // Turns off the ESLint rules that would fight Prettier over formatting.
  // Must stay last so it overrides the rules above.
  prettierConfig,
  {
    // .expo holds Expo's generated types, which are rebuilt on every start.
    ignores: ['dist/*', '.expo/*'],
    settings: {
      // Keep ESLint's import checks in sync with the @/* alias in tsconfig.json.
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },
  },
]);
