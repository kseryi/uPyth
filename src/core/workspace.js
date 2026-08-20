// =====================================================================
// workspace.js — синхронізація Blockly-workspace ↔ Python-код, запуск,
// збереження/завантаження, мультимовність, підсвітка синтаксису
// =====================================================================
// Третій з чотирьох файлів колишнього app.js. Містить: переклад
// вбудованих рядків Blockly, статус/тост-повідомлення, ініціалізацію
// workspace і тему оформлення, автозбереження, підсвітку синтаксису
// Python, парсер Python→Blockly-XML (applyCodeToBlocks), запуск коду
// через Skulpt (runCode), завантаження уроків, збереження/завантаження
// проєкту (.xml) та вивантаження .py. Залежить від generator.js і
// blocks-turtle.js — має завантажуватись ПІСЛЯ них.
// =====================================================================


// ================= МУЛЬТИМОВНІСТЬ: вбудовані блоки Blockly =================
// Вимога: категорії Виведення/Змінні/Масиви/Цикли/Логіка/Математика
// частково складаються зі СТАНДАРТНИХ блоків Blockly (repeat/if/математичні
// операції/списки/змінні) — їхній текст NOT задається через наші message0,
// а через власну систему Blockly.Msg, яку бібліотека blockly.min.js містить
// лише англійською (перевірено: жодного кириличного символу у файлі).
// Офіційний український пакет локалізації Blockly сюди не підключено (не
// було доступу завантажити його) — тому переклад цих КОНКРЕТНИХ ключів
// написано вручну нижче, але через ТУ Ж САМУ систему t()/uk.js/en.js, щоб
// усі переклади лишались в ОДНОМУ місці (вимога: "чітко розділити" мови).
const BLOCKLY_CORE_MSG_KEYS = [
    'CONTROLS_REPEAT_TITLE', 'CONTROLS_REPEAT_INPUT_DO',
    'CONTROLS_WHILEUNTIL_OPERATOR_WHILE', 'CONTROLS_WHILEUNTIL_OPERATOR_UNTIL',
    'CONTROLS_FOR_TITLE', 'CONTROLS_FOR_INPUT_DO',
    'CONTROLS_FLOW_STATEMENTS_OPERATOR_BREAK', 'CONTROLS_FLOW_STATEMENTS_OPERATOR_CONTINUE',
    'CONTROLS_IF_MSG_IF', 'CONTROLS_IF_MSG_THEN', 'CONTROLS_IF_MSG_ELSE', 'CONTROLS_IF_MSG_ELSEIF',
    'LOGIC_BOOLEAN_TRUE', 'LOGIC_BOOLEAN_FALSE',
    'MATH_CHANGE_TITLE', 'MATH_CHANGE_TITLE_ITEM',
    'MATH_SINGLE_OP_ROOT', 'MATH_SINGLE_OP_ABSOLUTE',
    'MATH_ROUND_OPERATOR_ROUND', 'MATH_ROUND_OPERATOR_ROUNDUP', 'MATH_ROUND_OPERATOR_ROUNDDOWN',
    'MATH_MODULO_TITLE', 'MATH_RANDOM_INT_TITLE',
    'LISTS_CREATE_WITH_INPUT_WITH', 'LISTS_CREATE_WITH_CONTAINER_TITLE_ADD',
    'LISTS_LENGTH_TITLE', 'LISTS_ISEMPTY_TITLE',
    'LISTS_INDEX_OF_FIRST', 'LISTS_INDEX_OF_LAST',
    'LISTS_GET_INDEX_GET', 'LISTS_GET_INDEX_FROM_START', 'LISTS_GET_INDEX_FROM_END',
    'LISTS_GET_INDEX_FIRST', 'LISTS_GET_INDEX_LAST', 'LISTS_GET_INDEX_RANDOM',
    'LISTS_SET_INDEX_SET', 'LISTS_SET_INDEX_INPUT_TO',
    'TEXT_JOIN_TITLE_CREATEWITH',
    'VARIABLES_SET', 'VARIABLES_DEFAULT_NAME', 'VARIABLES_SET_CREATE_GET',
    'NEW_VARIABLE', 'RENAME_VARIABLE', 'DELETE_VARIABLE'
];
function applyBlocklyCoreMsgTranslations() {
    if (typeof Blockly === 'undefined' || !Blockly.Msg) return;
    BLOCKLY_CORE_MSG_KEYS.forEach(key => {
        Blockly.Msg[key] = t('blockly_msg_' + key);
    });
}

// ================= МУЛЬТИМОВНІСТЬ: оновлення toolbox =================
// Викликається з languages.js (window.onLanguageChanged) при кожній
// зміні мови. Оновлює атрибут "name" кожної категорії toolbox з
// data-i18n-cat, і якщо workspace вже створено — перемальовує сам
// toolbox. На ПЕРШОМУ виклику (ще до створення workspace, при
// початковому завантаженні сторінки) просто оновлює XML-атрибути —
// цього достатньо, бо Blockly.inject() прочитає вже перекладений XML.
function applyToolboxTranslations() {
    const toolboxEl = document.getElementById('toolbox');
    if (!toolboxEl) return;
    toolboxEl.querySelectorAll('category[data-i18n-cat]').forEach(cat => {
        cat.setAttribute('name', t(cat.getAttribute('data-i18n-cat')));
    });
    if (workspace && typeof workspace.updateToolbox === 'function') {
        workspace.updateToolbox(toolboxEl);
    }
}
window.onLanguageChanged = function (code) {
    applyToolboxTranslations(code);
    applyBlocklyCoreMsgTranslations();
    if (typeof window.redefineAllBlocksForLanguage === 'function') window.redefineAllBlocksForLanguage();
};

// ================= МУЛЬТИМОВНІСТЬ: перевизначення БЛОКІВ =================
// Вимога: підписи ПОЛІВ блоків (message0, підказки, підписи випадних
// списків) теж мають перемикатися з мовою — а не лише кнопки/меню/тексти.
// Blockly НЕ оновлює текст уже розміщених інстансів блоків автоматично,
// коли перевизначаєш їхній ТИП — тому робимо повний цикл: 1) перевизначити
// всі типи блоків (JSON-масиви message0 будуються заново з t()); 2)
// зберегти поточну робочу область в XML; 3) очистити й перезавантажити її
// з цього XML — щойно створені інстанси вже отримають нові підписи.
//
// Розширення (js/extensions/*.js) реєструють СВОЮ функцію перевизначення
// блоків через window.UPY_BLOCK_REDEFINERS.push(fn) — так само, як core
// (app.js) реєструє тут defineBlocksAndGenerators.
window.UPY_BLOCK_REDEFINERS = window.UPY_BLOCK_REDEFINERS || [];
window.UPY_BLOCK_REDEFINERS.push(() => defineBlocksAndGenerators());

window.redefineAllBlocksForLanguage = function redefineAllBlocksForLanguage() {
    // FIX: раніше цей guard стояв ПІСЛЯ forEach(...) нижче — тобто цикл
    // перевизначення блоків (включно з defineBlocksAndGenerators()) все
    // одно виконувався на ПЕРШОМУ виклику, до створення workspace, хоча
    // initializeWorkspace() і так викликає defineBlocksAndGenerators()
    // сама одразу після. Наслідок: блоки визначались двічі при кожному
    // завантаженні сторінки, і Blockly сипав у консоль десятки
    // попереджень "overwrites previous definition" (шкоди немає, але
    // це створює хибне враження, що щось зламано, і просто зайва
    // робота при кожному завантаженні).
    if (typeof workspace === 'undefined' || !workspace) return; // ще немає робочої області (перший виклик при завантаженні сторінки) — initializeWorkspace() і так визначить блоки сама
    window.UPY_BLOCK_REDEFINERS.forEach(fn => {
        try { fn(); } catch (e) { console.error('Помилка перевизначення блоків:', e); }
    });
    try {
        const xml = Blockly.Xml.workspaceToDom(workspace);
        suppressAutoRefresh = true;
        try {
            workspace.clear();
            Blockly.Xml.domToWorkspace(xml, workspace);
        } finally {
            suppressAutoRefresh = false;
        }
        refreshCode();
    } catch (e) { console.error('Помилка перезавантаження робочої області після зміни мови:', e); }
};

// output area
const outEl = document.getElementById('output');
function outf(text) { outEl.textContent += text; }

// Skulpt read helper
function builtinRead(x) {
    if (Sk.builtinFiles === undefined || Sk.builtinFiles['files'][x] === undefined)
        throw new Error("File not found: " + x);
    return Sk.builtinFiles['files'][x];
}

// ================= STATUS HELPER =================
function setStatus(text, kind) {
    const el = document.getElementById('status');
    el.textContent = text;
    el.className = 'status status-' + (kind || 'ready');
}

// ================= ТОСТ-СПОВІЩЕННЯ (правий нижній кут) =================
// Вимога: коли парсер коду автоматично виправляє дрібні неточності
// (перенесена дужка, зайві/недостатні пробіли, розірваний рядок) —
// показати спливаюче повідомлення про це, а не тихо змінювати код без
// пояснення.
// ================= ТОСТ-СПОВІЩЕННЯ (правий нижній кут) =================
// Вимога: коли парсер коду автоматично виправляє дрібні неточності
// (перенесена дужка, зайві/недостатні пробіли, розірваний рядок) —
// показати спливаюче повідомлення про це, а не тихо змінювати код без
// пояснення. Ключі "autofix_*" перекладені в js/locales/*.js (uk.js/en.js).
function reportCodeAutoFixes(fixes) {
    if (!fixes || !fixes.length) return;
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    const title = document.createElement('div');
    title.className = 'toast-title';
    title.textContent = '🛠 ' + t('autofix_toast_title');
    toast.appendChild(title);
    const list = document.createElement('ul');
    fixes.forEach(f => {
        const li = document.createElement('li');
        li.textContent = t('autofix_' + f);
        list.appendChild(li);
    });
    toast.appendChild(list);
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}
window.reportCodeAutoFixes = reportCodeAutoFixes;

// Clear output and turtle area
function clearTurtle() {
    outEl.textContent = '';
    const ta = document.getElementById('turtle-area');
    ta.innerHTML = '';
    currentTurtleName = 't';
    if (typeof Sk !== 'undefined' && Sk && Sk.TurtleGraphics && typeof Sk.TurtleGraphics.reset === 'function') {
        try { Sk.TurtleGraphics.reset(); } catch (_) {}
    }
    // Якщо активний модуль має власну "адаптовану" 3-тю панель (напр. Pico
    // — плата замість полотна), "Reset" не повинен її прибирати назавжди —
    // одразу відновлюємо цей вигляд.
    if (typeof window.updateActivePanel === 'function') window.updateActivePanel();
    setStatus(t('status_ready'), 'ready');
}

function debounce(fn, delay) {
    let t;
    return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), delay);
    };
}

// ================= THEME =================
// FIX #1: у попередній версії кольори панелі команд (toolbox) виставлялись
// вручну через JS (setTimeout + querySelector('.blocklyTreeLabel')). Ця
// версія Blockly (12.x) вже давно не використовує клас .blocklyTreeLabel —
// він належить старому "дерев'яному" toolbox з Blockly ≤7. У сучасному
// toolbox класи інші (.blocklyToolboxCategoryLabel, .blocklyToolbox), тому
// хак нічого не робив і назви категорій лишались стандартного (світлого)
// кольору на світлому фоні toolbox. Правильний спосіб — задати кольори
// через componentStyles теми, як показано нижче.
const MyTheme = Blockly.Theme.defineTheme('mytheme', {
  base: Blockly.Themes.Classic,
  componentStyles: {
    toolboxBackgroundColour: '#1e3a8a',
    toolboxForegroundColour: '#facc15',
    flyoutBackgroundColour: '#111827',
    flyoutForegroundColour: '#e5e7eb',
    flyoutOpacity: 1,
    scrollbarColour: '#334155',
    scrollbarOpacity: 0.8,
    insertionMarkerColour: '#60a5fa',
    insertionMarkerOpacity: 0.35,
    cursorColour: '#60a5fa',
  },
  blockStyles: {
    loop_blocks: { colourPrimary: "#FFAA00", colourSecondary: '#cf8b04', colourTertiary: '#cf8b04' },
    math_blocks: { colourPrimary: "#10b981", colourSecondary: "#039c69", colourTertiary: '#039c69' },
    logic_blocks: { colourPrimary: "#FFAA00", colourSecondary: "#cf8b04", colourTertiary: "#cf8b04" },
    variable_blocks: { colourPrimary: "#0ea5e9", colourSecondary: "#0284c7", colourTertiary: "#0369a1" },
    text_blocks: { colourPrimary: "#8059ff", colourSecondary: "#6d43e0", colourTertiary: "#5433c2" },
    procedure_blocks: { colourPrimary: "#a855f7", colourSecondary: "#7c3aed", colourTertiary: "#6d28d9", hat: false }
  }
});

// ================= INITIALIZE BLOCKLY =================
function initializeWorkspace() {
    workspace = Blockly.inject('blocklyDiv', {
        toolbox: document.getElementById('toolbox'),
        renderer: 'zelos',
        scrollbars: true,
        trashcan: true,
        collapse: true,
        sounds: false,
        grid: { spacing: 20, length: 3, colour: '#1f2937', snap: true },
        zoom: { controls: true, wheel: true },
        theme: MyTheme,
    });

    const blocklyArea = document.getElementById('blocklyArea');
    const blocklyDiv = document.getElementById('blocklyDiv');

    function onResize() {
        const r = blocklyArea.getBoundingClientRect();
        blocklyDiv.style.left = '0px';
        blocklyDiv.style.top = '0px';
        blocklyDiv.style.width = r.width + 'px';
        blocklyDiv.style.height = r.height + 'px';
        Blockly.svgResize(workspace);
    }
    handleBlocklyResize = onResize;

    window.addEventListener('resize', onResize);
    onResize();

    defineBlocksAndGenerators();

    // Знімаємо обмеження типів (check) з вбудованих Blockly-блоків.
    // Blockly за замовчуванням виставляє check:'Number' на входах
    // math_arithmetic, controls_repeat_ext і т.д., що не дозволяє
    // вставляти туди текстові блоки (text_literal, to_str) навіть коли
    // це має сенс у Python (рядки складаються через +). Знімаємо check
    // лише на value-inputs (не на statement-inputs і не на полях).
    [
        'math_arithmetic', 'math_random_int', 'math_single', 'math_round',
        'math_modulo', 'math_change', 'controls_repeat_ext', 'controls_whileUntil',
        'logic_compare', 'logic_operation', 'logic_negate',
        'lists_create_with', 'lists_getIndex', 'lists_setIndex',
        'lists_indexOf', 'lists_isEmpty', 'lists_length',
    ].forEach(type => {
        const blk = Blockly.Blocks[type];
        if (!blk) return;
        const orig = blk.init;
        blk.init = function() {
            orig.call(this);
            this.inputList.forEach(input => {
                if (input.type === Blockly.inputs.inputTypes.VALUE) {
                    input.setCheck(null);
                }
            });
        };
    });

    registerFunctionBlockWatcher();

    // FIX: під час applyCodeToBlocks() workspace.clear() + domToWorkspace()
    // спричиняють ПРОМІЖНІ change-події (у т.ч. на ПОРОЖНІЙ робочій
    // області, до того як нові блоки встигли завантажитись). Якщо їм
    // дозволити викликати refreshCode() автоматично, це псує позицію
    // курсора в textarea (курсор "стрибав" всередину тимчасового
    // "# add blocks"), і символи, набрані одразу після Enter, потрапляли
    // не в те місце — виглядало як мимовільний "саморух" тексту.
    // suppressAutoRefresh вимикає ці проміжні виклики; фінальний
    // refreshCode() викликається один раз, явно, у applyCodeToBlocks().
    workspace.addChangeListener((e) => { if (!e.isUiEvent && !suppressAutoRefresh) refreshCode(); });
    workspace.addChangeListener(debounce(autoSaveWorkspace, 500));

    restoreAutoSavedWorkspace().then(refreshCode);
}

// ================= XML HELPER (FIX) =================
// БАГ: у цій версії Blockly НЕМАЄ методу Blockly.Xml.textToDom (він
// перенесений у Blockly.utils.xml.textToDom). Через це раніше ламались
// Example/Save/Load/автозбереження/синхронізація код→блоки — усі кидали
// "TypeError: Blockly.Xml.textToDom is not a function". Це підтверджено
// прямим тестом у реальному браузері.
function xmlTextToDom(text) {
    if (Blockly.utils && Blockly.utils.xml && typeof Blockly.utils.xml.textToDom === 'function') return Blockly.utils.xml.textToDom(text);
    if (Blockly.Xml && typeof Blockly.Xml.textToDom === 'function') return Blockly.Xml.textToDom(text);
    return new DOMParser().parseFromString(text, 'text/xml').documentElement;
}

// ================= AUTOSAVE (крашрекавері у фоні) =================
const AUTOSAVE_KEY = 'uPy.autosave.xml';

function autoSaveWorkspace() {
    try {
        const dom = Blockly.Xml.workspaceToDom(workspace);
        localStorage.setItem(AUTOSAVE_KEY, Blockly.Xml.domToText(dom));
    } catch (e) { console.warn('Auto-save failed:', e); }
}
async function restoreAutoSavedWorkspace() {
    try {
        const xml = localStorage.getItem(AUTOSAVE_KEY);
        if (!xml) return;
        // Вимога #7: якщо збережений проєкт містить блоки якогось модуля
        // (Turtle/Tkinter/Pico), спершу вмикаємо цей модуль — інакше
        // Blockly не знайде визначення типу блоку.
        if (window.ensureModulesForXmlText) await window.ensureModulesForXmlText(xml);
        Blockly.Xml.domToWorkspace(xmlTextToDom(xml), workspace);
    } catch (e) { console.warn('Auto-restore failed:', e); }
}
function workspaceHasBlocks() {
    return workspace && workspace.getAllBlocks(false).length > 0;
}

// ================= REFRESH CODE (Blocks → Python) =================
function refreshCode() {
    if (!window.__workspaceToPython) return;
    try {
        let code = window.__workspaceToPython(workspace) || '';
        const codeEl = document.getElementById('code');
        const isFocused = document.activeElement === codeEl;
        const selStart = codeEl.selectionStart;
        const selEnd = codeEl.selectionEnd;
        codeEl.value = code || "# add blocks";
        // FIX: якщо textarea в фокусі (людина щойно друкувала), зберігаємо
        // позицію курсора — інакше після кожного оновлення .value курсор
        // стрибав на початок, і продовжувати друкувати було незручно.
        if (isFocused) {
            const pos = Math.min(selStart, codeEl.value.length);
            const pos2 = Math.min(selEnd, codeEl.value.length);
            codeEl.setSelectionRange(pos, pos2);
        }
        lastSyncedCode = codeEl.value;
        syncHighlightOverlay();
    } catch (e) {
        document.getElementById('code').value = "# Помилка генерації: " + e;
        console.error(e);
        syncHighlightOverlay();
    }
}

// =====================================================================
// ПІДСВІТКА СИНТАКСИСУ PYTHON (вимога: "доцільно додати підсвітку тексту
// відповідно до кодування Python")
// =====================================================================
// Легкий власний підсвічувач (без зовнішніх бібліотек типу CodeMirror —
// щоб не залежати від CDN, який тут і так вже раз підводив, див. коментар
// на початку файлу). Техніка: під textarea (текст якої робимо прозорим,
// лишаючи лише каретку видимою) лежить <pre><code> з тим самим текстом,
// розфарбованим у <span>. Прокрутка й розміри синхронізуються вручну.
const PY_KEYWORDS_HL = new Set([
    'def', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'import', 'from',
    'as', 'break', 'continue', 'pass', 'True', 'False', 'None', 'and', 'or', 'not',
    'class', 'try', 'except', 'finally', 'with', 'lambda', 'yield', 'global', 'is'
]);
function escapeHtmlForCode(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function highlightPythonLine(line) {
    // Токенізація одного рядка: коментар / рядковий літерал / число /
    // ключове слово / виклик-функції(ідентифікатор перед "(") / інше.
    let out = '';
    let i = 0;
    const n = line.length;
    while (i < n) {
        const ch = line[i];
        if (ch === '#') {
            out += `<span class="hl-com">${escapeHtmlForCode(line.slice(i))}</span>`;
            break;
        }
        if (ch === '"' || ch === "'") {
            const quote = ch;
            let j = i + 1;
            while (j < n && line[j] !== quote) { if (line[j] === '\\') j++; j++; }
            j = Math.min(j + 1, n);
            out += `<span class="hl-str">${escapeHtmlForCode(line.slice(i, j))}</span>`;
            i = j;
            continue;
        }
        if (/[0-9]/.test(ch) && (i === 0 || !/[A-Za-z_0-9]/.test(line[i - 1]))) {
            let j = i;
            while (j < n && /[0-9.]/.test(line[j])) j++;
            out += `<span class="hl-num">${escapeHtmlForCode(line.slice(i, j))}</span>`;
            i = j;
            continue;
        }
        if (/[A-Za-z_]/.test(ch)) {
            let j = i;
            while (j < n && /[A-Za-z0-9_]/.test(line[j])) j++;
            const word = line.slice(i, j);
            if (PY_KEYWORDS_HL.has(word)) {
                out += `<span class="hl-kw">${escapeHtmlForCode(word)}</span>`;
            } else if (line[j] === '(') {
                out += `<span class="hl-fn">${escapeHtmlForCode(word)}</span>`;
            } else {
                out += escapeHtmlForCode(word);
            }
            i = j;
            continue;
        }
        out += escapeHtmlForCode(ch);
        i++;
    }
    return out;
}
function highlightPython(code) {
    return code.split('\n').map(highlightPythonLine).join('\n');
}
function syncHighlightOverlay() {
    const codeEl = document.getElementById('code');
    const inner = document.getElementById('codeHighlightInner');
    if (!codeEl || !inner) return;
    // textarea завжди має закінчуватись символом нового рядка для того,
    // щоб висота <pre> збігалась (стандартний трюк цієї техніки).
    inner.innerHTML = highlightPython(codeEl.value) + '\n';
    const pre = document.getElementById('codeHighlight');
    if (pre) { pre.scrollTop = codeEl.scrollTop; pre.scrollLeft = codeEl.scrollLeft; }
}

// =====================================================================
// IMPROVEMENT #4: синхронізація Python → Blocks (двосторонній зв'язок)
// =====================================================================
// ЧЕСНО ПРО ОБМЕЖЕННЯ: довільний Python неможливо гарантовано розкласти
// назад на блоки — Blockly оперує фіксованим набором конструкцій, а
// текстовий Python необмежений. Тому нижче реалізовано розпізнавання
// саме того "бекграунд-словника" конструкцій, які вміють генерувати наші
// ж блоки (turtle-команди, if/elif/else, for/while, def, print, змінні,
// break/continue, прості вирази). Усе, що не впізнано, не губиться —
// загортається в сірий блок-заглушку "🐍 ..." зі збереженим вихідним
// текстом, щоб код і далі виконувався коректно.

function escapeXml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// БАГФІКС/ВИМОГА: коментарі в коді (як "рядок повністю коментар", так і
// "код #коментар в кінці рядка") НЕ повинні перетворюватись на блоки — їх
// просто відкидаємо ще до розпізнавання. Враховуємо рядкові літерали
// (символ "#" усередині "..."/'...' не є коментарем).
function stripInlineComment(line) {
    let inStr = null;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inStr) {
            if (c === '\\') { i++; continue; }
            if (c === inStr) inStr = null;
            continue;
        }
        if (c === '"' || c === "'") { inStr = c; continue; }
        if (c === '#') return line.slice(0, i);
    }
    return line;
}

// Рахує баланс дужок у рядку (поза рядковими літералами й коментарями) —
// потрібно, щоб зрозуміти, чи оператор ще "не закритий" і продовжується
// на наступному фізичному рядку (типово при вставці автоформатованого
// коду, де виклик функції розбито на кілька рядків, або коли дужку
// випадково перенесли на новий рядок).
function scanParenDelta(line) {
    let delta = 0, inStr = null;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inStr) {
            if (c === '\\') { i++; continue; }
            if (c === inStr) inStr = null;
            continue;
        }
        if (c === '"' || c === "'") { inStr = c; continue; }
        if (c === '(' || c === '[' || c === '{') delta++;
        if (c === ')' || c === ']' || c === '}') delta--;
    }
    return delta;
}

// Те саме, що scanParenDelta, але зберігає СТЕК відкритих дужок (а не
// лише число) — потрібно, щоб при автозакритті в кінці коду знати, ЯКІ
// саме дужки дописати і в якому порядку (вимога: "забув закрити дужку —
// дописати автоматично").
function scanBracketStack(line, stack) {
    let inStr = null;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inStr) {
            if (c === '\\') { i++; continue; }
            if (c === inStr) inStr = null;
            continue;
        }
        if (c === '"' || c === "'") { inStr = c; continue; }
        if (c === '(' || c === '[' || c === '{') stack.push(c);
        if (c === ')' || c === ']' || c === '}') stack.pop();
    }
    return stack;
}
const BRACKET_CLOSE_FOR = { '(': ')', '[': ']', '{': '}' };

// Схлопує ПОВТОРНІ пробіли всередині рядка (поза рядковими літералами) —
// вимога "недостатня/зайва кількість пробілів". Ніколи не чіпає вміст
// "..."/'...' — там пробіли можуть бути значущими.
function normalizeSpacing(text) {
    let out = '', inStr = null;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inStr) {
            out += c;
            if (c === '\\' && i + 1 < text.length) { out += text[i + 1]; i++; continue; }
            if (c === inStr) inStr = null;
            continue;
        }
        if (c === '"' || c === "'") { inStr = c; out += c; continue; }
        if (c === ' ' && out.endsWith(' ')) continue;
        out += c;
    }
    return out;
}

function tokenizeLines(code) {
    const rawLines = code.replace(/\t/g, '    ').split('\n')
        .map(l => l.replace(/\r$/, ''))
        .map(stripInlineComment);

    const autoFixes = []; // для спливаючого сповіщення в кутку екрана

    // БАГФІКС: рядок може бути "незавершеним" не лише через незакриту
    // дужку, а й через крапку/оператор у кінці (напр. користувач
    // випадково перейшов на новий рядок одразу після "neopixel." —
    // без жодної дужки, тому попередня перевірка стеку дужок сама по
    // собі не бачила проблеми і "губила" продовження команди).
    function endsWithContinuationToken(text) {
        const t = text.trimEnd();
        if (t === '') return false;
        if (/\.$/.test(t)) return true; // "neopixel."
        if (/(?:[+\-*/%,]|\*\*|==|!=|<=|>=|=)\s*$/.test(t)) return true; // "x =", "a +", "f(x,"
        if (/\b(and|or|not|in|is)$/.test(t)) return true;
        return false;
    }

    // КРОК 1: об'єднання рядків із незакритими дужками АБО обірваними на
    // крапці/операторі (вимога: "переніс дужки на новий рядок" — а також
    // будь-яке інше очевидно незавершене місце — автовиправлення).
    // Наприклад:
    //   btn = tk.Button(
    //       root, text="Click me"
    //   )
    // або
    //   np = neopixel.
    //   NeoPixel(machine.Pin(0), 8)
    // стають одним логічним рядком ще ДО розпізнавання команд.
    const parenMerged = [];
    let buf = null, stack = [];
    for (const raw of rawLines) {
        if (buf === null) {
            if (raw.trim() === '') continue;
            buf = raw;
            stack = scanBracketStack(raw, []);
        } else {
            // Якщо попередній рядок обірвався на "." — приєднуємо БЕЗ
            // пробілу (щоб лишилось "neopixel.NeoPixel(...)", а не
            // "neopixel. NeoPixel(...)" — друге теж технічно валідний
            // Python, але перше однозначно збігається з тим, що генерують
            // наші ж блоки, і його гарантовано розпізнають усі регулярки).
            buf += (/\.$/.test(buf.trimEnd()) ? '' : ' ') + raw.trim();
            scanBracketStack(raw, stack);
            autoFixes.push('merged_broken_line');
        }
        if (stack.length > 0 || endsWithContinuationToken(buf)) continue; // ще не завершено — чекаємо продовження
        parenMerged.push(buf);
        buf = null; stack = [];
    }
    if (buf !== null) {
        // Дійшли до кінця коду, а дужка так і лишилась незакритою — це і є
        // "забув закрити дужку": дописуємо відповідні закривальні символи
        // автоматично (в правильному порядку) замість того, щоб залишити
        // оператор зламаним.
        if (stack.length > 0) {
            const closing = stack.slice().reverse().map(c => BRACKET_CLOSE_FOR[c]).join('');
            buf += closing;
            autoFixes.push('autoclosed_bracket');
        }
        parenMerged.push(buf);
    }

    // КРОК 2: захист від "розірваних" операторів на кшталт
    //   btn = tk.Button(root, text="Click me", command=myfunc)
    //   .pack()
    // Рядок, що починається з "." сам по собі НІКОЛИ не є валідним
    // окремим Python-оператором — тому завжди безпечно приєднати його до
    // попереднього (це не ловиться кроком 1, бо дужки там уже збалансовані
    // в першому рядку).
    const joined = [];
    for (const line of parenMerged) {
        const trimmed = line.trim();
        if (trimmed.startsWith('.') && joined.length && joined[joined.length - 1].trim() !== '') {
            joined[joined.length - 1] += trimmed;
            autoFixes.push('joined_leading_dot');
        } else {
            joined.push(line);
        }
    }

    // КРОК 3: індентація + нормалізація зайвих/недостатніх пробілів у
    // самому вмісті рядка (не в лідируючих відступах — вони визначають
    // структуру блоків і не чіпаються).
    const indentStack = [0];
    const result = [];
    for (const line of joined) {
        const trimmed = line.trim();
        if (trimmed === '') continue;
        const width = (line.match(/^ */) || [''])[0].length;
        const normalized = normalizeSpacing(trimmed);
        if (normalized !== trimmed) autoFixes.push('normalized_spacing');
        while (indentStack.length > 1 && width < indentStack[indentStack.length - 1]) indentStack.pop();
        if (width > indentStack[indentStack.length - 1]) indentStack.push(width);
        result.push({ indent: indentStack.length - 1, text: normalized });
    }

    if (autoFixes.length && typeof window.reportCodeAutoFixes === 'function') {
        window.reportCodeAutoFixes(Array.from(new Set(autoFixes)));
    }
    return result;
}

function splitTopLevel(str, delimiters, isComma) {
    let depth = 0, inStr = null;
    for (let i = 0; i < str.length; i++) {
        const c = str[i];
        if (inStr) { if (c === '\\') { i++; continue; } if (c === inStr) inStr = null; continue; }
        if (c === '"' || c === "'") { inStr = c; continue; }
        if (c === '(') { depth++; continue; }
        if (c === ')') { depth--; continue; }
        if (depth === 0) {
            if (isComma) {
                if (c === ',') return i;
            } else {
                for (const op of delimiters) {
                    if (str.startsWith(op, i) && str.slice(0, i).trim() !== '') return { i, op };
                }
            }
        }
    }
    return isComma ? -1 : null;
}

// matchCall(s, fnName) — перевіряє, чи рядок s є викликом fnName(...)
// де ЗАКРИВАЮЧА ДУЖКА — останній символ (тобто fnName(...) не є частиною
// більшого виразу типу str("a") + str("b")). Повертає вміст дужок або null.
// Використовує splitTopLevel для правильного врахування вкладених дужок і рядків.
function matchCall(s, fnName) {
    const prefix = fnName + '(';
    if (!s.startsWith(prefix) || s[s.length - 1] !== ')') return null;
    // Знаходимо пару для першої '(' — вона має закриватись саме на останньому символі
    let depth = 0, inStr = null;
    for (let i = fnName.length; i < s.length; i++) {
        const c = s[i];
        if (inStr) { if (c === '\\') { i++; continue; } if (c === inStr) inStr = null; continue; }
        if (c === '"' || c === "'") { inStr = c; continue; }
        if (c === '(') { depth++; continue; }
        if (c === ')') {
            depth--;
            if (depth === 0) {
                // Закриваюча дужка має бути останньою
                if (i === s.length - 1) return s.slice(fnName.length + 1, i);
                return null; // є ще щось після дужки — це частина більшого виразу
            }
        }
    }
    return null;
}

function splitTopLevelComma(str) {
    const parts = []; let rest = str;
    while (true) {
        const i = splitTopLevel(rest, null, true);
        if (i === -1) { parts.push(rest.trim()); break; }
        parts.push(rest.slice(0, i).trim());
        rest = rest.slice(i + 1);
    }
    return parts;
}

const CMP_OPS = { '==': 'EQ', '!=': 'NEQ', '<=': 'LTE', '>=': 'GTE', '<': 'LT', '>': 'GT' };
const ARITH_OPS = { '**': 'POWER', '+': 'ADD', '-': 'MINUS', '*': 'MULTIPLY', '/': 'DIVIDE' };
const OP_TOKENS = ['**', '==', '!=', '<=', '>=', '<', '>', '+', '-', '*', '/'];

function stripOuterParens(s) {
    s = s.trim();
    if (s[0] !== '(' || s[s.length - 1] !== ')') return s;
    let depth = 0;
    for (let i = 0; i < s.length; i++) {
        if (s[i] === '(') depth++;
        else if (s[i] === ')') { depth--; if (depth === 0 && i !== s.length - 1) return s; }
    }
    return s.slice(1, -1).trim();
}

const PY_KEYWORDS = new Set(['True', 'False', 'None', 'and', 'or', 'not', 'import']);

function parseExpr(exprStrRaw) {
    const s = (exprStrRaw || '').trim();
    if (s === '') return `<block type="raw_python_expr"><field name="CODE"></field></block>`;
    if (/^-?\d+(\.\d+)?$/.test(s)) return `<block type="math_number"><field name="NUM">${s}</field></block>`;
    let strMatch = s.match(/^'([^'\\]*(?:\\.[^'\\]*)*)'$/) || s.match(/^"([^"\\]*(?:\\.[^"\\]*)*)"$/);
    if (strMatch) {
        const unescaped = strMatch[1].replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, '\\');
        return `<block type="text_literal"><field name="TEXT">${escapeXml(unescaped)}</field></block>`;
    }
    if (s === 'True' || s === 'False') return `<block type="logic_boolean"><field name="BOOL">${s.toUpperCase()}</field></block>`;
    let m = s.match(/^random\.randint\((.+)\)$/);
    if (m) {
        const parts = splitTopLevelComma(m[1]);
        if (parts.length === 2) {
            return `<block type="math_random_int"><value name="FROM">${parseExpr(parts[0])}</value><value name="TO">${parseExpr(parts[1])}</value></block>`;
        }
    }
    // ГРУПА "ВВЕДЕННЯ" (input_value/to_int/to_float/to_str) — без цих 4
    // патернів input()/int()/float()/str() потрапляли в фолбек нижче
    // (raw_python_expr, сірий блок-заглушка), бо в парсері не було
    // розпізнавання цих builtin-викликів. input() окремо, бо аргумент
    // необов'язковий (input() без дужок-вмісту — валідний Python).
    { // використовуємо matchCall замість regex для коректного балансу дужок
        const inputArg = matchCall(s, 'input');
        if (inputArg !== null) {
            const arg = inputArg.trim();
            return `<block type="input_value">${arg === '' ? '' : `<value name="PROMPT">${parseExpr(arg)}</value>`}</block>`;
        }
        const intArg = matchCall(s, 'int');
        if (intArg !== null) return `<block type="to_int"><value name="VALUE">${parseExpr(intArg)}</value></block>`;
        const floatArg = matchCall(s, 'float');
        if (floatArg !== null) return `<block type="to_float"><value name="VALUE">${parseExpr(floatArg)}</value></block>`;
        const strArg = matchCall(s, 'str');
        if (strArg !== null) return `<block type="to_str"><value name="VALUE">${parseExpr(strArg)}</value></block>`;
    }

    // math_single: abs(x), math.sqrt(x) і т.д. — через matchCall щоб
    // abs(x) + abs(y) не ковтало весь вираз через жадібний regex
    { const MATH_SINGLE_OPS = { 'abs':'ABS', 'math.sqrt':'ROOT', 'math.log':'LN',
        'math.log10':'LOG10', 'math.exp':'EXP', 'math.ceil':'ROUNDUP', 'math.floor':'ROUNDDOWN' };
      for (const [fn, op] of Object.entries(MATH_SINGLE_OPS)) {
        const arg = matchCall(s, fn);
        if (arg !== null) {
            if (op === 'ROUNDUP' || op === 'ROUNDDOWN')
                return `<block type="math_round"><field name="OP">${op}</field><value name="NUM">${parseExpr(arg)}</value></block>`;
            return `<block type="math_single"><field name="OP">${op}</field><value name="NUM">${parseExpr(arg)}</value></block>`;
        }
      }
    }
    // math.sin/cos/tan(math.radians(x))
    { const mTrig = s.match(/^math\.(sin|cos|tan)\(math\.radians\((.+)\)\)$/);
      if (mTrig && matchCall(s, `math.${mTrig[1]}`) !== null)
        return `<block type="math_single"><field name="OP">${mTrig[1].toUpperCase()}</field><value name="NUM">${parseExpr(mTrig[2])}</value></block>`;
    }
    { const roundArg = matchCall(s, 'round');
      if (roundArg !== null) return `<block type="math_round"><field name="OP">ROUND</field><value name="NUM">${parseExpr(roundArg)}</value></block>`;
    }
    { const lenArg = matchCall(s, 'len');
      if (lenArg !== null) return `<block type="text_length"><value name="VALUE">${parseExpr(lenArg)}</value></block>`;
    }
    // (len(x) == 0) → lists_isEmpty
    let mEmpty = s.match(/^\(?len\((.+)\)\s*==\s*0\)?$/);
    if (mEmpty) return `<block type="lists_isEmpty"><value name="VALUE">${parseExpr(mEmpty[1])}</value></block>`;
    // [a, b, c] → lists_create_with
    if (/^\[.*\]$/.test(s)) {
        const inner = s.slice(1, -1).trim();
        const items = inner === '' ? [] : splitTopLevelComma(inner);
        const itemsXml = items.map((item, i) => `<value name="ADD${i}">${parseExpr(item)}</value>`).join('');
        return `<block type="lists_create_with"><mutation items="${items.length}"></mutation>${itemsXml}</block>`;
    }
    // a[i] → lists_getIndex
    let mIdx = s.match(/^([A-Za-z_]\w*)\[(.+)\]$/);
    if (mIdx) {
        return `<block type="lists_getIndex"><field name="MODE">GET</field><field name="WHERE">FROM_START</field><value name="VALUE">${parseExpr(mIdx[1])}</value><value name="AT">${parseExpr(mIdx[2])}</value></block>`;
    }
    // a.index(x) → lists_indexOf
    let mIndexOf = s.match(/^([A-Za-z_]\w*)\.index\((.+)\)$/);
    if (mIndexOf) {
        return `<block type="lists_indexOf"><field name="END">FIRST</field><value name="VALUE">${parseExpr(mIndexOf[1])}</value><value name="FIND">${parseExpr(mIndexOf[2])}</value></block>`;
    }

    if (/^[A-Za-z_]\w*$/.test(s) && !PY_KEYWORDS.has(s)) {
        return `<block type="variables_get"><field name="VAR">${escapeXml(s)}</field></block>`;
    }
    const stripped = stripOuterParens(s);
    // math_modulo: (a % b) — перевіряємо ОКРЕМО до загального splitTopLevel,
    // бо math_modulo — це окремий блок від math_arithmetic, і '%' не має
    // потрапляти в ARITH_OPS-гілку нижче.
    const modSplit = splitTopLevel(stripped, ['%'], false);
    if (modSplit) {
        const left = stripped.slice(0, modSplit.i).trim();
        const right = stripped.slice(modSplit.i + 1).trim();
        if (left !== '' && right !== '') {
            return `<block type="math_modulo"><value name="DIVIDEND">${parseExpr(left)}</value><value name="DIVISOR">${parseExpr(right)}</value></block>`;
        }
    }
    const split = splitTopLevel(stripped, OP_TOKENS, false);
    if (split) {
        const left = stripped.slice(0, split.i).trim();
        const right = stripped.slice(split.i + split.op.length).trim();
        if (left !== '' && right !== '') {
            if (CMP_OPS[split.op]) {
                return `<block type="logic_compare"><field name="OP">${CMP_OPS[split.op]}</field><value name="A">${parseExpr(left)}</value><value name="B">${parseExpr(right)}</value></block>`;
            }
            return `<block type="math_arithmetic"><field name="OP">${ARITH_OPS[split.op]}</field><value name="A">${parseExpr(left)}</value><value name="B">${parseExpr(right)}</value></block>`;
        }
    }
    return `<block type="raw_python_expr"><field name="CODE">${escapeXml(s)}</field></block>`;
}

function chainBlocks(blockXmls) {
    let result = '';
    for (let i = blockXmls.length - 1; i >= 0; i--) {
        const b = blockXmls[i];
        if (!b) continue;
        result = result === '' ? b : b.slice(0, -8) + `<next>${result}</next></block>`;
    }
    return result;
}

function fieldsXml(fields) {
    return Object.entries(fields || {}).map(([k, v]) => `<field name="${k}">${escapeXml(String(v))}</field>`).join('');
}
function leaf(type, fields, idx) {
    return { xml: `<block type="${type}">${fieldsXml(fields)}</block>`, nextIdx: idx + 1 };
}
function leafWithValue(type, fields, values, idx) {
    const valuesXml = Object.entries(values).map(([k, expr]) => `<value name="${k}">${parseExpr(expr)}</value>`).join('');
    return { xml: `<block type="${type}">${fieldsXml(fields)}${valuesXml}</block>`, nextIdx: idx + 1 };
}
function rawLineXml(text) {
    return `<block type="raw_python_line"><field name="CODE">${escapeXml(text)}</field></block>`;
}

function parseBlockSequence(lines, idx, indent) {
    const blockXmls = [];
    while (idx < lines.length && lines[idx].indent === indent) {
        const result = parseOneStatement(lines, idx, indent);
        // Розпізнавачі розширень (напр. tkinter) можуть повернути ОДРАЗУ
        // кілька блоків з одного рядка коду (напр. "X = tk.Y(...).pack()"
        // → блок створення + окремий блок tk_pack) через result.xmls.
        if (result.xmls) blockXmls.push(...result.xmls);
        else blockXmls.push(result.xml);
        idx = result.nextIdx;
    }
    return { xml: chainBlocks(blockXmls), nextIdx: idx };
}

function parseRawCompound(lines, idx, indent) {
    const collected = [lines[idx].text];
    let j = idx + 1;
    while (j < lines.length && lines[j].indent > indent) {
        collected.push('    '.repeat(lines[j].indent - indent) + lines[j].text);
        j++;
    }
    return { xml: `<block type="raw_python_block"><field name="CODE">${escapeXml(collected.join('\u21B5'))}</field></block>`, nextIdx: j };
}

function parseIfChain(lines, idx, indent) {
    const branches = [];
    let m = lines[idx].text.match(/^if\s+(.+):$/);
    idx++;
    let body = parseBlockSequence(lines, idx, indent + 1);
    branches.push({ condXml: parseExpr(m[1]), bodyXml: body.xml });
    idx = body.nextIdx;
    while (idx < lines.length && lines[idx].indent === indent && /^elif\s+(.+):$/.test(lines[idx].text)) {
        const mm = lines[idx].text.match(/^elif\s+(.+):$/);
        idx++;
        body = parseBlockSequence(lines, idx, indent + 1);
        branches.push({ condXml: parseExpr(mm[1]), bodyXml: body.xml });
        idx = body.nextIdx;
    }
    let elseBodyXml = null;
    if (idx < lines.length && lines[idx].indent === indent && lines[idx].text === 'else:') {
        idx++;
        body = parseBlockSequence(lines, idx, indent + 1);
        elseBodyXml = body.xml;
        idx = body.nextIdx;
    }
    const elseifCount = branches.length - 1;
    const elseCount = elseBodyXml !== null ? 1 : 0;
    let xml = `<block type="controls_if"><mutation elseif="${elseifCount}" else="${elseCount}"></mutation>`;
    branches.forEach((b, i) => {
        xml += `<value name="IF${i}">${b.condXml}</value>`;
        if (b.bodyXml) xml += `<statement name="DO${i}">${b.bodyXml}</statement>`;
    });
    if (elseBodyXml) xml += `<statement name="ELSE">${elseBodyXml}</statement>`;
    xml += `</block>`;
    return { xml, nextIdx: idx };
}

function parseWhile(lines, idx, indent) {
    let condStr = lines[idx].text.match(/^while\s+(.+):$/)[1];
    let mode = 'WHILE';
    const untilMatch = condStr.match(/^not\s*\((.+)\)$/);
    if (untilMatch) { mode = 'UNTIL'; condStr = untilMatch[1]; }
    idx++;
    const body = parseBlockSequence(lines, idx, indent + 1);
    const stmt = body.xml ? `<statement name="DO">${body.xml}</statement>` : '';
    const xml = `<block type="controls_whileUntil"><field name="MODE">${mode}</field><value name="BOOL">${parseExpr(condStr)}</value>${stmt}</block>`;
    return { xml, nextIdx: body.nextIdx };
}

function parseForRepeat(lines, idx, indent) {
    const timesExpr = lines[idx].text.match(/^for _ in range\((.+)\):$/)[1];
    idx++;
    const body = parseBlockSequence(lines, idx, indent + 1);
    const stmt = body.xml ? `<statement name="DO">${body.xml}</statement>` : '';
    const xml = `<block type="controls_repeat_ext"><value name="TIMES">${parseExpr(timesExpr)}</value>${stmt}</block>`;
    return { xml, nextIdx: body.nextIdx };
}

// parseForRange: розпізнає всі варіанти for VAR in range(...):
// • range(N)            → controls_repeat_ext  (VAR == '_')
// • range(FROM, TO+1)   → controls_for_simple  (крок = 1, включно з TO)
// • range(FROM, TO+1,S) → controls_for         (з явним кроком BY)
// • інше                → raw_python_block
function parseForRange(lines, idx, indent) {
    const text = lines[idx].text;
    const m = text.match(/^for ([A-Za-z_]\w*) in range\((.+)\):$/);
    if (!m) return parseRawCompound(lines, idx, indent);
    const varName = m[1];
    const rangeInner = m[2];
    const parts = splitTopLevelComma(rangeInner);
    idx++;
    const body = parseBlockSequence(lines, idx, indent + 1);
    const stmt = body.xml ? `<statement name="DO">${body.xml}</statement>` : '';
    const varXml = `<field name="VAR">${escapeXml(varName)}</field>`;

    if (parts.length === 1) {
        // range(N) — простий повтор N разів → controls_repeat_ext
        // (незалежно від імені змінної; range(N) = від 0 до N-1, ім'я не зберігається)
        const xml = `<block type="controls_repeat_ext"><value name="TIMES">${parseExpr(parts[0])}</value>${stmt}</block>`;
        return { xml, nextIdx: body.nextIdx };
    }
    if (parts.length === 2) {
        // range(FROM, TO+1) → controls_for_simple
        // Знімаємо "+1" якщо є, бо controls_for_simple генератор додає сам
        const toRaw = parts[1].trim();
        const toClean = toRaw.replace(/\s*\+\s*1$/, '').trim();
        const xml = `<block type="controls_for_simple">${varXml}<value name="FROM">${parseExpr(parts[0])}</value><value name="TO">${parseExpr(toClean)}</value>${stmt}</block>`;
        return { xml, nextIdx: body.nextIdx };
    }
    if (parts.length === 3) {
        // range(FROM, TO+1, STEP) → controls_for
        const toRaw = parts[1].trim();
        const toClean = toRaw.replace(/\s*\+\s*1$/, '').trim();
        const xml = `<block type="controls_for">${varXml}<value name="FROM">${parseExpr(parts[0])}</value><value name="TO">${parseExpr(toClean)}</value><value name="BY">${parseExpr(parts[2])}</value>${stmt}</block>`;
        return { xml, nextIdx: body.nextIdx };
    }
    return parseRawCompound(lines, idx - 1, indent);
}

function parseDef(lines, idx, indent) {
    const m = lines[idx].text.match(/^def\s+(\w+)\s*\((.*)\):$/);
    idx++;
    const body = parseBlockSequence(lines, idx, indent + 1);
    const stmt = body.xml ? `<statement name="BODY">${body.xml}</statement>` : '';
    const xml = `<block type="define_function"><field name="FUNC_NAME">${escapeXml(m[1])}</field><field name="PARAMS">${escapeXml(m[2])}</field>${stmt}</block>`;
    return { xml, nextIdx: body.nextIdx };
}

function parseOneStatement(lines, idx, indent) {
    const text = lines[idx].text;
    let m;

    if (text === 'pass') return { xml: '', nextIdx: idx + 1 };
    if (text === 'import turtle') return leaf('import_turtle', {}, idx);
    if (text === 'import random') return leaf('import_random', {}, idx);
    if (text === 'import math') return leaf('import_math', {}, idx);
    if (text === 'break') return leaf('controls_flow_statements', { FLOW: 'BREAK' }, idx);
    if (text === 'continue') return leaf('controls_flow_statements', { FLOW: 'CONTINUE' }, idx);

    if (m = text.match(/^(\w+)\s*=\s*turtle\.Turtle\(\)$/)) return leaf('create_turtle', { NAME: m[1] }, idx);
    if (m = text.match(/^\w+\.speed\((.+)\)$/)) return leafWithValue('set_speed', { NAME: currentTurtleName }, { SPEED: m[1] }, idx);
    if (m = text.match(/^\w+\.forward\((.+)\)$/)) return leafWithValue('t_forward', {}, { DIST: m[1] }, idx);
    if (m = text.match(/^\w+\.backward\((.+)\)$/)) return leafWithValue('t_backward', {}, { DIST: m[1] }, idx);
    if (m = text.match(/^\w+\.left\((.+)\)$/)) return leafWithValue('t_left', {}, { ANGLE: m[1] }, idx);
    if (m = text.match(/^\w+\.right\((.+)\)$/)) return leafWithValue('t_right', {}, { ANGLE: m[1] }, idx);
    if (/^\w+\.penup\(\)$/.test(text)) return leaf('t_penup', {}, idx);
    if (/^\w+\.pendown\(\)$/.test(text)) return leaf('t_pendown', {}, idx);
    if (m = text.match(/^\w+\.pensize\((.+)\)$/)) return leafWithValue('t_pensize', {}, { SIZE: m[1] }, idx);
    if (m = text.match(/^\w+\.pencolor\((.+)\)$/)) return leafWithValue('t_color', {}, { COLOR: m[1] }, idx);
    if (m = text.match(/^\w+\.fillcolor\((.+)\)$/)) return leafWithValue('t_fillcolor_manual', {}, { COLOR: m[1] }, idx);
    if (/^\w+\.begin_fill\(\)$/.test(text)) return leaf('t_begin_fill', {}, idx);
    if (/^\w+\.end_fill\(\)$/.test(text)) return leaf('t_end_fill', {}, idx);
    if (m = text.match(/^\w+\.circle\((.+)\)$/)) return leafWithValue('t_circle', {}, { R: m[1] }, idx);

    if (/^turtle\.register_shape\(/.test(text)) {
        const next = lines[idx + 1];
        if (next && next.indent === indent && /^\w+\.shape\("(\w+)"\)$/.test(next.text)) {
            return { xml: '', nextIdx: idx + 1 }; // register_shape буде відтворено автоматично разом із .shape()
        }
        return { xml: rawLineXml(text), nextIdx: idx + 1 };
    }
    if (m = text.match(/^\w+\.shape\("(\w+)"\)$/)) {
        if (ALLOWED_SHAPES.includes(m[1])) return leaf('turtle_shape', { SHAPE: m[1] }, idx);
        return { xml: rawLineXml(text), nextIdx: idx + 1 };
    }

    if (m = text.match(/^print\((.*)\)$/)) return leafWithValue('print', {}, { VALUE: m[1] }, idx);

    // ХУК ДЛЯ РОЗШИРЕНЬ (вимога: "нехай кнопки/віджети не завжди
    // потрапляють у загальний 'set X to ...'"): tkinter.js/pico.js та інші
    // динамічні модулі можуть зареєструвати ВЛАСНІ розпізнавачі рядків
    // через window.UPY_LINE_RECOGNIZERS — щоб типовий/вставлений код на
    // кшталт "root = tk.Tk()" чи "btn = tk.Button(...)" ставав ПРАВИЛЬНИМ
    // спеціальним блоком (tk_create_root/tk_create_button), а не падав у
    // загальний "set X to [сирий вираз]" нижче. Перевіряємо ПЕРЕД
    // загальним fallback'ом — щоб розпізнані патерни мали пріоритет.
    for (const recognizer of (window.UPY_LINE_RECOGNIZERS || [])) {
        try {
            const r = recognizer(text, idx, indent, lines);
            if (r) return r;
        } catch (e) { console.warn('Розпізнавач рядка кинув помилку, пропускаємо:', e); }
    }

    if (m = text.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/)) {
        // math_change: x = x + delta — має бути ДО загального variables_set
        const varName = m[1];
        const rhs = m[2].trim();
        const mcPlus  = rhs.match(new RegExp(`^${varName}\\s*\\+\\s*(.+)$`));
        const mcMinus = rhs.match(new RegExp(`^${varName}\\s*-\\s*(.+)$`));
        if (mcPlus) {
            return { xml: `<block type="math_change"><field name="VAR">${escapeXml(varName)}</field><value name="DELTA">${parseExpr(mcPlus[1])}</value></block>`, nextIdx: idx + 1 };
        }
        if (mcMinus) {
            // x = x - delta → math_change з від'ємним DELTA (-(delta))
            return { xml: `<block type="math_change"><field name="VAR">${escapeXml(varName)}</field><value name="DELTA"><block type="math_arithmetic"><field name="OP">MINUS</field><value name="A"><block type="math_number"><field name="NUM">0</field></block></value><value name="B">${parseExpr(mcMinus[1])}</value></block></value></block>`, nextIdx: idx + 1 };
        }
        return { xml: `<block type="variables_set"><field name="VAR">${escapeXml(m[1])}</field><value name="VALUE">${parseExpr(m[2])}</value></block>`, nextIdx: idx + 1 };
    }
    if (m = text.match(/^([A-Za-z_]\w*)\((.*)\)$/)) return leaf('call_function', { FUNC: m[1], ARGS: m[2] }, idx);

    if (/^for _ in range\(.+\):$/.test(text)) return parseForRepeat(lines, idx, indent);
    if (/^for [A-Za-z_]\w* in range\(.+\):$/.test(text)) return parseForRange(lines, idx, indent);
    if (/^while\s+.+:$/.test(text)) return parseWhile(lines, idx, indent);
    if (/^if\s+.+:$/.test(text)) return parseIfChain(lines, idx, indent);
    if (/^def\s+\w+\s*\(.*\):$/.test(text)) return parseDef(lines, idx, indent);

    if (text.endsWith(':')) return parseRawCompound(lines, idx, indent);
    return { xml: rawLineXml(text), nextIdx: idx + 1 };
}

function pythonToBlocklyXml(code) {
    const lines = tokenizeLines(code);
    const { xml } = parseBlockSequence(lines, 0, 0);
    return `<xml xmlns="https://developers.google.com/blockly/xml">${xml}</xml>`;
}

async function applyCodeToBlocks(code) {
    if (code === lastSyncedCode) return;
    try {
        const generatedXml = pythonToBlocklyXml(code);
        if (window.ensureModulesForXmlText) await window.ensureModulesForXmlText(generatedXml);
        const dom = xmlTextToDom(generatedXml);
        // FIX: суворо вимикаємо автоматичний refreshCode() на час
        // clear()+domToWorkspace() — інакше проміжний виклик на порожній
        // робочій області псує позицію курсора (див. коментар біля
        // addChangeListener вище). try/finally гарантує, що прапорець
        // завжди повернеться в false, навіть якщо завантаження впаде.
        suppressAutoRefresh = true;
        try {
            workspace.clear();
            Blockly.Xml.domToWorkspace(dom, workspace);
        } finally {
            suppressAutoRefresh = false;
        }
        // Blockly групує/призупиняє події під час масового завантаження
        // з XML, тому надійніше викликати refreshCode() явно один раз тут.
        refreshCode();
        setStatus(t('status_blocks_updated'), 'ready');
    } catch (e) {
        console.warn('Code→Blocks sync failed:', e);
        setStatus(t('status_sync_error'), 'error');
    }
}

// ================= RUN CODE (Skulpt) =================
async function runCode() {
    clearTurtle();
    const code = document.getElementById('code').value;

    // Дозволяємо розширенням (напр. Tkinter) перехопити виконання власним
    // обробником замість Skulpt — наприклад, щоб показати попередній
    // перегляд вікна, яке Skulpt все одно не вміє виконати насправді.
    for (const handler of (window.UPY_RUN_HANDLERS || [])) {
        if (handler.test(code)) {
            setStatus(t('status_running'), 'running');
            try {
                await handler.run(code, workspace);
                setStatus(t('status_execution_done'), 'done');
            } catch (e) {
                outf('\n[Помилка] ' + e);
                setStatus(t('status_execution_error'), 'error');
                console.error(e);
            }
            return;
        }
    }

    // FIX: якщо Skulpt (CDN) не завантажився (заблокована мережа/adblock),
    // раніше тут кидався неперехоплений ReferenceError і кнопка "Run"
    // просто мовчки "не працювала" без жодного пояснення. Тепер даємо
    // зрозуміле повідомлення.
    if (typeof Sk === 'undefined') {
        setStatus(t('status_execution_error'), 'error');
        outf('[Помилка] Бібліотеку Skulpt не вдалось завантажити (перевірте інтернет-з’єднання або дозвольте домен cdn.jsdelivr.net) — виконання Python неможливе.');
        return;
    }

    setStatus(t('status_running'), 'running');
    try {
        // IMPROVEMENT: ліміт часу виконання, щоб нескінченний цикл не вішав вкладку.
        Sk.configure({ output: outf, read: builtinRead, execLimit: 15000, yieldLimit: 100 });

        const area = document.getElementById('turtle-area');
        const w = Math.max(300, Math.floor(area.clientWidth) || 600);
        const h = Math.max(300, Math.floor(area.clientHeight) || 420);
        Sk.TurtleGraphics = { target: 'turtle-area', width: w, height: h };

        await Sk.misceval.asyncToPromise(() => Sk.importMainWithBody("<stdin>", false, code, true));
        setStatus(t('status_execution_done'), 'done');
    } catch (e) {
        const msg = e && e.toString ? e.toString() : String(e);
        const isTimeout = /time limit|RecursionError|timed out/i.test(msg);
        outf('\n[Execution Error] ' + msg + (isTimeout ? '\n(Схоже на нескінченний цикл — перевірте умову виходу.)' : ''));
        setStatus(t('status_execution_error'), 'error');
        console.error(e);
    }
}

// ================= EXAMPLE =================
// Приклад тепер живе в js/lessons.js (група "Приклади" у вікні "📖 Уроки")
// — раніше тут була вбудована константа EXAMPLE_XML і кнопка "💡 Приклад"
// у спадному меню; обидві прибрано на користь узагальненої системи уроків.

// ================= УРОКИ: завантаження довільного .xml уроку =================
// Викликається з js/lessons.js при виборі плитки уроку в модальному вікні
// "📖 Уроки". Узагальнена версія колишньої loadExample() — приймає БУДЬ-ЯКИЙ
// XML-текст замість єдиної вбудованої константи, оскільки тепер уроків
// (потенційно) багато, а не один "Приклад" у спадному меню.
window.loadLessonXml = async function loadLessonXml(xmlText, lessonName) {
    if (!xmlText) return;
    if (workspaceHasBlocks() && !confirm(t('confirm_load_example'))) return;
    if (window.ensureModulesForXmlText) await window.ensureModulesForXmlText(xmlText);
    suppressAutoRefresh = true;
    try {
        workspace.clear();
        Blockly.Xml.domToWorkspace(xmlTextToDom(xmlText), workspace);
    } finally {
        suppressAutoRefresh = false;
    }
    refreshCode();
    setStatus(t('status_example_loaded'), 'ready');
};

// ================= SAVE / LOAD у файл .xml, DOWNLOAD .py =================
// IMPROVEMENT #2: реальне збереження/завантаження проєкту як XML-файлу
// (а не лише в localStorage), щоб проєкт можна було передати іншому
// пристрою чи людині.
function downloadTextFile(text, filename, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
}
function saveProjectXml() {
    try {
        const dom = Blockly.Xml.workspaceToDom(workspace);
        const xml = Blockly.Xml.domToPrettyText(dom);
        downloadTextFile(xml, 'project.xml', 'application/xml');
        setStatus(t('status_project_saved'), 'done');
    } catch (e) {
        console.error(e);
        setStatus(t('status_save_failed'), 'error');
    }
}
function handleProjectFileUpload(evt) {
    const file = evt.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
        try {
            if (workspaceHasBlocks() && !confirm(t('confirm_load_xml'))) return;
            // Вимога #7: модулі, чиї блоки є у файлі, вмикаються автоматично.
            if (window.ensureModulesForXmlText) await window.ensureModulesForXmlText(reader.result);
            suppressAutoRefresh = true;
            try {
                workspace.clear();
                Blockly.Xml.domToWorkspace(xmlTextToDom(reader.result), workspace);
            } finally {
                suppressAutoRefresh = false;
            }
            refreshCode();
            setStatus(t('status_project_loaded'), 'ready');
        } catch (e) {
            console.error(e);
            setStatus(t('status_invalid_xml'), 'error');
        }
    };
    reader.readAsText(file);
    evt.target.value = '';
}
function downloadPy() {
    downloadTextFile(document.getElementById('code').value || '', 'program.py', 'text/x-python');
}

// ================= NEW PROJECT =================
// Повністю очищає робочу область, вивід, Turtle-полотно, автозбереження
// та внутрішній стан (ім'я поточної черепашки), і "перезапускає" редактор
// так, ніби сторінку щойно відкрили.
function newProject() {
    if (workspaceHasBlocks() && !confirm(t('confirm_new_project'))) {
        return;
    }
    workspace.clear();
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch (_) {}
    clearTurtle();
    currentTurtleName = 't';
    lastSyncedCode = null;
    refreshCode();
    setStatus(t('status_new_project'), 'ready');
}

// ================= ПАНЕЛІ: показати/приховати будь-яку з трьох =================
// Замінює стару систему з єдиним CSS-класом "blocks-hidden" на загальну:
// кожна з трьох панелей (Блоки/Код/Виконання) ховається/показується
// незалежно, а сітка (.wrap) перераховується так, щоб панель "Код"
// розтягувалась замість прихованих "Блоків" (як і раніше), або "Виконання"
// займало решту простору, якщо приховані обидві інші.
const PANEL_IDS = ['blocks', 'code', 'output'];
const PANEL_BASE_WIDTH = { blocks: '1fr', code: '420px', output: '520px' };
const panelVisible = { blocks: true, code: true, output: true };

