// =====================================================================
// tests/helpers/load-generator.js
// =====================================================================
// Завантажує src/core/generator.js + src/core/blocks-turtle.js у
// ізольованому vm-контексті (без реального браузера/Blockly) і повертає
// PY (словник генераторів), valueToCode/statementToCode/toIdentifier —
// усе, що потрібно для юніт-тестів генератора Python.
//
// Мінімальні заглушки:
//   - Blockly = { Blocks: {}, defineBlocksWithJsonArray: no-op }
//     (init-функції блоків не викликаються в тестах — нас цікавить
//     лише PY[...], а не рендеринг блоків)
//   - t(key) — за замовчуванням повертає сам ключ (тести генератора
//     не залежать від конкретного перекладу; переклад перевіряється
//     окремо, у tests/i18n.test.js)
//
// workspace.js та ui.js НЕ завантажуються — вони працюють з DOM/Skulpt
// і не потрібні для тестування чистої функції "блок → Python-рядок".
// =====================================================================

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function loadGenerator({ translations = {} } = {}) {
    const sandbox = { console };
    sandbox.window = {};
    sandbox.Blockly = {
        Blocks: {},
        defineBlocksWithJsonArray: () => {},
    };
    // t(key): якщо в translations передано конкретний переклад — повертає
    // його, інакше — сам ключ (достатньо для генератора коду, який не
    // залежить від тексту підказок/лейблів).
    sandbox.t = (key) => (Object.prototype.hasOwnProperty.call(translations, key) ? translations[key] : key);

    vm.createContext(sandbox);

    const generatorSrc = fs.readFileSync(path.join(ROOT, 'src/core/generator.js'), 'utf8');
    const blocksSrc = fs.readFileSync(path.join(ROOT, 'src/core/blocks-turtle.js'), 'utf8');

    vm.runInContext(generatorSrc, sandbox, { filename: 'generator.js' });
    vm.runInContext(blocksSrc, sandbox, { filename: 'blocks-turtle.js' });

    // Заповнюємо window.PY, викликавши defineBlocksAndGenerators() (так само,
    // як це робить initializeWorkspace() у реальному застосунку), і
    // "витягуємо" потрібні функції з lexical-скоупу vm-контексту назовні.
    vm.runInContext(
        `
        defineBlocksAndGenerators();
        this.__exports = {
            PY: window.PY,
            valueToCode: valueToCode,
            statementToCode: statementToCode,
            chainToCode: chainToCode,
            indentBlock: indentBlock,
            toIdentifier: toIdentifier,
        };
        `,
        sandbox
    );

    return sandbox.__exports;
}

// ---------- Допоміжні фабрики mock-блоків для тестів ----------

// Простий блок без входів (напр. math_number, text_literal) — лише поля.
function fieldBlock(type, fields = {}) {
    return {
        type,
        getFieldValue: (name) => fields[name],
        getField: (name) => (fields[name] !== undefined ? { getText: () => fields[name] } : null),
        getInputTargetBlock: () => null,
        getNextBlock: () => null,
    };
}

// Блок із value-входами: inputs = { INPUT_NAME: mockBlockOrNull }.
function valueInputBlock(type, inputs = {}, fields = {}) {
    return {
        type,
        getFieldValue: (name) => fields[name],
        getField: (name) => (fields[name] !== undefined ? { getText: () => fields[name] } : null),
        getInputTargetBlock: (name) => inputs[name] || null,
        getInput: (name) => (inputs[name] !== undefined ? {} : null),
        getNextBlock: () => null,
    };
}

// Ланцюжок statement-блоків: chain([blockA, blockB]) — blockA.getNextBlock() === blockB.
function chain(blocks) {
    blocks.forEach((b, i) => {
        b.getNextBlock = () => blocks[i + 1] || null;
    });
    return blocks[0] || null;
}

module.exports = { loadGenerator, fieldBlock, valueInputBlock, chain };

// Порівняння результату PY[...] ([code, precedence]) без залежності від
// realm-у vm-контексту: assert.deepEqual на масиві з ІНШОГО vm-контексту
// падає через відмінний прототип Array, навіть коли значення ідентичні —
// тому звіряємо елементи окремо, як прості значення (string/number).
function assertGenResult(assert, actual, [expectedCode, expectedPrecedence]) {
    const [code, precedence] = actual;
    assert.equal(code, expectedCode);
    assert.equal(precedence, expectedPrecedence);
}
module.exports.assertGenResult = assertGenResult;
