// =====================================================================
// tests/generator.test.js
// =====================================================================
// Юніт-тести генератора Python (src/core/generator.js +
// src/core/blocks-turtle.js). Запуск: `npm test` або
// `node --test tests/`.
//
// Мета: PY['type'] = block => "python code" — рядок, який ламається
// МОВЧКИ (жодної помилки типів, IDE тут не допоможе). Ці тести фіксують
// поточну очікувану поведінку кожного генератора, щоб майбутній
// рефакторинг (чи новий блок, що випадково перевизначить існуючий тип)
// одразу впав червоним, а не пройшов непоміченим.
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGenerator, fieldBlock, valueInputBlock, chain, assertGenResult } = require('./helpers/load-generator');

// Обгортка, щоб не тягнути `assert` у кожен виклик assertGenResult.
function expectGen(actual, expected) {
    assertGenResult(assert, actual, expected);
}

const { PY, valueToCode, statementToCode, chainToCode, indentBlock, toIdentifier } = loadGenerator();

// ---------------------------------------------------------------------
// Чисті утиліти (не залежать від блоків)
// ---------------------------------------------------------------------
test('indentBlock: додає 4 пробіли до кожного непорожнього рядка', () => {
    assert.equal(indentBlock('a = 1\nb = 2'), '    a = 1\n    b = 2\n');
});

test('indentBlock: порожній код перетворюється на "pass"', () => {
    assert.equal(indentBlock(''), '    pass\n');
    assert.equal(indentBlock('   \n  '), '    pass\n');
});

test('toIdentifier: приймає коректний Python-ідентифікатор', () => {
    assert.equal(toIdentifier('my_var', 't'), 'my_var');
    assert.equal(toIdentifier('  spaced  ', 't'), 'spaced');
});

test('toIdentifier: відхиляє некоректний ідентифікатор і повертає fallback', () => {
    assert.equal(toIdentifier('2bad', 't'), 't');
    assert.equal(toIdentifier('has space', 't'), 't');
    assert.equal(toIdentifier('', 't'), 't');
    assert.equal(toIdentifier('їм\'я', 't'), 't'); // non-ASCII теж відхиляється (Python 2/3-сумісний вибір проєкту)
});

// ---------------------------------------------------------------------
// valueToCode / chainToCode / statementToCode
// ---------------------------------------------------------------------
test('valueToCode: повертає fallback, якщо вхід не підключено', () => {
    const block = valueInputBlock('print', {});
    assert.equal(valueToCode(block, 'VALUE', '"default"'), '"default"');
});

test('valueToCode: викликає генератор підключеного блоку', () => {
    const block = valueInputBlock('some_wrapper', { VALUE: fieldBlock('text_literal', { TEXT: '5' }) });
    assert.equal(valueToCode(block, 'VALUE', '0'), '"5"');
});

test('chainToCode: конкатенує код кількох statement-блоків підряд', () => {
    const start = chain([
        fieldBlock('t_penup'),
        fieldBlock('t_pendown'),
    ]);
    assert.equal(chainToCode(start), 't.penup()\nt.pendown()\n');
});

test('statementToCode: обгортає ланцюжок у тіло (з відступом)', () => {
    const inner = chain([fieldBlock('t_penup')]);
    const outer = valueInputBlock('define_function', {}, { FUNC_NAME: 'f', PARAMS: '' });
    outer.getInputTargetBlock = (name) => (name === 'BODY' ? inner : null);
    assert.equal(statementToCode(outer, 'BODY'), '    t.penup()\n');
});

test('statementToCode: порожнє тіло дає "pass" з відступом', () => {
    const outer = valueInputBlock('define_function', {});
    assert.equal(statementToCode(outer, 'BODY'), '    pass\n');
});

// ---------------------------------------------------------------------
// Група "Введення/Input" (input_value, to_int, to_float, to_str)
// ---------------------------------------------------------------------
test('input_value: input() без аргументу, якщо PROMPT не підключено', () => {
    const block = valueInputBlock('input_value', {});
    expectGen(PY['input_value'](block), ['input("")', 0]);
});

test('input_value: input("текст запиту"), якщо PROMPT підключено', () => {
    const block = valueInputBlock('input_value', {
        PROMPT: fieldBlock('text_literal', { TEXT: 'Введіть число: ' }),
    });
    expectGen(PY['input_value'](block), ['input("Введіть число: ")', 0]);
});

test('to_int: int(...) навколо підключеного значення', () => {
    const block = valueInputBlock('to_int', {
        VALUE: fieldBlock('input_value_result_stub', {}), // будь-який тип — просто перевіряємо композицію
    });
    // Підключений блок без власного генератора -> valueToCode попереджає і
    // повертає fallback; тому тут перевіряємо саме композицію з реальним
    // генератором (text_literal), а не сирим стабом:
    block.getInputTargetBlock = () => fieldBlock('text_literal', { TEXT: '42' });
    expectGen(PY['to_int'](block), ['int("42")', 0]);
});

test('to_int: fallback "0", якщо VALUE не підключено', () => {
    const block = valueInputBlock('to_int', {});
    expectGen(PY['to_int'](block), ['int(0)', 0]);
});

test('to_float: float(...) навколо підключеного значення', () => {
    const block = valueInputBlock('to_float', { VALUE: fieldBlock('math_number', { NUM: '3.14' }) });
    expectGen(PY['to_float'](block), ['float(3.14)', 0]);
});

test('to_float: fallback "0", якщо VALUE не підключено', () => {
    const block = valueInputBlock('to_float', {});
    expectGen(PY['to_float'](block), ['float(0)', 0]);
});

test('to_str: str(...) навколо підключеного значення', () => {
    const block = valueInputBlock('to_str', { VALUE: fieldBlock('math_number', { NUM: '7' }) });
    expectGen(PY['to_str'](block), ['str(7)', 0]);
});

test('to_str: fallback "0", якщо VALUE не підключено', () => {
    const block = valueInputBlock('to_str', {});
    expectGen(PY['to_str'](block), ['str(0)', 0]);
});

test('композиція групи Input: int(input(...)) — типовий сценарій використання', () => {
    const inputBlock = valueInputBlock('input_value', {
        PROMPT: fieldBlock('text_literal', { TEXT: 'Вік: ' }),
    });
    const intBlock = valueInputBlock('to_int', { VALUE: inputBlock });
    expectGen(PY['to_int'](intBlock), ['int(input("Вік: "))', 0]);
});

// ---------------------------------------------------------------------
// Смоук-тести існуючих генераторів (регресія при рефакторингу)
// ---------------------------------------------------------------------
test('print: print(значення)', () => {
    const block = valueInputBlock('print', { VALUE: fieldBlock('text_literal', { TEXT: 'Привіт' }) });
    assert.equal(PY['print'](block), 'print("Привіт")\n');
});

test('text_literal: екранує лапки та зворотні слеші', () => {
    const block = fieldBlock('text_literal', { TEXT: 'він сказав "привіт" \\ok' });
    expectGen(PY['text_literal'](block), ['"він сказав \\"привіт\\" \\\\ok"', 0]);
});

test('math_arithmetic: додавання з fallback-значеннями за замовчуванням', () => {
    const block = valueInputBlock('math_arithmetic', {}, { OP: 'ADD' });
    expectGen(PY['math_arithmetic'](block), ['(0 + 0)', 0]);
});

test('math_arithmetic: множення двох підключених чисел', () => {
    const block = valueInputBlock(
        'math_arithmetic',
        { A: fieldBlock('math_number', { NUM: '6' }), B: fieldBlock('math_number', { NUM: '7' }) },
        { OP: 'MULTIPLY' }
    );
    expectGen(PY['math_arithmetic'](block), ['(6 * 7)', 0]);
});

test('t_forward: рухає ЗМІННУ поточну черепаху (currentTurtleName)', () => {
    // create_turtle змінює глобальний currentTurtleName — перевіряємо, що
    // наступні рухові блоки використовують ЩОЙНО встановлене ім'я.
    const createBlock = fieldBlock('create_turtle', { NAME: 'my_turtle' });
    PY['create_turtle'](createBlock);
    const moveBlock = valueInputBlock('t_forward', { DIST: fieldBlock('math_number', { NUM: '100' }) });
    assert.equal(PY['t_forward'](moveBlock), 'my_turtle.forward(100)\n');
});

