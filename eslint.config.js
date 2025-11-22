const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');

const compat = new FlatCompat({
    baseDirectory: __dirname,
});

module.exports = [
    {
        ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.js'],
    },

    js.configs.recommended,

    ...compat.extends('plugin:@typescript-eslint/recommended'),
    ...compat.extends('plugin:prettier/recommended'),

    {
        languageOptions: {
            parser: require('@typescript-eslint/parser'),
            parserOptions: {
                project: 'tsconfig.json',
                tsconfigRootDir: __dirname,
                sourceType: 'module',
            },
        },
        rules: {
            '@typescript-eslint/interface-name-prefix': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',

            '@typescript-eslint/no-unused-vars': 'off',

            'prefer-const': 'off',

            'no-prototype-builtins': 'off',
        },
    },
];