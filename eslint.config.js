'use strict';

// =====================================================================
// eslint.config.js — конфігурація ESLint (flat config, ESLint ≥ 9)
// =====================================================================
// ВАЖЛИВО (чому no-undef вимкнено для src/**, js/*.js):
//
// Проєкт не використовує ES-модулі чи бандлер — усі файли підключені як
// звичайні <script src="..."> (див. index.htm), і навмисно в такому
// порядку: generator.js → blocks-turtle.js → workspace.js → ui.js →
// js/extensions.js → js/extensions/*.js. Функція чи змінна, оголошена
// на верхньому рівні одного файлу (напр. `let workspace` у
// generator.js, `function refreshCode()` у workspace.js), доступна як
// звичайний ідентифікатор в усіх наступних файлах — це нормальна
// поведінка "класичних" браузерних скриптів, а НЕ помилка.
//
// ESLint лінтує кожен файл ОКРЕМО і не бачить цей спільний скоуп. Було б
// можна вручну перелічити кожну крос-файлову назву як `globals`, але під
// час підготовки цього конфігу я спробував автоматично зібрати такий
// список regex-ом за іменами верхнього рівня — і він дав хибні
// результати (підхопив локальні імена, яких там не було). Ручний список
// без надійного способу його перевірити дав би хибне відчуття безпеки й
// однаково застарів би при першому ж новому блоці. Тому:
//
//   - no-undef вимкнено саме для файлів із цим патерном
//   - крос-файлові регресії (типу "перейменували функцію в одному файлі,
//     забули в іншому") ловлять юніт-тести — tests/generator.test.js —
//     а не лінтер. Лінтер тут відповідає за мертвий код, дублікати,
//     стиль і явні помилки в межах одного файлу.
//
// ПРИМІТКА: я не мав мережевого доступу, щоб встановити й реально
// прогнати ESLint у цьому середовищі (npm-реєстр заблоковано пісочницею)
// — цей конфіг синтаксично перевірений (`node --check`), але не
// прогнаний по коду. Перший запуск `npm install && npm run lint`
// варто зробити самостійно й переглянути результат.
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
