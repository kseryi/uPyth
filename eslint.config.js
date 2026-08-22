'use strict';

// =====================================================================
// eslint.config.js — конфігурація ESLint (flat config, ESLint ≥ 9)
// =====================================================================

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    js.configs.recommended,

    {
        ignores: [
            'js/blockly.min.js', // vendored, мінифікований, 1.1 МБ — не наш код
            'node_modules/**',
        ],
    },

    // Власний браузерний код: src/core/**, js/*.js, js/extensions/**, js/locales/**
    {
        files: ['src/core/**/*.js', 'js/*.js', 'js/extensions/**/*.js', 'js/locales/**/*.js'],
        languageOptions: {
            sourceType: 'script',
            ecmaVersion: 2021,
            globals: {
                ...globals.browser,
                // Сторонні бібліотеки, підключені окремими <script>-тегами
                Blockly: 'readonly',
                Sk: 'readonly', // Skulpt (CDN, js/index.htm)
            },
        },
        rules: {
            'no-undef': 'off', // див. коментар вгорі файлу
            'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
            'no-var': 'error',
            'prefer-const': 'warn',
            eqeqeq: 'warn',
            'no-redeclare': 'error',
            'no-dupe-keys': 'error',
            'no-duplicate-case': 'error',
            'no-fallthrough': 'error',
            'no-unreachable': 'error',
            'no-empty': ['warn', { allowEmptyCatch: true }],
        },
    },

    // Тести (Node.js, CommonJS, node:test)
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            sourceType: 'commonjs',
            ecmaVersion: 2021,
            globals: { ...globals.node },
        },
        rules: {
            'no-unused-vars': 'warn',
        },
    },

    // Цей самий конфіг-файл виконується в Node (CommonJS)
    {
        files: ['eslint.config.js'],
        languageOptions: {
            sourceType: 'commonjs',
            globals: { ...globals.node },
        },
    },
];
