// =====================================================================
// extensions/tkinter.js — модуль "Tkinter (вікна)"
// =====================================================================
// ⚠️ ВАЖЛИВА ТЕХНІЧНА ОСОБЛИВІСТЬ: виконання Python тут відбувається через
// Skulpt, який НЕ підтримує Tkinter (справжні вікна ОС неможливо
// відтворити всередині вкладки браузера). Тому блоки нижче:
//   1) генерують СПРАВЖНІЙ, коректний Python-код з tkinter (панель
//      "2) Python Code") — скопіюйте його кнопкою "⬇ .py" і запустіть на
//      комп'ютері (Thonny/IDLE/VS Code) — вікно з'явиться по-справжньому;
//   2) під час "▶ Run" показують ПОПЕРЕДНІЙ ПЕРЕГЛЯД — чесно позначений
//      як симуляція, а не справжнє виконання.
//
// АРХІТЕКТУРА КОДОГЕНЕРАЦІЇ (вимоги #1 і #9): кожен Python-оператор — це
// ОКРЕМИЙ блок. Наприклад, кнопка — це СПОЧАТКУ "створити змінну = клас"
// (tk_create_button: `btn = tk.Button(root, text=..., command=...)`), а
// ОКРЕМИМ блоком — "показати" (tk_pack: `btn.pack(pady=...)`), так само,
// як у "звичайному" tkinter-коді.

registerExtension('tkinter', function (ctx) {
    const PY = ctx.PY;
    const valueToCode = ctx.valueToCode;
    const toIdentifier = ctx.toIdentifier;
    const COLOUR = '#3b82f6';
    const COLOUR_DARK = '#1d4ed8';

    function esc(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }
    function ident(block, field, fallback) { return toIdentifier(block.getFieldValue(field), fallback); }

    // ---------- Визначення блоків (обгорнуто у функцію — можна безпечно
    // перевикликати при зміні мови, щоб message0/tooltip перебудувались
    // через t() наново). ----------
    function defineTkinterStaticBlocks() {
    Blockly.defineBlocksWithJsonArray([
        // ===== Start: import =====
        { type: "import_tkinter", message0: "import tkinter as tk", previousStatement: null, nextStatement: null, colour: COLOUR, tooltip: t('blktip_tk_import_tkinter') },
        { type: "import_tkinter_messagebox", message0: "from tkinter import messagebox", previousStatement: null, nextStatement: null, colour: COLOUR, tooltip: t('blktip_tk_import_messagebox') },

        // ===== Вікно =====
        { type: "tk_create_root", message0: t('blk_tk_create_root'), args0: [{ type: "field_input", name: "VAR", text: "root" }], previousStatement: null, nextStatement: null, colour: COLOUR, tooltip: "root = tk.Tk()" },
        { type: "tk_set_title", message0: t('blk_tk_set_title'), args0: [{ type: "field_input", name: "VAR", text: "root" }, { type: "field_input", name: "TITLE", text: "My App" }], previousStatement: null, nextStatement: null, colour: COLOUR, tooltip: "root.title(...)" },
        { type: "tk_set_geometry", message0: t('blk_tk_set_geometry'), args0: [{ type: "field_input", name: "VAR", text: "root" }, { type: "field_number", name: "W", value: 300, min: 50 }, { type: "field_number", name: "H", value: 200, min: 50 }], previousStatement: null, nextStatement: null, colour: COLOUR, tooltip: "root.geometry('WxH')" },

        // ===== Створення віджетів (змінна = клас) =====
        { type: "tk_create_label", message0: t('blk_tk_create_label'), args0: [{ type: "field_input", name: "VAR", text: "label1" }, { type: "field_input", name: "PARENT", text: "root" }, { type: "field_input", name: "TEXT", text: "Hello!" }], previousStatement: null, nextStatement: null, colour: COLOUR, tooltip: "label1 = tk.Label(root, text='...')" },
        { type: "tk_create_entry", message0: t('blk_tk_create_entry'), args0: [{ type: "field_input", name: "VAR", text: "entry1" }, { type: "field_input", name: "PARENT", text: "root" }], previousStatement: null, nextStatement: null, colour: COLOUR, tooltip: "entry1 = tk.Entry(root)" },
        // tk_create_button, tk_create_checkbutton, tk_create_radiobutton,
        // tk_var_get, tk_entry_get, tk_pack — визначені нижче ІМПЕРАТИВНО
        // (не в цьому JSON-масиві), бо їм потрібні ДИНАМІЧНІ випадаючі
        // списки замість вільного тексту (див. коментар біля
        // makeVarDropdown нижче — виправлення бага з невідповідністю
        // імені змінної типу "btn.pack()" проти дефолтного "label1.pack()").

        // ===== Змінні tkinter (IntVar / StringVar) =====
        { type: "tk_create_intvar", message0: t('blk_tk_create_intvar'), args0: [{ type: "field_input", name: "VAR", text: "check_var" }], previousStatement: null, nextStatement: null, colour: COLOUR, tooltip: "check_var = tk.IntVar()" },
        { type: "tk_create_stringvar", message0: t('blk_tk_create_stringvar'), args0: [{ type: "field_input", name: "VAR", text: "radio_var" }, { type: "field_input", name: "DEFAULT", text: "Чоловіча" }], previousStatement: null, nextStatement: null, colour: COLOUR, tooltip: "radio_var = tk.StringVar(value='...')" },

        // ===== messagebox =====
        { type: "tk_messagebox_showinfo", message0: t('blk_tk_messagebox_showinfo'), args0: [{ type: "field_input", name: "TITLE", text: "Результат" }, { type: "input_value", name: "MESSAGE" }], previousStatement: null, nextStatement: null, colour: COLOUR, tooltip: "messagebox.showinfo('...', ...)" },

        // ===== Запуск =====
        { type: "tk_mainloop", message0: t('blk_tk_mainloop'), args0: [{ type: "field_input", name: "VAR", text: "root" }], previousStatement: null, nextStatement: null, colour: COLOUR_DARK, tooltip: t('blktip_tk_mainloop') }
    ]);

    // =====================================================================
    // БАГФІКС: динамічні випадаючі списки замість вільного тексту
    // =====================================================================
    // РАНІШЕ поля на кшталт "яку змінну показати (pack)" чи "яку функцію
    // викликати" були звичайними текстовими полями з фіксованим дефолтом
    // (напр. tk_pack завжди пропонував "label1"). Це створювало пастку:
    // перетягнули кнопку (за замовчуванням її змінна — "btn"), перетягнули
    // "Show (pack)" — а там усе ще "label1" за замовчуванням → у коді
    // виходило "label1.pack()", яке посилається на неіснуючу змінну, а
    // СПРАВЖНЯ "btn" ніде не показувалась. Треба було щоразу вручну
    // виправляти текст, легко забути.
    //
    // ВИПРАВЛЕННЯ: ці поля тепер — випадаючий список (Blockly.FieldDropdown),
    // що на льоту сканує робочу область і пропонує РЕАЛЬНІ імена змінних із
    // відповідних блоків (напр. tk_pack пропонує імена всіх уже створених
    // віджетів). Обрати помилкове ім'я стало неможливо.
    function makeVarDropdown(sourceTypes, fallbackName) {
        return new Blockly.FieldDropdown(function () {
            const block = this.getSourceBlock ? this.getSourceBlock() : this.sourceBlock_;
            const ws = block && block.workspace;
            const names = [];
            if (ws && typeof ws.getAllBlocks === 'function') {
                ws.getAllBlocks(false).forEach(b => {
                    if (sourceTypes.includes(b.type)) {
                        const v = b.getFieldValue('VAR');
                        if (v && !names.includes(v)) names.push(v);
                    }
                });
            }
            if (!names.length) return [[fallbackName, fallbackName]];
            return names.map(n => [n, n]);
        });
    }
    function makeFuncDropdown(fallbackName) {
        return new Blockly.FieldDropdown(function () {
            const block = this.getSourceBlock ? this.getSourceBlock() : this.sourceBlock_;
            const ws = block && block.workspace;
            const names = [];
            if (ws && typeof ws.getAllBlocks === 'function') {
                ws.getAllBlocks(false).forEach(b => {
                    if (b.type === 'define_function') {
                        const v = b.getFieldValue('FUNC_NAME');
                        if (v && !names.includes(v)) names.push(v);
                    }
                });
            }
            if (!names.length) return [[fallbackName, fallbackName]];
            return names.map(n => [n, n]);
        });
    }

    const WIDGET_TYPES = ['tk_create_label', 'tk_create_button', 'tk_create_entry', 'tk_create_checkbutton', 'tk_create_radiobutton'];

    Blockly.Blocks['tk_create_button'] = {
        init: function () {
            this.appendDummyInput()
                .appendField(t('blk_tk_button_prefix')).appendField(new Blockly.FieldTextInput('btn'), 'VAR')
                .appendField(t('blk_tk_in')).appendField(new Blockly.FieldTextInput('root'), 'PARENT')
                .appendField(t('blk_tk_text')).appendField(new Blockly.FieldTextInput('Click me'), 'TEXT')
                .appendField(t('blk_tk_on_click_call')).appendField(makeFuncDropdown('myfunc'), 'ONCLICK');
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(COLOUR);
            this.setTooltip("btn = tk.Button(root, text='...', command=myfunc)");
        }
    };
    Blockly.Blocks['tk_create_checkbutton'] = {
        init: function () {
            this.appendDummyInput()
                .appendField(t('blk_tk_checkbutton_prefix')).appendField(new Blockly.FieldTextInput('check_btn'), 'VAR')
                .appendField(t('blk_tk_in')).appendField(new Blockly.FieldTextInput('root'), 'PARENT')
                .appendField(t('blk_tk_text')).appendField(new Blockly.FieldTextInput('Отримувати новини'), 'TEXT')
                .appendField(t('blk_tk_variable')).appendField(makeVarDropdown(['tk_create_intvar'], 'check_var'), 'VARIABLE');
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(COLOUR);
            this.setTooltip("check_btn = tk.Checkbutton(root, text='...', variable=check_var)");
        }
    };
    Blockly.Blocks['tk_create_radiobutton'] = {
        init: function () {
            this.appendDummyInput()
                .appendField(t('blk_tk_radiobutton_prefix')).appendField(new Blockly.FieldTextInput('radio_1'), 'VAR')
                .appendField(t('blk_tk_in')).appendField(new Blockly.FieldTextInput('root'), 'PARENT')
                .appendField(t('blk_tk_text')).appendField(new Blockly.FieldTextInput('Чоловіча'), 'TEXT')
                .appendField(t('blk_tk_variable')).appendField(makeVarDropdown(['tk_create_stringvar'], 'radio_var'), 'VARIABLE')
                .appendField(t('blk_tk_value')).appendField(new Blockly.FieldTextInput('Чоловіча'), 'VALUE');
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(COLOUR);
            this.setTooltip("radio_1 = tk.Radiobutton(root, text='...', variable=radio_var, value='...')");
        }
    };
    Blockly.Blocks['tk_var_get'] = {
        init: function () {
            this.appendDummyInput()
                .appendField(t('blk_tk_value_of_variable')).appendField(makeVarDropdown(['tk_create_intvar', 'tk_create_stringvar'], 'check_var'), 'VAR');
            this.setOutput(true, null);
            this.setColour(COLOUR);
            this.setTooltip('check_var.get()');
        }
    };
    Blockly.Blocks['tk_entry_get'] = {
        init: function () {
            this.appendDummyInput()
                .appendField(t('blk_tk_text_of_field')).appendField(makeVarDropdown(['tk_create_entry'], 'entry1'), 'VAR');
            this.setOutput(true, 'String');
            this.setColour(COLOUR);
            this.setTooltip('entry1.get()');
        }
    };
    Blockly.Blocks['tk_pack'] = {
        init: function () {
            this.appendDummyInput()
                .appendField(t('blk_tk_show')).appendField(makeVarDropdown(WIDGET_TYPES, 'label1'), 'VAR')
                .appendField(t('blk_tk_pack_spacing')).appendField(new Blockly.FieldNumber(5, 0), 'PADY');
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(COLOUR);
            this.setTooltip(t('blktip_tk_pack'));
        }
    };
    } // кінець defineTkinterStaticBlocks()
    defineTkinterStaticBlocks();
    window.UPY_BLOCK_REDEFINERS = window.UPY_BLOCK_REDEFINERS || [];
    window.UPY_BLOCK_REDEFINERS.push(defineTkinterStaticBlocks);

    // ---------- Генератори Python (справжній tkinter-код, 1 оператор = 1 блок) ----------
    PY['import_tkinter'] = () => 'import tkinter as tk\n';
    PY['import_tkinter_messagebox'] = () => 'from tkinter import messagebox\n';

    PY['tk_create_root'] = block => `${ident(block, 'VAR', 'root')} = tk.Tk()\n`;
    PY['tk_set_title'] = block => `${ident(block, 'VAR', 'root')}.title("${esc(block.getFieldValue('TITLE'))}")\n`;
    PY['tk_set_geometry'] = block => {
        const w = block.getFieldValue('W') || 300, h = block.getFieldValue('H') || 200;
        return `${ident(block, 'VAR', 'root')}.geometry("${w}x${h}")\n`;
    };

    PY['tk_create_label'] = block =>
        `${ident(block, 'VAR', 'label1')} = tk.Label(${ident(block, 'PARENT', 'root')}, text="${esc(block.getFieldValue('TEXT'))}")\n`;

    PY['tk_create_button'] = block => {
        const fn = ident(block, 'ONCLICK', 'myfunc');
        return `${ident(block, 'VAR', 'btn')} = tk.Button(${ident(block, 'PARENT', 'root')}, text="${esc(block.getFieldValue('TEXT'))}", command=${fn})\n`;
    };

    PY['tk_create_entry'] = block =>
        `${ident(block, 'VAR', 'entry1')} = tk.Entry(${ident(block, 'PARENT', 'root')})\n`;

    PY['tk_create_checkbutton'] = block =>
        `${ident(block, 'VAR', 'check_btn')} = tk.Checkbutton(${ident(block, 'PARENT', 'root')}, text="${esc(block.getFieldValue('TEXT'))}", variable=${ident(block, 'VARIABLE', 'check_var')})\n`;

    PY['tk_create_radiobutton'] = block =>
        `${ident(block, 'VAR', 'radio_1')} = tk.Radiobutton(${ident(block, 'PARENT', 'root')}, text="${esc(block.getFieldValue('TEXT'))}", variable=${ident(block, 'VARIABLE', 'radio_var')}, value="${esc(block.getFieldValue('VALUE'))}")\n`;

    PY['tk_create_intvar'] = block => `${ident(block, 'VAR', 'check_var')} = tk.IntVar()\n`;
    PY['tk_create_stringvar'] = block => `${ident(block, 'VAR', 'radio_var')} = tk.StringVar(value="${esc(block.getFieldValue('DEFAULT'))}")\n`;
    PY['tk_var_get'] = block => [`${ident(block, 'VAR', 'x')}.get()`, 0];
    PY['tk_entry_get'] = block => [`${ident(block, 'VAR', 'entry1')}.get()`, 0];

    PY['tk_pack'] = block => {
        const pady = block.getFieldValue('PADY');
        return `${ident(block, 'VAR', 'label1')}.pack(pady=${pady})\n`;
    };

    PY['tk_messagebox_showinfo'] = block => {
        const msg = valueToCode(block, 'MESSAGE', '""');
        return `messagebox.showinfo("${esc(block.getFieldValue('TITLE'))}", ${msg})\n`;
    };

    PY['tk_mainloop'] = block => `${ident(block, 'VAR', 'root')}.mainloop()\n`;

    // ---------- Попередній перегляд (симуляція) у зоні виконання ----------
    // БАГФІКС: раніше клік по кнопці лише ВИВОДИВ текстове повідомлення
    // "у справжньому Python викликало б X()", але саму функцію не
    // виконував — тому "функція не виконується" (print усередині неї
    // ніде не з'являвся). Тепер клік дійсно ЗАПУСКАЄ тіло функції через
    // Skulpt (той самий інтерпретатор Python у браузері, що й кнопка
    // "▶ Запустити") — беремо лише визначення функцій (без самого
    // tkinter-вікна, яке Skulpt і так не підтримує) і викликаємо потрібну.
    async function runFunctionInPreview(funcName, ws) {
        if (typeof Sk === 'undefined') {
            outf(`\n(симуляція) натиснуто → викликало б ${funcName}() (бібліотеку Skulpt не завантажено, показую лише повідомлення)`);
            return;
        }
        let defsCode = '';
        ws.getTopBlocks(true).forEach(top => {
            let b = top;
            while (b) {
                if (b.type === 'define_function' && PY['define_function']) {
                    defsCode += PY['define_function'](b);
                }
                b = b.getNextBlock();
            }
        });
        if (!new RegExp(`^def\\s+${funcName}\\s*\\(`, 'm').test(defsCode)) {
            outf(`\n(симуляція) натиснуто → функцію "${funcName}()" не знайдено серед визначених "Define function" блоків — у справжньому Python це викликало б NameError.`);
            return;
        }
        const snippet = defsCode + `\n${funcName}()\n`;
        outf(`\n▶ ${funcName}():`);
        try {
            Sk.configure({ output: outf, read: (typeof builtinRead === 'function' ? builtinRead : undefined), execLimit: 5000, yieldLimit: 100 });
            await Sk.misceval.asyncToPromise(() => Sk.importMainWithBody("<stdin>", false, snippet, true));
        } catch (e) {
            const msg = e && e.toString ? e.toString() : String(e);
            outf(`\n[Tkinter] Не вдалось виконати ${funcName}() у браузері: ${msg}` +
                (/entry|messagebox|tk\.|\.get\(/.test(defsCode) ? '\n(Функція, схоже, звертається до tkinter-віджетів — це можна перевірити лише у справжньому Python.)' : ''));
        }
    }
    // Skulpt не вміє виконувати tkinter — тому замість спроби (яка завжди
    // впала б з помилкою) показуємо чесний візуальний макет, побудований
    // напряму зі структури блоків на робочій області. Віджет реально
    // з'являється на екрані лише коли зустрічається відповідний "pack" —
    // так само, як у справжньому tkinter.
    function renderTkinterPreview(code, ws) {
        const area = document.getElementById('turtle-area');
        area.innerHTML = '';

        const banner = document.createElement('div');
        banner.className = 'tk-preview-banner';
        banner.textContent = '🔍 Попередній перегляд Tkinter-вікна (симуляція в браузері — щоб побачити СПРАВЖНЄ вікно, скопіюйте код кнопкою "⬇ .py" і запустіть на комп’ютері)';
        area.appendChild(banner);

        const winFrame = document.createElement('div');
        winFrame.className = 'tk-preview-window';
        area.appendChild(winFrame);

        const titleBar = document.createElement('div');
        titleBar.className = 'tk-preview-titlebar';
        titleBar.textContent = 'Python';
        winFrame.appendChild(titleBar);

        const body = document.createElement('div');
        body.className = 'tk-preview-body';
        winFrame.appendChild(body);

        let width = 300, height = 200;
        const pendingWidgets = {}; // var name -> DOM-елемент (створено, ще не "запаковано")
        const varMeta = {}; // var name -> { kind: 'intvar'|'stringvar', el }

        ws.getTopBlocks(true).forEach(top => {
            let b = top;
            while (b) {
                const f = name => b.getFieldValue(name);
                if (b.type === 'tk_set_title') {
                    titleBar.textContent = f('TITLE') || 'Python';
                } else if (b.type === 'tk_set_geometry') {
                    width = parseInt(f('W'), 10) || 300;
                    height = parseInt(f('H'), 10) || 200;
                } else if (b.type === 'tk_create_label') {
                    const el = document.createElement('div');
                    el.className = 'tk-preview-label';
                    el.textContent = f('TEXT') || '';
                    pendingWidgets[f('VAR')] = el;
                } else if (b.type === 'tk_create_button') {
                    const el = document.createElement('button');
                    el.className = 'tk-preview-button';
                    el.textContent = f('TEXT') || 'Button';
                    const fn = f('ONCLICK') || '';
                    el.addEventListener('click', () => {
                        runFunctionInPreview(fn, ws);
                    });
                    pendingWidgets[f('VAR')] = el;
                } else if (b.type === 'tk_create_entry') {
                    const el = document.createElement('input');
                    el.type = 'text';
                    el.className = 'tk-preview-entry';
                    el.placeholder = f('VAR') || '';
                    pendingWidgets[f('VAR')] = el;
                } else if (b.type === 'tk_create_checkbutton') {
                    const wrap = document.createElement('label');
                    wrap.className = 'tk-preview-check';
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    wrap.appendChild(cb);
                    wrap.appendChild(document.createTextNode(f('TEXT') || ''));
                    pendingWidgets[f('VAR')] = wrap;
                } else if (b.type === 'tk_create_radiobutton') {
                    const wrap = document.createElement('label');
                    wrap.className = 'tk-preview-radio';
                    const rb = document.createElement('input');
                    rb.type = 'radio';
                    rb.name = 'tkpreview-' + (f('VARIABLE') || 'radio');
                    wrap.appendChild(rb);
                    wrap.appendChild(document.createTextNode(f('TEXT') || ''));
                    pendingWidgets[f('VAR')] = wrap;
                } else if (b.type === 'tk_pack') {
                    const w = pendingWidgets[f('VAR')];
                    if (w) body.appendChild(w);
                }
                b = b.getNextBlock();
            }
        });

        winFrame.style.width = width + 'px';
        winFrame.style.minHeight = height + 'px';
    }

    window.UPY_RUN_HANDLERS.push({
        test: code => /import\s+tkinter/.test(code),
        run: async (code, ws) => renderTkinterPreview(code, ws)
    });

    // =====================================================================
    // Розпізнавання tkinter-рядків у панелі коду (вимога: "уникнути
    // конфлікту з генеричним 'set X to ...'")
    // =====================================================================
    // РАНІШЕ будь-який введений/вставлений tkinter-рядок (напр.
    // "root = tk.Tk()") не мав СПЕЦІАЛЬНОГО розпізнавача в app.js, тому
    // завжди перетворювався на загальний блок "set X to [сирий вираз]"
    // (категорія "Змінні") — це і є той "конфлікт": одна й та сама дія
    // (створити віджет) могла виглядати як два РІЗНІ типи блоків залежно
    // від того, як код туди потрапив (перетягуванням чи текстом). Нижче —
    // розпізнавачі для найпоширеніших патернів, які повертають ПРАВИЛЬНИЙ
    // спеціальний блок (tk_create_root/tk_create_button/tk_pack/...).
    //
    // Розпізнаються КАНОНІЧНИЙ порядок параметрів (той самий, що генерують
    // блоки вище) — довільний порядок kwargs чи нестандартне форматування
    // й далі безпечно потраплять у загальний блок (просто без "розумного"
    // розпізнавання, без втрати коду).
    function unescapePyStr(raw) { return (raw || '').replace(/\\"/g, '"').replace(/\\\\/g, '\\'); }
    function extractPady(argsStr) {
        const m = (argsStr || '').match(/pady\s*=\s*(\d+)/);
        return m ? m[1] : '5';
    }
    const STR = '"((?:[^"\\\\]|\\\\.)*)"'; // "..." з підтримкою екранованих \" і \\

    function matchTkinterCreate(line) {
        let m;
        if (m = line.match(/^(\w+)\s*=\s*tk\.Tk\(\)$/)) return { varName: m[1], xml: leaf('tk_create_root', { VAR: m[1] }, 0).xml };
        if (m = line.match(new RegExp('^(\\w+)\\s*=\\s*tk\\.Label\\(\\s*([^,]+?)\\s*,\\s*text\\s*=\\s*' + STR + '\\s*\\)$')))
            return { varName: m[1], xml: leaf('tk_create_label', { VAR: m[1], PARENT: m[2], TEXT: unescapePyStr(m[3]) }, 0).xml };
        if (m = line.match(new RegExp('^(\\w+)\\s*=\\s*tk\\.Button\\(\\s*([^,]+?)\\s*,\\s*text\\s*=\\s*' + STR + '\\s*,\\s*command\\s*=\\s*(\\w+)\\s*\\)$')))
            return { varName: m[1], xml: leaf('tk_create_button', { VAR: m[1], PARENT: m[2], TEXT: unescapePyStr(m[3]), ONCLICK: m[4] }, 0).xml };
        if (m = line.match(/^(\w+)\s*=\s*tk\.Entry\(\s*([^)]+?)\s*\)$/))
            return { varName: m[1], xml: leaf('tk_create_entry', { VAR: m[1], PARENT: m[2] }, 0).xml };
        if (m = line.match(new RegExp('^(\\w+)\\s*=\\s*tk\\.Checkbutton\\(\\s*([^,]+?)\\s*,\\s*text\\s*=\\s*' + STR + '\\s*,\\s*variable\\s*=\\s*(\\w+)\\s*\\)$')))
            return { varName: m[1], xml: leaf('tk_create_checkbutton', { VAR: m[1], PARENT: m[2], TEXT: unescapePyStr(m[3]), VARIABLE: m[4] }, 0).xml };
        if (m = line.match(new RegExp('^(\\w+)\\s*=\\s*tk\\.Radiobutton\\(\\s*([^,]+?)\\s*,\\s*text\\s*=\\s*' + STR + '\\s*,\\s*variable\\s*=\\s*(\\w+)\\s*,\\s*value\\s*=\\s*' + STR + '\\s*\\)$')))
            return { varName: m[1], xml: leaf('tk_create_radiobutton', { VAR: m[1], PARENT: m[2], TEXT: unescapePyStr(m[3]), VARIABLE: m[4], VALUE: unescapePyStr(m[5]) }, 0).xml };
        if (m = line.match(/^(\w+)\s*=\s*tk\.IntVar\(\)$/)) return { varName: m[1], xml: leaf('tk_create_intvar', { VAR: m[1] }, 0).xml };
        if (m = line.match(new RegExp('^(\\w+)\\s*=\\s*tk\\.StringVar\\(\\s*value\\s*=\\s*' + STR + '\\s*\\)$')))
            return { varName: m[1], xml: leaf('tk_create_stringvar', { VAR: m[1], DEFAULT: unescapePyStr(m[2]) }, 0).xml };
        return null;
    }

    window.UPY_LINE_RECOGNIZERS.push(function (text, idx) {
        // БАГФІКС: рядки самих import'ів (без цього — вони не збігалися з
        // жодним патерном нижче і потрапляли у загальний "сирий" fallback-
        // блок, який виглядає й поводиться інакше, ніж звичайний блок
        // категорії "Старт" — саме це і було "збоєм відображення").
        if (text === 'import tkinter as tk') return { xml: leaf('import_tkinter', {}, idx).xml, nextIdx: idx + 1 };
        if (text === 'from tkinter import messagebox') return { xml: leaf('import_tkinter_messagebox', {}, idx).xml, nextIdx: idx + 1 };

        let m;
        if (m = text.match(new RegExp('^(\\w+)\\.title\\(\\s*' + STR + '\\s*\\)$')))
            return { xml: leaf('tk_set_title', { VAR: m[1], TITLE: unescapePyStr(m[2]) }, idx).xml, nextIdx: idx + 1 };
        if (m = text.match(/^(\w+)\.geometry\(\s*["'](\d+)[xX](\d+)["']\s*\)$/))
            return { xml: leaf('tk_set_geometry', { VAR: m[1], W: m[2], H: m[3] }, idx).xml, nextIdx: idx + 1 };
        if (m = text.match(/^(\w+)\.mainloop\(\)$/))
            return { xml: leaf('tk_mainloop', { VAR: m[1] }, idx).xml, nextIdx: idx + 1 };
        if (m = text.match(new RegExp('^messagebox\\.showinfo\\(\\s*' + STR + '\\s*,\\s*(.+)\\)$')))
            return { xml: leafWithValue('tk_messagebox_showinfo', { TITLE: unescapePyStr(m[1]) }, { MESSAGE: m[2] }, idx).xml, nextIdx: idx + 1 };

        // "X = tk.Щось(...)" — можливо, одразу з прикріпленим ".pack(...)"
        // (поширений ідіом "створити й одразу показати одним виразом"):
        // розбиваємо на ДВА окремі, правильно з'єднані блоки.
        let core = text, packArgs = null;
        const chainMatch = text.match(/^(.*\))\.pack\(([^)]*)\)$/);
        if (chainMatch && /=\s*tk\./.test(chainMatch[1])) { core = chainMatch[1]; packArgs = chainMatch[2]; }
        const created = matchTkinterCreate(core);
        if (created) {
            if (packArgs === null) return { xml: created.xml, nextIdx: idx + 1 };
            const packXml = leaf('tk_pack', { VAR: created.varName, PADY: extractPady(packArgs) }, idx).xml;
            return { xmls: [created.xml, packXml], nextIdx: idx + 1 };
        }

        // Самостійний "X.pack(...)" (найпоширеніший випадок — саме так це
        // генерують блоки вище, окремим рядком/блоком).
        if (m = text.match(/^(\w+)\.pack\((.*)\)$/))
            return { xml: leaf('tk_pack', { VAR: m[1], PADY: extractPady(m[2]) }, idx).xml, nextIdx: idx + 1 };

        return null;
    });

    // ---------- Дескриптор модуля ----------
    return {
        colour: COLOUR,
        // категорія Tkinter (нова, її не існувало у статичному toolbox)
        categoryXml: `
<category name="Tkinter" colour="${COLOUR}" data-i18n-cat="cat_tkinter">
    <block type="tk_create_root"></block>
    <block type="tk_set_title"></block>
    <block type="tk_set_geometry"></block>
    <block type="tk_create_label"></block>
    <block type="tk_create_button"></block>
    <block type="tk_create_entry"></block>
    <block type="tk_entry_get"></block>
    <block type="tk_create_checkbutton"></block>
    <block type="tk_create_radiobutton"></block>
    <block type="tk_create_intvar"></block>
    <block type="tk_create_stringvar"></block>
    <block type="tk_var_get"></block>
    <block type="tk_pack"></block>
    <block type="tk_messagebox_showinfo">
        <value name="MESSAGE"><shadow type="text"><field name="TEXT">Готово!</field></shadow></value>
    </block>
    <block type="tk_mainloop"></block>
</category>`,
        // блоки, що з'являються у категорії "Start" разом з модулем —
        // обидва import-блоки пофарбовані у колір цього ж модуля
        // (вимога #6), самі команди — у категорії Tkinter вище
        // (вимога #3/#5: у Start лишається лише "точка входу" імпорту).
        startBlocksXml:
            '<block type="import_tkinter"></block>' +
            '<block type="import_tkinter_messagebox"></block>'
    };
});
