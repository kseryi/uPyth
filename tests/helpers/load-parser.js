// =====================================================================
// tests/helpers/load-parser.js
// =====================================================================
// Завантажує src/core/workspace.js у vm-контексті з мінімальною
// заглушкою DOM (document.getElementById і т.п. — тільки щоб
// синхронний верхній рівень файлу не впав) і повертає parseExpr —
// функцію, що перетворює один Python-вираз назад у XML одного блоку
// (частина парсера "Python → Blockly").
// =====================================================================

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function stubEl() {
    return {
        addEventListener: () => {},
        style: {},
        classList: { add: () => {}, remove: () => {} },
        appendChild: () => {},
        value: '',
        textContent: '',
    };
}

function loadParser() {
    const sandbox = { console };
    sandbox.window = {};
    sandbox.document = {
        getElementById: () => stubEl(),
        addEventListener: () => {},
        createElement: () => stubEl(),
        body: { appendChild: () => {} },
    };
    sandbox.Blockly = { Xml: {}, Themes: { Classic: {} }, Theme: { defineTheme: () => ({}) } };
    sandbox.t = (key) => key;
    sandbox.Sk = {};
    sandbox.localStorage = { getItem: () => null, setItem: () => {} };

    vm.createContext(sandbox);

    const src = fs.readFileSync(path.join(ROOT, 'src/core/workspace.js'), 'utf8');
    vm.runInContext(src, sandbox, { filename: 'workspace.js' });
    vm.runInContext('this.__parseExpr = parseExpr;', sandbox);

    return { parseExpr: sandbox.__parseExpr };
}

module.exports = { loadParser };
