// =====================================================================
// tests/floordiv.test.js — ділення на ціле a // b (блок math_floordiv)
// =====================================================================
// Перевіряє: розбір із пробілами й без них, дужки, пріоритет відносно
// + / * / %, лівоасоціативність, унарний мінус і генерацію назад у код.
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadParser } = require('./helpers/load-parser');
const { loadGenerator, fieldBlock, valueInputBlock } = require('./helpers/load-generator');

const { parseExpr } = loadParser();
const { PY } = loadGenerator();

// Спрощене дерево для читабельних перевірок: (OP L R), імена, числа, RAW[...]
function tree(xml) {
    const type = xml.match(/^<block type="([^"]+)"/)[1];
    if (type === 'variables_get') return xml.match(/<field name="VAR">([^<]*)/)[1];
    if (type === 'math_number') return xml.match(/<field name="NUM">([^<]*)/)[1];
    if (type === 'raw_python_expr') return `RAW[${xml.match(/<field name="CODE">([^<]*)/)[1]}]`;
    if (type === 'math_arithmetic') {
        const op = xml.match(/<field name="OP">([^<]*)/)[1];
        return `(${op} ${tree(child(xml, 'A'))} ${tree(child(xml, 'B'))})`;
    }
    if (type === 'math_floordiv') return `(// ${tree(child(xml, 'DIVIDEND'))} ${tree(child(xml, 'DIVISOR'))})`;
    if (type === 'math_modulo') return `(% ${tree(child(xml, 'DIVIDEND'))} ${tree(child(xml, 'DIVISOR'))})`;
    return type;
}

// Значення з ТОП-рівня блоку (вкладені <value> з такою ж назвою ігноруються)
function child(xml, name) {
    const body = xml.replace(/^<block[^>]*>/, '').replace(/<\/block>$/, '');
    let depth = 0;
    for (let i = 0; i < body.length; i++) {
        if (body.startsWith('<value name="', i) && depth === 0) {
            const nm = body.slice(i + 13, body.indexOf('"', i + 13));
            const start = body.indexOf('>', i) + 1;
            let k = start, d = 0;
            for (; k < body.length; k++) {
                if (body.startsWith('<value', k)) d++;
                else if (body.startsWith('</value>', k)) { if (d === 0) break; d--; }
            }
            if (nm === name) return body.slice(start, k).replace(/<shadow[\s\S]*?<\/shadow>/g, '').trim();
            i = k + 7;
            continue;
        }
        if (body.startsWith('<value', i)) depth++;
        if (body.startsWith('</value>', i)) depth--;
    }
    throw new Error(`немає входу ${name}`);
}

const T = (code) => tree(parseExpr(code));

// ---------- розбір ----------

test('a//b (без пробілів) → math_floordiv', () => {
    assert.equal(T('a//b'), '(// a b)');
});

test('a // b (з пробілами) → math_floordiv', () => {
    assert.equal(T('a // b'), '(// a b)');
});

test('(a//b) у дужках → math_floordiv', () => {
    assert.equal(T('(a//b)'), '(// a b)');
});

test('ділення не плутається зі звичайним /', () => {
    assert.equal(T('a / b'), '(DIVIDE a b)');
});

test('a//b + 1: ділення має вищий пріоритет за додавання', () => {
    assert.equal(T('a//b + 1'), '(ADD (// a b) 1)');
});

test('x + a//b: додавання зліва, ділення справа', () => {
    assert.equal(T('x + a//b'), '(ADD x (// a b))');
});

test('a * b // c → (a*b)//c (ліво-асоціативність)', () => {
    assert.equal(T('a * b // c'), '(// (MULTIPLY a b) c)');
});

test('a // b // c → (a//b)//c', () => {
    assert.equal(T('a // b // c'), '(// (// a b) c)');
});

test('a + b % c → a + (b%c): % не "з\'їдає" додавання', () => {
    assert.equal(T('a + b % c'), '(ADD a (% b c))');
});

test('a % b лишається math_modulo', () => {
    assert.equal(T('a % b'), '(% a b)');
});

test('унарний мінус не ламає розбір: a * -b', () => {
    assert.equal(T('a * -b'), '(MULTIPLY a RAW[-b])');
});

test('експонента 1e-5 не розбивається як віднімання', () => {
    assert.equal(T('x - 1e-5'), '(MINUS x RAW[1e-5])');
});

// ---------- генерація ----------

test('PY[math_floordiv]: (A // B)', () => {
    const block = valueInputBlock('math_floordiv', {
        DIVIDEND: fieldBlock('math_number', { NUM: '7' }),
        DIVISOR: fieldBlock('math_number', { NUM: '2' }),
    });
    assert.deepEqual([...PY['math_floordiv'](block)], ['(7 // 2)', 0]);
});

test('код→блок→код: згенерований a // b знову розпізнається як math_floordiv', () => {
    const block = valueInputBlock('math_floordiv', {
        DIVIDEND: fieldBlock('variables_get', { VAR: 'a' }),
        DIVISOR: fieldBlock('variables_get', { VAR: 'b' }),
    });
    const [code] = PY['math_floordiv'](block);
    assert.equal(code, '(a // b)');
    assert.equal(T(code), '(// a b)');
});
