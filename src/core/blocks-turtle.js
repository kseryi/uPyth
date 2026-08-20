// =====================================================================
// blocks-turtle.js — визначення блоків (Start/Виведення/Змінні/Цикли/
// Логіка/Математика/Функції) та вбудованого модуля "Turtle"
// =====================================================================
// Другий з чотирьох файлів колишнього app.js. Реєструє модуль 'turtle'
// (window.registerModule — з js/extensions.js, тому має завантажуватись
// ПІСЛЯ нього) і визначає всі "core"-блоки середовища через
// defineBlocksAndGenerators(). Залежить від generator.js (PY,
// valueToCode, statementToCode, indentBlock, toIdentifier) — має
// завантажуватись ПІСЛЯ нього.
// =====================================================================

// ================= МОДУЛЬ "Turtle" (core) =================
// Turtle лишається "вбудованим" (блоки визначені нижче, в
// defineBlocksAndGenerators(), а не в окремому файлі-розширенні) — це
// набагато безпечніше за динамічне довантаження скрипту, бо уникає
// перегонів (race conditions) між "довантажити script.js" і "розкласти
// XML з цими типами блоків одразу". Але для КОРИСТУВАЧА це виглядає
// точнісінько як Tkinter/Pico: окремий пункт у списку "➕ Модулі",
// категорії Movement/Pen/Shapes зʼявляються лише після увімкнення, а
// import-блок отримує колір цього ж модуля (вимоги #2, #3, #5, #6).
// Дескриптор реєструється тут (замість, наприклад, у initializeWorkspace())
// навмисно — синхронно, одразу при завантаженні app.js, ДО DOMContentLoaded,
// щоб extensions.js встиг побачити його в своєму власному обробнику
// DOMContentLoaded (і той, і той обробник спрацьовують по порядку
// підключення скриптів — extensions.js підключений раніше).
if (window.registerModule) {
    window.registerModule('turtle', {
        core: true,
        colour: '#343BBA',
        categoryIds: ['movement', 'pen', 'shapes'],
        startBlocksXml:
            '<block type="import_turtle"></block>' +
            '<block type="create_turtle"><field name="NAME">t</field></block>' +
            '<block type="set_speed"><field name="NAME">t</field>' +
            '<value name="SPEED"><shadow type="math_number"><field name="NUM">5</field></shadow></value></block>' +
            '<block type="turtle_shape"></block>'
    });
}

function warnBlock(block, message) {
    if (block && typeof block.setWarningText === 'function') {
        block.setWarningText(message || null);
    }
}
// ================= ВЕКТОРНІ СПРАЙТИ ЧЕРЕПАШКИ =================
// IMPROVEMENT #6: додаткові форми черепашки як векторні полігони
// (turtle.register_shape), а не растрові картинки — це працює у Skulpt
// без завантаження зображень і легко масштабується/фарбується.
function polygonToPyTuple(points) {
    return '(' + points.map(p => `(${p[0]}, ${p[1]})`).join(', ') + ')';
}
function pacmanPolygon() {
    const radius = 20, gapDeg = 60, steps = 16;
    const pts = [[0, 0]];
    const start = gapDeg / 2, end = 360 - gapDeg / 2;
    for (let i = 0; i <= steps; i++) {
        const ang = (start + (end - start) * i / steps) * Math.PI / 180;
        pts.push([Math.round(radius * Math.cos(ang) * 10) / 10, Math.round(-radius * Math.sin(ang) * 10) / 10]);
    }
    return pts;
}
function starPolygon() {
    const outerR = 20, innerR = 8, points = 5, pts = [];
    for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const ang = (Math.PI / points) * i - Math.PI / 2;
        pts.push([Math.round(r * Math.cos(ang) * 10) / 10, Math.round(r * Math.sin(ang) * 10) / 10]);
    }
    return pts;
}
function penguinPolygon() {
    // спрощений вектор-силует пінгвіна (одноколірний полігон)
    return [
        [0, 24], [6, 22], [10, 16], [11, 6], [9, -4], [12, -10], [6, -9], [4, -16], [0, -20],
        [-4, -16], [-6, -9], [-12, -10], [-9, -4], [-11, 6], [-10, 16], [-6, 22]
    ];
}
const VECTOR_SHAPES = { pacman: pacmanPolygon, star: starPolygon, penguin: penguinPolygon };
const ALLOWED_SHAPES = ['turtle', 'circle', 'arrow', 'classic', 'square', 'triangle', 'pacman', 'penguin', 'star'];

// ================= BLOCKS & GENERATORS =================
function defineBlocksAndGenerators() {
    Blockly.defineBlocksWithJsonArray([
        // "🏁 Start" — блок-відсилка до зеленого прапорця Scratch: єдиний
        // справжній "hat"-блок категорії Start. Код, який він генерує —
        // ЛИШЕ коментар (програма не потребує явного "точки входу" в
        // Python, це суто дидактичний маркер "звідси починається сценарій").
        { type: "flag_start", message0: "🏁 " + t('blk_flag_start'), previousStatement: null, nextStatement: null, colour: '#4CAF50', tooltip: t('blktip_flag_start'), hat: "cap" },
        { type: "import_turtle", message0: "import turtle", previousStatement: null, nextStatement: null, colour: '#343BBA', tooltip: t('blktip_import_turtle') },
        { type: "create_turtle", message0: t('blk_create_turtle'), args0: [{ type: "field_input", name: "NAME", text: "t" }], previousStatement: null, nextStatement: null, colour: '#e8b202', tooltip: t('blktip_create_turtle') },
        { type: "set_speed", message0: t('blk_set_speed'), args0: [{ type: "field_input", name: "NAME", text: "t" }, { type: "input_value", name: "SPEED" }], previousStatement: null, nextStatement: null, colour: '#e8b202' },
        { type: "t_forward", message0: t('blk_t_forward'), args0: [{ type: "input_value", name: "DIST" }], previousStatement: null, nextStatement: null, colour: '#343BBA' },
        { type: "t_backward", message0: t('blk_t_backward'), args0: [{ type: "input_value", name: "DIST" }], previousStatement: null, nextStatement: null, colour: '#343BBA' },
        { type: "t_left", message0: t('blk_t_left'), args0: [{ type: "input_value", name: "ANGLE" }], previousStatement: null, nextStatement: null, colour: '#343BBA' },
        { type: "t_right", message0: t('blk_t_right'), args0: [{ type: "input_value", name: "ANGLE" }], previousStatement: null, nextStatement: null, colour: '#343BBA' },
        { type: "t_penup", message0: t('blk_t_penup'), previousStatement: null, nextStatement: null, colour: "#22c55e" },
        { type: "t_pendown", message0: t('blk_t_pendown'), previousStatement: null, nextStatement: null, colour: "#22c55e" },
        { type: "t_pensize", message0: t('blk_t_pensize'), args0: [{ type: "input_value", name: "SIZE" }], previousStatement: null, nextStatement: null, colour: "#22c55e" },
        { type: "t_color", message0: t('blk_t_color'), args0: [{ type: "input_value", name: "COLOR" }], previousStatement: null, nextStatement: null, colour: "#22c55e" },
        { type: "t_square", message0: t('blk_t_square'), args0: [{ type: "input_value", name: "A" }], previousStatement: null, nextStatement: null, colour: 230 },
        { type: "t_circle", message0: t('blk_t_circle'), args0: [{ type: "input_value", name: "R" }], previousStatement: null, nextStatement: null, colour: 230 },

        {
          type: "define_function",
          message0: t('blk_define_function'),
          style: "procedure_blocks",
          inputsInline: false,
          args0: [
            { type: "field_input", name: "FUNC_NAME", text: "myfunc" },
            { type: "field_input", name: "PARAMS", text: "" },
            { type: "input_statement", name: "BODY" }
          ],
          previousStatement: null,
          nextStatement: null,
          tooltip: t('blktip_define_function')
        },

        { type: "call_function", message0: t('blk_call_function'),
          args0: [
            { type: "field_dropdown", name: "FUNC", options: [[ t('blkopt_none'), "" ]] },
            { type: "field_input", name: "ARGS", text: "" }
          ],
          previousStatement: null, nextStatement: null, colour: "#a855f7", tooltip: t('blktip_call_function') },

        { type: "function_parameter", message0: t('blk_function_parameter'),
          args0: [
            { type: "field_dropdown", name: "PARAM_NAME", options: [[ t('blkopt_no_params'), "" ]] }
          ],
          output: null, colour: "#a855f7", tooltip: t('blktip_function_parameter') },

        { type: "t_fillcolor_manual", message0: t('blk_t_fillcolor_manual'), args0: [{ type: "input_value", name: "COLOR" }], previousStatement: null, nextStatement: null, colour: "#22c55e", tooltip: t('blktip_t_fillcolor_manual') },
        { type: "t_fillcolor_list", message0: t('blk_t_fillcolor_list'), args0: [{ type: "field_dropdown", name: "COLOR", options: [
            ["red", "red"], ["blue", "blue"], ["green", "green"], ["yellow", "yellow"], ["orange", "orange"],
            ["purple", "purple"], ["pink", "pink"], ["brown", "brown"], ["black", "black"], ["white", "white"],
            ["gray", "gray"], ["cyan", "cyan"], ["magenta", "magenta"], ["gold", "gold"], ["silver", "silver"],
            ["lime", "lime"], ["navy", "navy"], ["maroon", "maroon"], ["olive", "olive"], ["teal", "teal"]
        ]}], previousStatement: null, nextStatement: null, colour: "#22c55e", tooltip: t('blktip_t_fillcolor_list') },
        { type: "t_begin_fill", message0: t('blk_t_begin_fill'), previousStatement: null, nextStatement: null, colour: "#22c55e", tooltip: t('blktip_t_begin_fill') },
        { type: "t_end_fill", message0: t('blk_t_end_fill'), previousStatement: null, nextStatement: null, colour: "#22c55e", tooltip: t('blktip_t_end_fill') },

        // ===== IMPROVEMENT #5: додаткові блоки для початківців =====
        // (variables_get/set, controls_for, math_change,
        // text_length, math_single, math_round, math_modulo,
        // controls_flow_statements) — це вбудовані типи блоків Blockly,
        // але генератор для них написано власний, нижче (PY[...]), а не
        // покладено на CDN — див. пояснення далі.

        // ===== "Втечу-блоки" (fallback) для двостороннього зв'язку код↔блоки =====
        { type: "raw_python_line", message0: "🐍 %1", args0: [{ type: "field_input", name: "CODE", text: "" }], previousStatement: null, nextStatement: null, colour: "#64748b", tooltip: t('blktip_raw_python_line') },
        { type: "raw_python_block", message0: "🐍 " + t('blk_raw_python_block_prefix') + " %1", args0: [{ type: "field_input", name: "CODE", text: "" }], previousStatement: null, nextStatement: null, colour: "#475569", tooltip: t('blktip_raw_python_block') },
        { type: "raw_python_expr", message0: "🐍 %1", args0: [{ type: "field_input", name: "CODE", text: "" }], output: null, colour: "#64748b", tooltip: t('blktip_raw_python_expr') }
    ]);

    // Генератор PY, valueToCode, statementToCode тощо тепер визначені
    // ГЛОБАЛЬНО (на початку файлу) — щоб розширення (окремі js-файли,
    // напр. js/extensions/tkinter.js) теж могли додавати власні PY[...]
    // генератори та користуватись тими самими helper-функціями.

    // ---------- Start / flag ----------
    PY['flag_start'] = () => `# ${t('flag_start_comment')}\n`;

    // ---------- Turtle basic commands ----------
    PY['import_turtle'] = () => 'import turtle\n';
    PY['create_turtle'] = block => {
        const name = toIdentifier(block.getFieldValue('NAME'), 't');
        warnBlock(block, name === block.getFieldValue('NAME').trim() ? null : 'Некоректна назва — використано "t"');
        currentTurtleName = name;
        return `${currentTurtleName} = turtle.Turtle()\n`;
    };
    PY['set_speed'] = block => {
        const name = toIdentifier(block.getFieldValue('NAME'), currentTurtleName);
        return `${name}.speed(${valueToCode(block, 'SPEED', '0')})\n`;
    };
    PY['t_forward'] = block => `${currentTurtleName}.forward(${valueToCode(block, 'DIST', '0')})\n`;
    PY['t_backward'] = block => `${currentTurtleName}.backward(${valueToCode(block, 'DIST', '0')})\n`;
    PY['t_left'] = block => `${currentTurtleName}.left(${valueToCode(block, 'ANGLE', '0')})\n`;
    PY['t_right'] = block => `${currentTurtleName}.right(${valueToCode(block, 'ANGLE', '0')})\n`;
    PY['t_penup'] = () => `${currentTurtleName}.penup()\n`;
    PY['t_pendown'] = () => `${currentTurtleName}.pendown()\n`;
    PY['t_pensize'] = block => `${currentTurtleName}.pensize(${valueToCode(block, 'SIZE', '1')})\n`;
    PY['t_color'] = block => {
        const v = valueToCode(block, 'COLOR', '"black"');
        const quoted = (/^['"]/.test(v) ? v : `"${v}"`);
        return `${currentTurtleName}.pencolor(${quoted})\n`;
    };
    PY['t_square'] = block => {
        const a = valueToCode(block, 'A', '50');
        return `for _ in range(4):\n    ${currentTurtleName}.forward(${a})\n    ${currentTurtleName}.right(90)\n`;
    };
    PY['t_circle'] = block => `${currentTurtleName}.circle(${valueToCode(block, 'R', '50')})\n`;

    PY['t_fillcolor_manual'] = function(block) {
        const v = valueToCode(block, 'COLOR', '"black"');
        const quoted = (/^['"]/.test(v) ? v : `"${v}"`);
        return `${currentTurtleName}.fillcolor(${quoted})\n`;
    };
    PY['t_fillcolor_list'] = function(block) {
        return `${currentTurtleName}.fillcolor("${block.getFieldValue('COLOR')}")\n`;
    };
    PY['t_begin_fill'] = () => `${currentTurtleName}.begin_fill()\n`;
    PY['t_end_fill'] = () => `${currentTurtleName}.end_fill()\n`;

    // ---------- "Втечу"-генератори (для round-trip код↔блоки) ----------
    PY['raw_python_line'] = block => (block.getFieldValue('CODE') || '') + '\n';
    PY['raw_python_block'] = block => (block.getFieldValue('CODE') || '').split('\u21B5').join('\n') + '\n';
    PY['raw_python_expr'] = block => [block.getFieldValue('CODE') || '', 0];

    // Import blocks
    // Кольори import_random / import_math навмисно збігаються з кольором
    // категорій, чиї команди цей модуль "підтягує" (вимога #6: "блоки
    // import... мати колір своїх груп"): random використовується в Масивах
    // (випадковий елемент) і Math (випадкове число) — теплий помаранчевий,
    // як категорія "Масиви"; math — колір категорії "Math".
    Blockly.Blocks['import_random'] = {
        init: function() {
            this.appendDummyInput().appendField("import random");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#f97316');
            this.setTooltip(t('blktip_import_random'));
        }
    };
    PY['import_random'] = () => "import random\n";

    Blockly.Blocks['import_math'] = {
        init: function() {
            this.appendDummyInput().appendField("import math");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#10b981');
            this.setTooltip(t('blktip_import_math'));
        }
    };
    PY['import_math'] = () => "import math\n";

    // Turtle shape (векторні спрайти: pacman / penguin / star)
    Blockly.Blocks['turtle_shape'] = {
        init: function() {
            this.appendDummyInput()
                .appendField(t('blk_turtle_shape'))
                .appendField(new Blockly.FieldDropdown([
                    ["turtle", "turtle"],
                    ["circle", "circle"],
                    ["arrow", "arrow"],
                    ["classic", "classic"],
                    ["square", "square"],
                    ["triangle", "triangle"],
                    ["🟡 pacman", "pacman"],
                    ["🐧 penguin", "penguin"],
                    ["⭐ star", "star"]
                ]), "SHAPE");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#e8b202');
            this.setTooltip(t('blktip_turtle_shape'));
        }
    };
    PY['turtle_shape'] = block => {
        const shape = block.getFieldValue('SHAPE');
        if (VECTOR_SHAPES[shape]) {
            const tuple = polygonToPyTuple(VECTOR_SHAPES[shape]());
            return `turtle.register_shape("${shape}", ${tuple})\n${currentTurtleName}.shape("${shape}")\n`;
        }
        return `${currentTurtleName}.shape("${shape}")\n`;
    };

    // Print and text
    Blockly.Blocks['print'] = {
        init: function() {
            this.appendValueInput("VALUE").setCheck(null).appendField("print");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#8059ff');
            this.setTooltip(t('blktip_print'));
        }
    };
    PY['print'] = block => `print(${valueToCode(block, 'VALUE', '""')})\n`;

    Blockly.Blocks['text_literal'] = {
        init: function() {
            this.appendDummyInput().appendField(new Blockly.FieldTextInput(t('blk_text_literal_default')), "TEXT");
            this.setOutput(true, null);  // null = будь-який тип: дозволяє вставляти в math_arithmetic та інші блоки зі setCheck('Number')
            this.setColour('#22c55e');
            this.setTooltip(t('blktip_text_literal'));
        }
    };
    PY['text_literal'] = block => {
        const text = block.getFieldValue('TEXT') || "";
        const safe = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        return [`"${safe}"`, 0];
    };
    // FIX: стандартний вбудований блок Blockly "text" (використовується
    // у shadow-полях toolbox/прикладу) — окремий тип від нашого
    // text_literal, і без цього генератора його значення просто губилось.
    PY['text'] = block => {
        const text = block.getFieldValue('TEXT') || "";
        const safe = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        return [`"${safe}"`, 0];
    };

    // Math blocks
    PY['math_number'] = block => block.getFieldValue('NUM');
    PY['math_arithmetic'] = block => {
        const OPERATORS = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/', POWER: '**' };
        const op = OPERATORS[block.getFieldValue('OP')];
        const arg0 = valueToCode(block, 'A', '0');
        const arg1 = valueToCode(block, 'B', '0');
        return [`(${arg0} ${op} ${arg1})`, 0];
    };
    PY['math_random_int'] = block => {
        const from = valueToCode(block, 'FROM', '0');
        const to = valueToCode(block, 'TO', '10');
        return [`random.randint(${from}, ${to})`, 0];
    };
    PY['math_change'] = block => {
        const varName = block.getField('VAR') ? block.getField('VAR').getText() : 'x';
        const delta = valueToCode(block, 'DELTA', '1');
        return `${varName} = ${varName} + ${delta}\n`;
    };
    PY['text_length'] = block => [`len(${valueToCode(block, 'VALUE', '""')})`, 0];

    // ---------- Група "Введення/Input" (бузковий колір, овальна форма) ----------
    // Усі 4 блоки — value-блоки (setOutput, без previous/next statement),
    // тому в рендерері 'zelos' (див. initializeWorkspace) вони автоматично
    // малюються як заокруглені "репортери" (овальна форма), так само як
    // text_literal вище — без previous/next Blockly не додає "плоских"
    // країв блоку команди.
    const INPUT_GROUP_COLOUR = '#c8a2c8'; // бузковий (лілова)

    Blockly.Blocks['input_value'] = {
        init: function() {
            this.appendValueInput('PROMPT').setCheck(null).appendField('input');
            this.setOutput(true, null);
            this.setColour(INPUT_GROUP_COLOUR);
            this.setTooltip(t('blktip_input_value'));
        }
    };
    PY['input_value'] = block => [`input(${valueToCode(block, 'PROMPT', '""')})`, 0];

    Blockly.Blocks['to_int'] = {
        init: function() {
            this.appendValueInput('VALUE').setCheck(null).appendField('int');
            this.setOutput(true, null);
            this.setColour(INPUT_GROUP_COLOUR);
            this.setTooltip(t('blktip_to_int'));
        }
    };
    PY['to_int'] = block => [`int(${valueToCode(block, 'VALUE', '0')})`, 0];

    Blockly.Blocks['to_float'] = {
        init: function() {
            this.appendValueInput('VALUE').setCheck(null).appendField('float');
            this.setOutput(true, null);
            this.setColour(INPUT_GROUP_COLOUR);
            this.setTooltip(t('blktip_to_float'));
        }
    };
    PY['to_float'] = block => [`float(${valueToCode(block, 'VALUE', '0')})`, 0];

    Blockly.Blocks['to_str'] = {
        init: function() {
            this.appendValueInput('VALUE').setCheck(null).appendField('str');
            this.setOutput(true, null);
            this.setColour(INPUT_GROUP_COLOUR);
            this.setTooltip(t('blktip_to_str'));
        }
    };
    PY['to_str'] = block => [`str(${valueToCode(block, 'VALUE', '0')})`, 0];
    PY['math_modulo'] = block => [`(${valueToCode(block, 'DIVIDEND', '0')} % ${valueToCode(block, 'DIVISOR', '1')})`, 0];
    PY['math_round'] = block => {
        const op = block.getFieldValue('OP');
        const v = valueToCode(block, 'NUM', '0');
        if (op === 'ROUNDUP') return [`math.ceil(${v})`, 0];
        if (op === 'ROUNDDOWN') return [`math.floor(${v})`, 0];
        return [`round(${v})`, 0];
    };
    PY['math_single'] = block => {
        const op = block.getFieldValue('OP');
        const v = valueToCode(block, 'NUM', '0');
        const OPS = {
            ROOT: x => `math.sqrt(${x})`, ABS: x => `abs(${x})`, NEG: x => `-(${x})`,
            LN: x => `math.log(${x})`, LOG10: x => `math.log10(${x})`, EXP: x => `math.exp(${x})`,
            POW10: x => `(10 ** (${x}))`, SIN: x => `math.sin(math.radians(${x}))`,
            COS: x => `math.cos(math.radians(${x}))`, TAN: x => `math.tan(math.radians(${x}))`
        };
        return [(OPS[op] || (x => x))(v), 0];
    };
    // colour_picker прибрано: у цій збірці Blockly немає модуля "colour"
    // (Blockly.Blocks['colour_picker'] не існує), спроба відрендерити цей
    // тип у toolbox кидала "Invalid block definition for type: colour_picker",
    // що ламало внутрішній стан flyout — після цього блоки категорій
    // переставали відображатись. Якщо колись треба буде повернути візуальний
    // вибір кольору, доведеться підключити повний build Blockly з модулем
    // colour або написати власне поле-колірпікер.
    PY['variables_get'] = block => [block.getField('VAR') ? block.getField('VAR').getText() : 'x', 0];
    PY['variables_set'] = block => {
        const varName = block.getField('VAR') ? block.getField('VAR').getText() : 'x';
        return `${varName} = ${valueToCode(block, 'VALUE', '0')}\n`;
    };
    PY['controls_flow_statements'] = block => (block.getFieldValue('FLOW') === 'BREAK' ? 'break\n' : 'continue\n');

    // ---------- Масиви / списки (Arrays / lists) ----------
    // lists_create_with — вбудований блок Blockly з mutator'ом (шестерня),
    // що дозволяє додавати/прибирати "комірки" (+/-) для елементів списку.
    // Це і є "блок з комірками та плюсиком" для формування списку.
    PY['lists_create_with'] = block => {
        const parts = [];
        let i = 0;
        while (block.getInput('ADD' + i)) {
            parts.push(valueToCode(block, 'ADD' + i, '0'));
            i++;
        }
        return [`[${parts.join(', ')}]`, 0];
    };
    PY['lists_length'] = block => [`len(${valueToCode(block, 'VALUE', '[]')})`, 0];
    PY['lists_isEmpty'] = block => [`(len(${valueToCode(block, 'VALUE', '[]')}) == 0)`, 0];
    PY['lists_indexOf'] = block => {
        const end = block.getFieldValue('END');
        const list = valueToCode(block, 'VALUE', '[]');
        const find = valueToCode(block, 'FIND', '0');
        if (end === 'LAST') {
            return [`(len(${list}) - ${list}[::-1].index(${find}) if ${find} in ${list} else 0)`, 0];
        }
        return [`((${list}.index(${find}) + 1) if ${find} in ${list} else 0)`, 0];
    };
    PY['lists_getIndex'] = block => {
        const mode = block.getFieldValue('MODE');   // GET / GET_REMOVE / REMOVE
        const where = block.getFieldValue('WHERE'); // FROM_START / FROM_END / FIRST / LAST / RANDOM
        const list = valueToCode(block, 'VALUE', '[]');
        const at = (where === 'FROM_START' || where === 'FROM_END') ? valueToCode(block, 'AT', '1') : null;
        const pyIndex = () => {
            if (where === 'FIRST') return `${list}.pop(0)`;
            if (where === 'LAST') return `${list}.pop()`;
            if (where === 'RANDOM') return `${list}.pop(random.randrange(len(${list})))`;
            if (where === 'FROM_END') return `${list}.pop(-(${at}))`;
            return `${list}.pop((${at}) - 1)`;
        };
        if (mode === 'REMOVE') return pyIndex() + '\n';
        if (mode === 'GET_REMOVE') return [pyIndex(), 0];
        if (where === 'FIRST') return [`${list}[0]`, 0];
        if (where === 'LAST') return [`${list}[-1]`, 0];
        if (where === 'RANDOM') return [`random.choice(${list})`, 0];
        if (where === 'FROM_END') return [`${list}[-(${at})]`, 0];
        return [`${list}[(${at}) - 1]`, 0];
    };
    PY['lists_setIndex'] = block => {
        const where = block.getFieldValue('WHERE');
        const list = valueToCode(block, 'LIST', '[]');
        const value = valueToCode(block, 'TO', '0');
        const at = (where === 'FROM_START' || where === 'FROM_END') ? valueToCode(block, 'AT', '1') : null;
        if (where === 'FIRST') return `${list}[0] = ${value}\n`;
        if (where === 'LAST') return `${list}[-1] = ${value}\n`;
        if (where === 'RANDOM') return `${list}[random.randrange(len(${list}))] = ${value}\n`;
        if (where === 'FROM_END') return `${list}[-(${at})] = ${value}\n`;
        return `${list}[(${at}) - 1] = ${value}\n`;
    };

    // Logic blocks
    PY['logic_compare'] = block => {
        const OPERATORS = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };
        const op = OPERATORS[block.getFieldValue('OP')];
        const arg0 = valueToCode(block, 'A', '0');
        const arg1 = valueToCode(block, 'B', '0');
        return [`(${arg0} ${op} ${arg1})`, 0];
    };
    PY['logic_boolean'] = block => [(block.getFieldValue('BOOL') === 'TRUE') ? 'True' : 'False', 0];

    // ===== Control structures (elseif/else через mutator) =====
    PY['controls_if'] = function(block) {
        let n = 0, code = '';
        do {
            const cond = valueToCode(block, 'IF' + n, 'False');
            const branch = statementToCode(block, 'DO' + n);
            code += (n === 0 ? 'if ' : 'elif ') + cond + ':\n' + branch;
            n++;
        } while (block.getInput('IF' + n));
        if (block.getInput('ELSE')) {
            code += 'else:\n' + statementToCode(block, 'ELSE');
        }
        return code;
    };
    PY['controls_ifelse'] = function(block) { return PY['controls_if'](block); };

    PY['controls_whileUntil'] = block => {
        const mode = block.getFieldValue('MODE');
        let cond = valueToCode(block, 'BOOL', 'False');
        if (mode === 'UNTIL') cond = `not (${cond})`;
        return `while ${cond}:\n${statementToCode(block, 'DO')}`;
    };

    PY['controls_repeat_ext'] = block => {
        const repeats = valueToCode(block, 'TIMES', '0');
        return `for _ in range(${repeats}):\n${statementToCode(block, 'DO')}`;
    };

    PY['controls_for'] = function(block) {
        const varField = block.getField('VAR');
        const varName = varField ? varField.getText() : 'i';
        const from = valueToCode(block, 'FROM', '0');
        const to = valueToCode(block, 'TO', '10');
        const by = valueToCode(block, 'BY', '1');
        return `for ${varName} in range(${from}, ${to} + 1, ${by}):\n${statementToCode(block, 'DO')}`;
    };

    // controls_for_simple: for i in range(FROM, TO + 1) — без явного кроку
    // Pedagogically cleaner for beginners; step is always 1 (Python default).
    Blockly.Blocks['controls_for_simple'] = {
        init: function() {
            this.appendDummyInput().appendField(t('blk_for_simple_prefix')).appendField(new Blockly.FieldVariable('i'), 'VAR').appendField(t('blk_for_simple_from'));
            this.appendValueInput('FROM').setCheck(null);
            this.appendDummyInput().appendField(t('blk_for_simple_to'));
            this.appendValueInput('TO').setCheck(null);
            this.appendStatementInput('DO').setCheck(null).appendField(t('blk_for_simple_do'));
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour('#ff6680');
            this.setTooltip(t('blktip_for_simple'));
            this.setInputsInline(true);
        }
    };
    PY['controls_for_simple'] = function(block) {
        const varField = block.getField('VAR');
        const varName = varField ? varField.getText() : 'i';
        const from = valueToCode(block, 'FROM', '1');
        const to = valueToCode(block, 'TO', '10');
        return `for ${varName} in range(${from}, ${to} + 1):\n${statementToCode(block, 'DO')}`;
    };

    // Function blocks
    PY['define_function'] = function(block) {
        const func = toIdentifier(block.getFieldValue('FUNC_NAME'), 'myfunc');
        warnBlock(block, func === block.getFieldValue('FUNC_NAME').trim() ? null : 'Некоректне ім\'я функції — використано "myfunc"');
        const rawParams = block.getFieldValue('PARAMS') || '';
        const cleanParams = rawParams.split(',').map(p => p.trim()).filter(p => p !== '').join(', ');
        return `def ${func}(${cleanParams}):\n${statementToCode(block, 'BODY')}`;
    };

    PY['call_function'] = function(block) {
        const func = block.getFieldValue('FUNC');
        const args = block.getFieldValue('ARGS') || '';
        if (!func) return '';
        const cleanArgs = args.split(',').map(a => a.trim()).filter(a => a !== '').join(', ');
        return `${func}(${cleanArgs})\n`;
    };

    PY['function_parameter'] = function(block) {
        return [block.getFieldValue('PARAM_NAME'), 0];
    };

    // ==== Допоміжні функції для функцій (define_function/call_function) ====
    function getDefinedFunctionNames() {
        if (!workspace) return [];
        return workspace.getAllBlocks(false)
            .filter(b => b.type === "define_function")
            .map(b => b.getFieldValue("FUNC_NAME"))
            .filter(n => n);
    }
    function getFunctionParameters(funcBlock) {
        if (funcBlock.type !== 'define_function') return [];
        const params = funcBlock.getFieldValue('PARAMS') || '';
        return params.split(',').map(p => p.trim()).filter(p => p !== "").map(p => [p, p]);
    }
    function findParentFunction(block) {
        let current = block.getParent();
        while (current) {
            if (current.type === 'define_function') return current;
            current = current.getParent();
        }
        return null;
    }

    // Однократна реєстрація слухача (винесена окремо — див.
    // registerFunctionBlockWatcher() нижче) відбувається з initializeWorkspace().
}

// Стежить за списком визначених функцій/параметрів і оновлює випадні
// списки блоків call_function/function_parameter. РЕЄСТРУЄТЬСЯ ОДИН РАЗ
// (не входить у defineBlocksAndGenerators(), яку безпечно перевикликати
// при зміні мови — інакше кожен виклик додавав би ще один дублікат
// того самого обробника).
function registerFunctionBlockWatcher() {
    workspace.addChangeListener(() => {
        const blocks = workspace.getAllBlocks(false);
        blocks.forEach(b => {
            if (b.type === "call_function") {
                const field = b.getField("FUNC");
                const names = getDefinedFunctionNames();
                const menu = names.length ? names.map(n => [n, n]) : [["(none)", ""]];
                field.menuGenerator_ = menu;
                if (!menu.map(m => m[1]).includes(field.getValue())) field.setValue(menu[0][1]);
            }
            if (b.type === "function_parameter") {
                const field = b.getField("PARAM_NAME");
                const parentFunc = findParentFunction(b);
                const params = parentFunc ? getFunctionParameters(parentFunc) : [["(no params)", ""]];
                field.menuGenerator_ = params;
                if (!params.map(p => p[1]).includes(field.getValue())) field.setValue(params[0] ? params[0][1] : "");
            }
        });
    });
}

