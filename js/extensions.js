// =====================================================================
// extensions.js — система "модулів" (Turtle / Tkinter / Raspberry Pi
// Pico / ...) + кнопка "➕" для їх увімкнення.
// =====================================================================
// ІДЕЯ: середовище стартує з "голим" Python (Start/Output/Variables/
// Arrays/Loops/Logic/Math/Functions — завжди доступні, жодних модулів).
// Категорії Movement/Pen/Shapes (Turtle) і, за наявності, Tkinter/Pico —
// з'являються лише коли відповідний МОДУЛЬ увімкнено: вручну через "➕",
// або АВТОМАТИЧНО, якщо у завантаженому .xml/коді знайдено блоки цього
// модуля (щоб відкритий раніше збережений проєкт одразу показував
// потрібні категорії, без ручного вмикання).
//
// Модуль — об'єкт-дескриптор у window.UPY_MODULES[id]:
//   {
//     core: true|false,        // true = блоки вже визначені в app.js
//                               // (Turtle); false = потрібно довантажити
//                               // js/extensions/<id>.js (Tkinter/Pico)
//     colour: '#3b82f6',       // колір, який отримують "import"-блоки
//                               // цього модуля в категорії Start
//     categoryIds: [...],      // id вже існуючих у toolbox категорій
//                               // (data-cat-id), які показувати/ховати
//                               // разом з модулем (напр. Turtle:
//                               // movement/pen/shapes)
//     categoryXml: '<category>...' // НОВА категорія, якої немає в
//                               // статичному toolbox — додається/
//                               // прибирається цілком (Tkinter/Pico)
//     startBlocksXml: '<block .../><block .../>', // блоки, що зʼявляються
//                               // у категорії "Start" разом з модулем
//                               // (import_X, і "конструктори" на кшталт
//                               // create_turtle)
//     panel: { mount(container) } // опційно: адаптує вікно виконання
//                               // (3-я панель) під модуль, напр. Pico —
//                               // показує плату замість полотна
//   }
//
// ЯК ДОДАТИ ВЛАСНЕ РОЗШИРЕННЯ (новий модуль):
//   1. Створіть файл js/extensions/мій_модуль.js за зразком
//      js/extensions/pico.js (найпростіший) або tkinter.js (складніший).
//   2. У ньому викличте registerExtension(id, initFn) — initFn отримує
//      { PY, valueToCode, statementToCode, toIdentifier, indentBlock, t }
//      і повертає ОБ'ЄКТ-ДЕСКРИПТОР, як описано вище.
//   3. Додайте один запис у MODULE_CATALOG нижче: id, name/nameEn,
//      description/descriptionEn, script (шлях до файлу), detect
//      (функція, що за типом блоку визначає "цей блок — з мого модуля").

const MODULE_CATALOG = [
    {
        id: 'turtle',
        name: 'Черепашка (Turtle)',
        nameEn: 'Turtle graphics',
        description: 'Рух, перо і фігури черепашки (модуль turtle)',
        descriptionEn: 'Turtle movement, pen and shape blocks (turtle module)',
        icon: 'assets/icons/turtle.svg',
        detect: type => type === 'import_turtle' || type === 'create_turtle' || type === 'set_speed' || type === 'turtle_shape' || (typeof type === 'string' && type.indexOf('t_') === 0)
    },
    {
        id: 'tkinter',
        name: 'Tkinter (вікна)',
        nameEn: 'Tkinter (windows)',
        description: 'Блоки для створення програм з вікнами (Tkinter)',
        descriptionEn: 'Blocks for building windowed programs (Tkinter)',
        icon: 'assets/icons/tkinter.svg',
        script: 'js/extensions/tkinter.js',
        detect: type => typeof type === 'string' && (type.indexOf('tk_') === 0 || type === 'import_tkinter' || type === 'import_tkinter_messagebox')
    },
    {
        id: 'pico',
        name: 'Raspberry Pi Pico',
        nameEn: 'Raspberry Pi Pico',
        description: 'GPIO-блоки для Raspberry Pi Pico + завантаження коду на пристрій через USB',
        descriptionEn: 'GPIO blocks for Raspberry Pi Pico + upload code to the device over USB',
        icon: 'assets/icons/mcu.svg',
        script: 'js/extensions/pico.js',
        detect: type => typeof type === 'string' && (type.indexOf('pico_') === 0 || type === 'import_machine' || type === 'import_time')
    }
    // ← сюди додавайте нові модулі
];

window.UPY_MODULES = window.UPY_MODULES || {};             // id -> дескриптор (див. вище)
window.UPY_EXTENSIONS_LOADED = window.UPY_EXTENSIONS_LOADED || {}; // id -> true, коли скрипт вже підвантажено
window.UPY_EXTENSIONS_ENABLED = window.UPY_EXTENSIONS_ENABLED || {}; // id -> true, коли модуль увімкнено (категорії видно)
window.UPY_RUN_HANDLERS = window.UPY_RUN_HANDLERS || []; // спец. обробники виконання (напр. прев'ю вікна Tkinter замість Skulpt)
window.UPY_PANEL_PROVIDERS = window.UPY_PANEL_PROVIDERS || {}; // id -> { mount(container) } — адаптація 3-ї панелі
window.UPY_LINE_RECOGNIZERS = window.UPY_LINE_RECOGNIZERS || []; // (text, idx, indent, lines) => {xml|xmls, nextIdx}|null
// ↑ дозволяє розширенням (tkinter.js, pico.js, ...) розпізнавати "свої"
// рядки Python (напр. "root = tk.Tk()") у панелі коду й перетворювати їх
// на СПЕЦІАЛЬНІ блоки — замість того, щоб усе падало в загальний
// "set X to [сирий вираз]" (генерична категорія "Змінні"), що раніше
// призводило до конфліктів і навіть до розбитого коду при поверненні
// назад (див. CHANGELOG.md).
window.UPY_MODAL_EXTRA_SECTIONS = window.UPY_MODAL_EXTRA_SECTIONS || [];
// ↑ дозволяє розширенням додати ВЛАСНИЙ розділ у ВЕЛИКЕ модальне вікно
// "Модулі" (напр. pico.js додає сюди розділ "Бібліотеки для
// мікроконтролера" — видимий лише коли сам модуль Pico увімкнено).
// Кожен запис: { test: () => bool, render: (containerEl) => void }.
// test() перевіряється щоразу, коли модальне вікно (пере)малювується.

const HIDDEN_CATEGORIES = {};   // id -> detached <category> DOM-елемент (поки модуль вимкнено)
const CATEGORY_NEXT_ID = {};    // id -> id категорії, ПЕРЕД якою вона мала стояти (щоб зберегти порядок)

function recordCategoryOrder() {
    const toolboxEl = document.getElementById('toolbox');
    if (!toolboxEl) return;
    Array.from(toolboxEl.children).forEach(cat => {
        const id = cat.getAttribute('data-cat-id');
        if (!id) return;
        const next = cat.nextElementSibling;
        CATEGORY_NEXT_ID[id] = next ? next.getAttribute('data-cat-id') : null;
    });
}

function removeCategoryFromToolbox(catId) {
    const toolboxEl = document.getElementById('toolbox');
    const el = toolboxEl && toolboxEl.querySelector(`category[data-cat-id="${catId}"]`);
    if (el) { HIDDEN_CATEGORIES[catId] = el; el.remove(); }
}

function restoreCategoryToToolbox(catId, freshEl) {
    const toolboxEl = document.getElementById('toolbox');
    if (!toolboxEl) return;
    // якщо категорія вже в toolbox (напр. повторне увімкнення без перезавантаження) — нічого не робимо
    if (toolboxEl.querySelector(`category[data-cat-id="${catId}"]`)) return;
    const el = freshEl || HIDDEN_CATEGORIES[catId];
    if (!el) return;
    const nextId = CATEGORY_NEXT_ID[catId];
    const nextEl = nextId ? toolboxEl.querySelector(`category[data-cat-id="${nextId}"]`) : null;
    if (nextEl) toolboxEl.insertBefore(el, nextEl); else toolboxEl.appendChild(el);
    delete HIDDEN_CATEGORIES[catId];
}

function addStartBlocks(moduleId, xmlString) {
    const toolboxEl = document.getElementById('toolbox');
    const startCat = toolboxEl && toolboxEl.querySelector('category[data-cat-id="start"]');
    if (!startCat || !xmlString) return;
    removeStartBlocks(moduleId); // без дублювання при повторному увімкненні
    const tmp = document.createElement('div');
    tmp.innerHTML = xmlString;
    Array.from(tmp.children).forEach(node => {
        node.setAttribute('data-module', moduleId);
        startCat.appendChild(node);
    });
}
function removeStartBlocks(moduleId) {
    const toolboxEl = document.getElementById('toolbox');
    if (!toolboxEl) return;
    toolboxEl.querySelectorAll(`category[data-cat-id="start"] > [data-module="${moduleId}"]`).forEach(n => n.remove());
}

function updateToolboxNow() {
    const toolboxEl = document.getElementById('toolbox');
    // ПРИМІТКА: `workspace` — це bare-посилання на `let workspace` з app.js.
    // Класичні (не-module) <script>-теги в одному документі ділять один
    // глобальний лексичний простір для let/const, тому це працює, доки
    // виклик відбувається вже ПІСЛЯ виконання app.js (а не в момент
    // завантаження самого extensions.js).
    if (typeof workspace !== 'undefined' && workspace && typeof workspace.updateToolbox === 'function') {
        workspace.updateToolbox(toolboxEl);
    }
}

// Адаптує 3-ю панель (вікно виконання) під активний модуль, що має власний
// panel-provider (напр. Pico показує плату замість порожнього полотна).
// Якщо жоден такий модуль не увімкнено — повертає стандартний вигляд
// (порожня зона для Turtle/Tkinter-прев'ю, які самі малюють себе під час
// "▶ Run").
window.updateActivePanel = function updateActivePanel() {
    const area = document.getElementById('turtle-area');
    if (!area) return;
    const activeId = Object.keys(window.UPY_PANEL_PROVIDERS)[0];
    if (activeId) {
        window.__activePanelId = activeId;
        window.UPY_PANEL_PROVIDERS[activeId].mount(area);
    } else if (window.__activePanelId) {
        window.__activePanelId = null;
        area.innerHTML = '';
    }
};

function loadExtensionScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Не вдалось завантажити ' + src));
        document.head.appendChild(s);
    });
}

// Розширення (js/extensions/tkinter.js, pico.js, ...) викликає це один раз
// при завантаженні свого файлу. initFn(ctx) повертає ОБ'ЄКТ-дескриптор
// модуля (див. коментар зверху файлу).
window.registerExtension = function (id, initFn) {
    window.UPY_EXTENSIONS_LOADED[id] = true;
    const descriptor = initFn({
        PY: window.PY, valueToCode, statementToCode, toIdentifier, indentBlock,
        leaf, leafWithValue, parseExpr, escapeXml,
        registerLineRecognizer: fn => window.UPY_LINE_RECOGNIZERS.push(fn),
        t: (typeof t === 'function' ? t : (k => k))
    });
    window.registerModule(id, descriptor);
};

// Реєстрація дескриптора модуля (використовується і "вбудованими" (core)
// модулями напряму з app.js — напр. Turtle, — і динамічними розширеннями
// через registerExtension вище).
window.registerModule = function (id, descriptor) {
    window.UPY_MODULES[id] = Object.assign({ core: false }, descriptor);
    // якщо модуль вже мав бути увімкнений (збережено раніше, або щойно
    // довантажили скрипт у процесі enableModule) — застосовуємо стан UI
    if (window.UPY_EXTENSIONS_ENABLED[id]) {
        applyModuleUI(id, true);
    }
};

function applyModuleUI(id, enabled) {
    const mod = window.UPY_MODULES[id];
    if (!mod) return;
    if (enabled) {
        (mod.categoryIds || []).forEach(catId => restoreCategoryToToolbox(catId));
        if (mod.categoryXml) {
            let el = document.querySelector(`#toolbox category[data-cat-id="${id}"]`);
            if (!el) {
                // БАГФІКС: якщо цю категорію вже вимикали раніше (і вона
                // лежить відкріпленою в HIDDEN_CATEGORIES), ПОВЕРТАЄМО саме
                // її, а не створюємо нову з нуля — інакше стара DOM-нода
                // "губилась" (ніколи не поверталась і не видалялась),
                // а кожне повторне увімкнення плодило нову копію категорії.
                if (HIDDEN_CATEGORIES[id]) {
                    restoreCategoryToToolbox(id);
                } else {
                    const tmp = document.createElement('div');
                    tmp.innerHTML = mod.categoryXml;
                    const catEl = tmp.firstElementChild;
                    if (catEl) {
                        catEl.setAttribute('data-cat-id', id);
                        catEl.setAttribute('data-extension', id);
                        document.getElementById('toolbox').appendChild(catEl);
                    }
                }
            }
        }
        if (mod.startBlocksXml) addStartBlocks(id, mod.startBlocksXml);
        if (mod.panel) window.UPY_PANEL_PROVIDERS[id] = mod.panel;
    } else {
        (mod.categoryIds || []).forEach(catId => removeCategoryFromToolbox(catId));
        if (mod.categoryXml) removeCategoryFromToolbox(id);
        removeStartBlocks(id);
        delete window.UPY_PANEL_PROVIDERS[id];
    }
    window.UPY_EXTENSIONS_ENABLED[id] = enabled;
}

const EXT_STORAGE_KEY = 'uPy.enabledExtensions';
function getEnabledExtensionIds() {
    try { return JSON.parse(localStorage.getItem(EXT_STORAGE_KEY) || '[]'); } catch (e) { return []; }
}
function saveEnabledExtensionIds(ids) {
    try { localStorage.setItem(EXT_STORAGE_KEY, JSON.stringify(ids)); } catch (e) { /* ignore */ }
}

// Головна функція для увімкнення/вимкнення модуля. Довантажує скрипт
// розширення за потреби (тільки перший раз), оновлює toolbox, зберігає
// вибір користувача та адаптує 3-ю панель.
window.enableModule = async function enableModule(id, opts) {
    opts = opts || {};
    const cat = MODULE_CATALOG.find(m => m.id === id);
    window.UPY_EXTENSIONS_ENABLED[id] = true; // до довантаження — щоб registerModule одразу застосував UI
    if (cat && cat.script && !window.UPY_EXTENSIONS_LOADED[id]) {
        await loadExtensionScript(cat.script); // сам файл викличе registerExtension → registerModule → applyModuleUI
    } else if (window.UPY_MODULES[id]) {
        applyModuleUI(id, true);
    }
    updateToolboxNow();
    window.updateActivePanel();
    if (opts.persist !== false) {
        const ids = getEnabledExtensionIds();
        if (!ids.includes(id)) { ids.push(id); saveEnabledExtensionIds(ids); }
    }
};
window.disableModule = function disableModule(id, opts) {
    opts = opts || {};
    applyModuleUI(id, false);
    updateToolboxNow();
    window.updateActivePanel();
    if (opts.persist !== false) {
        saveEnabledExtensionIds(getEnabledExtensionIds().filter(x => x !== id));
    }
};

// ===== Вимога #7: автоматичне підключення модулів при завантаженні =====
// Скануємо XML-текст (проєкт .xml, приклад, автозбереження) або текст
// коду Python на предмет типів блоків/патернів, що належать модулю
// (MODULE_CATALOG[].detect), і автоматично вмикаємо знайдені модулі —
// ще ДО того, як блоки завантажаться в робочу область (інакше Blockly не
// знайде визначення типу блоку, якщо модуль ще не підключено).
function extractBlockTypesFromXml(xmlText) {
    const types = new Set();
    const re = /<block[^>]*\stype="([^"]+)"/g;
    let m;
    while ((m = re.exec(xmlText))) types.add(m[1]);
    return types;
}
window.ensureModulesForXmlText = async function ensureModulesForXmlText(xmlText) {
    const types = Array.from(extractBlockTypesFromXml(xmlText || ''));
    for (const cat of MODULE_CATALOG) {
        if (window.UPY_EXTENSIONS_ENABLED[cat.id]) continue;
        if (types.some(ty => cat.detect(ty))) {
            await window.enableModule(cat.id);
        }
    }
};

// ================= UI: кнопка "➕" і спливаюча панель =================
function currentLang() { return (window.__currentLang === 'en') ? 'en' : 'uk'; }

function buildExtensionsPopover() {
    const overlay = document.createElement('div');
    overlay.id = 'extensionsPopover';
    overlay.className = 'big-modal-overlay';
    overlay.style.display = 'none';

    const box = document.createElement('div');
    box.className = 'big-modal-box';
    overlay.appendChild(box);

    const header = document.createElement('div');
    header.className = 'big-modal-header';
    const title = document.createElement('h3');
    title.textContent = currentLang() === 'en' ? 'Modules' : 'Модулі';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'big-modal-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => { overlay.style.display = 'none'; });
    header.appendChild(title);
    header.appendChild(closeBtn);
    box.appendChild(header);

    const body = document.createElement('div');
    body.className = 'big-modal-body';
    box.appendChild(body);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.style.display = 'none'; });

    function rebuildBody() {
        body.innerHTML = '';

        const grid = document.createElement('div');
        grid.className = 'tile-grid';
        body.appendChild(grid);

        MODULE_CATALOG.forEach(cat => {
            const tile = document.createElement('label');
            tile.className = 'tile-card';
            if (window.UPY_EXTENSIONS_ENABLED[cat.id]) tile.classList.add('tile-active');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'tile-checkbox';
            checkbox.checked = !!window.UPY_EXTENSIONS_ENABLED[cat.id];
            checkbox.addEventListener('change', async () => {
                checkbox.disabled = true;
                try {
                    if (checkbox.checked) await window.enableModule(cat.id);
                    else window.disableModule(cat.id);
                } catch (e) {
                    console.error(e);
                    checkbox.checked = false;
                } finally {
                    checkbox.disabled = false;
                    rebuildBody(); // оновлюємо — можуть з'явитись/зникнути додаткові секції (напр. бібліотеки Pico)
                }
            });
            tile.appendChild(checkbox);

            if (cat.icon) {
                const icon = document.createElement('img');
                icon.className = 'tile-icon';
                icon.src = cat.icon;
                icon.width = 48; icon.height = 48;
                icon.alt = '';
                tile.appendChild(icon);
            }

            const nameEl = document.createElement('div');
            nameEl.className = 'tile-name';
            nameEl.textContent = currentLang() === 'en' ? cat.nameEn : cat.name;
            const descEl = document.createElement('div');
            descEl.className = 'tile-desc';
            descEl.textContent = currentLang() === 'en' ? cat.descriptionEn : cat.description;
            tile.appendChild(nameEl);
            tile.appendChild(descEl);

            grid.appendChild(tile);
        });

        // Додаткові секції від розширень (напр. "Бібліотеки для
        // мікроконтролера" від pico.js) — показуються лише коли їхня
        // умова виконана (напр. модуль Pico увімкнено).
        window.UPY_MODAL_EXTRA_SECTIONS.forEach(section => {
            try {
                if (section.test && !section.test()) return;
                const sectionEl = document.createElement('div');
                sectionEl.className = 'big-modal-extra-section';
                body.appendChild(sectionEl);
                section.render(sectionEl, rebuildBody);
            } catch (e) { console.error('Помилка рендеру додаткової секції модального вікна:', e); }
        });
    }
    rebuildBody();
    overlay.__rebuildBody = rebuildBody;

    document.body.appendChild(overlay);
    return overlay;
}

function initExtensionsUI() {
    recordCategoryOrder();

    // ВАЖЛИВО (вимога "від початку голий Python без модулів"): категорії,
    // що належать core-модулю (напр. Turtle: Movement/Pen/Shapes), стоять
    // у статичному toolbox HTML одразу — тут ми їх ховаємо, якщо модуль
    // не був явно увімкнений раніше (localStorage) чи не буде за мить
    // автоматично виявлений у відновленому проєкті (restoreAutoSavedWorkspace
    // в app.js викликає ensureModulesForXmlText і сам покаже потрібне).
    const savedIdsEarly = getEnabledExtensionIds();
    MODULE_CATALOG.forEach(cat => {
        if (savedIdsEarly.includes(cat.id)) return;
        const mod = window.UPY_MODULES[cat.id];
        if (mod && (mod.categoryIds || []).length) {
            mod.categoryIds.forEach(catId => removeCategoryFromToolbox(catId));
        }
    });

    const btn = document.getElementById('extensionsBtn');
    if (!btn) return;
    let popover = buildExtensionsPopover();

    function rebuildPopover() {
        const wasOpen = popover.style.display !== 'none';
        popover.remove();
        popover = buildExtensionsPopover();
        popover.style.display = wasOpen ? 'flex' : 'none';
    }
    // app.js вже призначає власний window.onLanguageChanged (оновлює назви
    // категорій toolbox) — тут ОБГОРТАЄМО його (не перезаписуємо), щоб і
    // модальне вікно "Модулі" теж перемальовувалось іншою мовою.
    const previousOnLanguageChanged = window.onLanguageChanged;
    window.onLanguageChanged = function (code) {
        if (typeof previousOnLanguageChanged === 'function') previousOnLanguageChanged(code);
        rebuildPopover();
    };

    // Модальне вікно — на весь екран по центру (не прив'язане до кнопки),
    // тож просто перемальовуємо його вміст (щоб відображати актуальний
    // стан) і показуємо/ховаємо через flex.
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const opening = popover.style.display === 'none';
        if (opening && popover.__rebuildBody) popover.__rebuildBody();
        popover.style.display = opening ? 'flex' : 'none';
    });
    document.addEventListener('click', (e) => {
        if (popover.style.display !== 'none' && !popover.contains(e.target) && e.target !== btn) {
            popover.style.display = 'none';
        }
    });

    // Автоматично вмикаємо модулі, які користувач вмикав раніше (збережено
    // в localStorage) — щоб не доводилось вмикати щоразу.
    const savedIds = getEnabledExtensionIds();
    const enablePromises = savedIds
        .filter(id => MODULE_CATALOG.some(m => m.id === id))
        .map(id => window.enableModule(id, { persist: false }).catch(err => console.warn('Не вдалось автоввімкнути модуль', id, err)));
    // Прапорці у попапі будувались ДО того, як ці модулі встигли
    // увімкнутись (асинхронно) — перемальовуємо попап, коли всі готові,
    // щоб чекбокси показували правильний стан одразу при першому відкритті.
    if (enablePromises.length) Promise.all(enablePromises).then(rebuildPopover);
}

document.addEventListener('DOMContentLoaded', initExtensionsUI);
