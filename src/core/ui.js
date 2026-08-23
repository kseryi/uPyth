// =====================================================================
// ui.js — панелі інтерфейсу, меню, кнопки, "розумне" редагування коду
// =====================================================================
// Четвертий (останній) з файлів колишнього app.js. Показ/приховування
// трьох панелей, спадне меню (☰), імпорт .py, блокування редактора,
// повноекранний режим, підключення обробників кнопок, довідка "?" та
// Enter/Tab/Backspace-логіка текстового редактора коду. Викликає функції
// з generator.js/blocks-turtle.js/workspace.js на верхньому рівні (при
// підключенні обробників кнопок) — тому МАЄ завантажуватись останнім.
// =====================================================================

function updatePanelLayout() {
    const wrap = document.querySelector('.wrap');
    const visibleIds = PANEL_IDS.filter(id => panelVisible[id]);
    PANEL_IDS.forEach(id => {
        const panel = document.querySelector(`.panel[data-panel="${id}"]`);
        if (panel) panel.style.display = panelVisible[id] ? '' : 'none';
    });
    // Роздільники між панелями показуємо лише коли ОБИДВІ сусідні панелі
    // видимі — тягнути межу між панеллю й "порожнечею" сенсу немає.
    document.querySelectorAll('.panel-resizer').forEach(res => {
        const [a, b] = (res.dataset.resizer || '').split('-');
        res.hidden = !(panelVisible[a] && panelVisible[b]);
    });
    // БАГФІКС: на вузьких екранах CSS (@media max-width:1200px) переводить
    // .wrap в один стовпець (flex-direction:column, ширина 100%) — інлайн
    // width/flex з JS мають нижчий пріоритет за "!important" у медіа-запиті,
    // але про всяк випадок явно скидаємо їх, щоб нічого не залишалось від
    // десктопного розкладу.
    if (window.matchMedia && window.matchMedia('(max-width: 1200px)').matches) {
        PANEL_IDS.forEach(id => {
            const panel = document.querySelector(`.panel[data-panel="${id}"]`);
            if (panel) { panel.style.width = ''; panel.style.flex = ''; }
        });
        return;
    }
    if (!visibleIds.length) return;
    // Якщо "Блоки" приховані — "Код" стає гнучким (flex:1) замість них.
    // Якщо і "Блоки", і "Код" приховані — гнучким стає "Виконання".
    let flexibleId = 'blocks';
    if (!panelVisible.blocks) flexibleId = panelVisible.code ? 'code' : 'output';
    PANEL_IDS.forEach(id => {
        const panel = document.querySelector(`.panel[data-panel="${id}"]`);
        if (!panel || !panelVisible[id]) return;
        if (id === flexibleId) {
            panel.style.flex = '1 1 0';
            panel.style.width = '';
        } else {
            panel.style.flex = '0 0 auto';
            panel.style.width = panelWidth[id] + 'px';
        }
    });
}
window.addEventListener('resize', debounce(updatePanelLayout, 150));

// ================= РОЗДІЛЬНИКИ ПАНЕЛЕЙ: перетягування мишею =================
// Вимога: наводимо курсор на межу між панелями "Блоки"/"Код"/"Виконання" й
// перетягуємо — одна панель ширшає, сусідня звужується (і навпаки).
// "Гнучка" панель (зазвичай "Блоки" — flex:1, займає решту простору) не
// має власної px-ширини, тому для пари [гнучка+фіксована] рухаємо лише
// фіксовану (гнучка сама "доросте"/"стисне" робочу область). А коли ОБИДВІ
// сусідні панелі фіксовані (типово "Код"↔"Виконання", коли "Блоки" видимі
// й самі забирають решту простору) — передаємо ширину напряму одна одній,
// щоб зміна не залежала від гнучкої панелі десь збоку.
function currentFlexiblePanelId() {
    if (panelVisible.blocks) return 'blocks';
    if (panelVisible.code) return 'code';
    return 'output';
}
function setupPanelResizers() {
    document.querySelectorAll('.panel-resizer').forEach(resizer => {
        const [leftId, rightId] = (resizer.dataset.resizer || '').split('-');
        resizer.addEventListener('pointerdown', (e) => {
            if (resizer.hidden) return;
            e.preventDefault();
            const flexId = currentFlexiblePanelId();
            const leftPanel = document.querySelector(`.panel[data-panel="${leftId}"]`);
            const rightPanel = document.querySelector(`.panel[data-panel="${rightId}"]`);
            if (!leftPanel || !rightPanel) return;
            const leftFixed = leftId !== flexId;
            const rightFixed = rightId !== flexId;
            const startX = e.clientX;
            const startLeftWidth = leftPanel.getBoundingClientRect().width;
            const startRightWidth = rightPanel.getBoundingClientRect().width;
            const wrapWidth = document.querySelector('.wrap')?.getBoundingClientRect().width || window.innerWidth;
            const maxFixedWidth = Math.round(wrapWidth * 0.75);
            resizer.classList.add('is-dragging');
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
            resizer.setPointerCapture(e.pointerId);

            function onMove(ev) {
                const delta = ev.clientX - startX;
                if (leftFixed && rightFixed) {
                    // Обидві сусідні панелі фіксовані — трейд напряму:
                    // вправо росте ліва й на стільки ж звужується права.
                    const maxPositive = startRightWidth - PANEL_MIN_WIDTH;
                    const maxNegative = -(startLeftWidth - PANEL_MIN_WIDTH);
                    const clamped = Math.max(maxNegative, Math.min(maxPositive, delta));
                    panelWidth[leftId] = Math.round(startLeftWidth + clamped);
                    panelWidth[rightId] = Math.round(startRightWidth - clamped);
                    leftPanel.style.width = panelWidth[leftId] + 'px';
                    rightPanel.style.width = panelWidth[rightId] + 'px';
                } else {
                    // Один бік — гнучка панель ("Блоки"): рухаємо тільки
                    // фіксовану, гнучка сама займе решту простору сама.
                    const fixedId = leftFixed ? leftId : rightId;
                    const fixedPanel = leftFixed ? leftPanel : rightPanel;
                    const startWidth = leftFixed ? startLeftWidth : startRightWidth;
                    const signedDelta = leftFixed ? delta : -delta;
                    const next = Math.max(PANEL_MIN_WIDTH, Math.min(maxFixedWidth, Math.round(startWidth + signedDelta)));
                    panelWidth[fixedId] = next;
                    fixedPanel.style.width = next + 'px';
                }
                if (handleBlocklyResize) handleBlocklyResize();
            }
            function onUp(ev) {
                resizer.releasePointerCapture(ev.pointerId);
                resizer.classList.remove('is-dragging');
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
                resizer.removeEventListener('pointermove', onMove);
                resizer.removeEventListener('pointerup', onUp);
                resizer.removeEventListener('pointercancel', onUp);
                savePanelWidths();
            }
            resizer.addEventListener('pointermove', onMove);
            resizer.addEventListener('pointerup', onUp);
            resizer.addEventListener('pointercancel', onUp);
        });
    });
}

function setPanelVisible(id, visible, btnId, labelShow, labelHide) {
    panelVisible[id] = visible;
    const btn = document.getElementById(btnId);
    if (btn) btn.textContent = visible ? labelHide : labelShow;
    updatePanelLayout();
    // БАГФІКС: приховування/показ БУДЬ-ЯКОЇ панелі змінює доступну ширину
    // для панелі "Блоки" (через перерахунок flex-ширин панелей), а не
    // лише коли ховають/показують саму панель блоків. Blockly не стежить
    // за розміром свого контейнера сам — тому SVG-канва лишалась старого
    // розміру, а вільний простір навколо просто показував чорний фон
    // контейнера #blocklyArea замість розширеної робочої області.
    requestAnimationFrame(() => { if (panelVisible.blocks && handleBlocklyResize) handleBlocklyResize(); });
}

function toggleBlocksPanel() {
    setPanelVisible('blocks', !panelVisible.blocks, 'toggleBlocksBtn', '🧩 Show Blocks', '🧩 Hide Blocks');
}
function toggleCodePanel() {
    setPanelVisible('code', !panelVisible.code, 'toggleCodeBtn', '🐍 Show Code', '🐍 Hide Code');
}
function toggleOutputPanel() {
    setPanelVisible('output', !panelVisible.output, 'toggleOutputBtn', '🖥 Show Output', '🖥 Hide Output');
}

// ================= МЕНЮ (☰) =================
function initMenu() {
    const menuBtn = document.getElementById('menuBtn');
    const dropdown = document.getElementById('menuDropdown');
    if (!menuBtn || !dropdown) return;
    // БАГФІКС: раніше меню позиціонувалось жорстко (top:52px;left:12px)
    // відносно <header> — на екранах, де висота шапки/кнопок трохи інша
    // (напр. коли кнопки перенеслись на 2 рядки), це збігалося з
    // розташуванням панелі категорій Blockly (0,0 в блочній панелі), і,
    // оскільки власний SVG-тулбокс Blockly малюється у своєму окремому
    // stacking-контексті, він міг перекривати меню зверху. Тепер позиція
    // рахується від РЕАЛЬНИХ координат кнопки "☰" (як і в "➕ Модулі"),
    // а z-index підняли з запасом вище будь-якого внутрішнього UI Blockly.
    function positionDropdown() {
        const rect = menuBtn.getBoundingClientRect();
        dropdown.style.top = (rect.bottom + 6) + 'px';
        dropdown.style.left = rect.left + 'px';
    }
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const opening = dropdown.style.display === 'none';
        if (opening) positionDropdown();
        dropdown.style.display = opening ? 'flex' : 'none';
    });
    window.addEventListener('resize', () => { if (dropdown.style.display !== 'none') positionDropdown(); });
    // Клік по будь-якій кнопці всередині меню — закриваємо меню (крім
    // прихованих <input type="file">, які самі відкривають системний діалог).
    dropdown.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => { dropdown.style.display = 'none'; });
    });
    document.addEventListener('click', (e) => {
        if (dropdown.style.display !== 'none' && !dropdown.contains(e.target) && e.target !== menuBtn) {
            dropdown.style.display = 'none';
        }
    });
}

// ================= ІМПОРТ .py (нове) =================
async function handlePyFileUpload(evt) {
    const file = evt.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
        try {
            if (workspaceHasBlocks() && !confirm(t('confirm_load_py'))) return;
            const pyText = reader.result;
            const generatedXml = pythonToBlocklyXml(pyText);
            if (window.ensureModulesForXmlText) await window.ensureModulesForXmlText(generatedXml);
            suppressAutoRefresh = true;
            suppressFunctionFieldSync = true; // FIX: див. коментар біля registerFunctionBlockWatcher() у blocks-turtle.js
            try {
                workspace.clear();
                Blockly.Xml.domToWorkspace(xmlTextToDom(generatedXml), workspace);
            } finally {
                suppressAutoRefresh = false;
                suppressFunctionFieldSync = false;
            }
            if (window.__syncFunctionFields) window.__syncFunctionFields();
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

// ================= БЛОКУВАННЯ РЕДАКТОРА (напр. під час передачі файлів на Pico) =================
// "Захист від дурня": поки триває довга операція (завантаження коду й
// бібліотек на плату по повільному serial-з'єднанню), користувач не
// повинен мати змогу редагувати блоки чи код — інакше синхронізація
// код↔блоки могла б втрутитися в те, що саме зараз читається/шлеться.
window.setEditorLocked = function setEditorLocked(locked) {
    const wrap = document.querySelector('.wrap');
    if (wrap) wrap.classList.toggle('editor-locked', locked);
    const codeEl = document.getElementById('code');
    if (codeEl) codeEl.readOnly = locked;
};

// ================= ПОВНОЕКРАННИЙ РЕЖИМ (панель "Виконання": черепаха/Tkinter/Pico) =================
function toggleFullscreenCanvas() {
    const el = document.getElementById('canvasWrap');
    if (!el) return;
    if (document.fullscreenElement === el) {
        document.exitFullscreen();
    } else if (el.requestFullscreen) {
        el.requestFullscreen().catch(err => console.warn('Full screen недоступний:', err));
    }
}
document.addEventListener('fullscreenchange', () => {
    const el = document.getElementById('canvasWrap');
    if (el) el.classList.toggle('is-fullscreen', document.fullscreenElement === el);
});

// ================= BUTTON EVENTS =================
document.getElementById('runBtn').addEventListener('click', runCode);
document.getElementById('stopBtn').addEventListener('click', clearTurtle);
document.getElementById('newProjectBtn').addEventListener('click', newProject);
// "💡 Приклад" видалено з меню — тепер приклади й уроки живуть у
// модальному вікні "📖 Уроки" (js/lessons.js), яке саме керує своїми
// обробниками кліків на плитках.
document.getElementById('saveBtn').addEventListener('click', saveProjectXml);
document.getElementById('loadFileInput').addEventListener('change', handleProjectFileUpload);
document.getElementById('loadBtn').addEventListener('click', () => document.getElementById('loadFileInput').click());
document.getElementById('downloadBtn').addEventListener('click', downloadPy);
document.getElementById('importPyBtn').addEventListener('click', () => document.getElementById('importPyFileInput').click());
document.getElementById('importPyFileInput').addEventListener('change', handlePyFileUpload);
document.getElementById('toggleBlocksBtn').addEventListener('click', toggleBlocksPanel);
document.getElementById('toggleCodeBtn').addEventListener('click', toggleCodePanel);
document.getElementById('toggleOutputBtn').addEventListener('click', toggleOutputPanel);
document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreenCanvas);
document.getElementById('syncBtn').addEventListener('click', () => applyCodeToBlocks(document.getElementById('code').value));
initMenu();

// ================= Довідка "?" =================
(function initHelpModal() {
    const btn = document.getElementById('helpBtn');
    const modal = document.getElementById('helpModal');
    const closeBtn = document.getElementById('helpModalClose');
    if (!btn || !modal) return;
    btn.addEventListener('click', () => { modal.style.display = 'flex'; });
    closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
})();
setupPanelResizers();
updatePanelLayout();

const codeEl = document.getElementById('code');
// FIX за запитом користувача: раніше блоки перебудовувались АВТОМАТИЧНО
// через ~0.9с паузи в наборі тексту ("по часу"), що виглядало як
// самовільний "перехід на новий рядок"/переформатування під час набору.
// Тепер синхронізація код→блоки відбувається лише по натисканню Enter
// (тобто коли рядок команди завершено) — це і є момент, коли з'являється
// відповідний блок у зоні скриптів. Просто набір тексту без Enter нічого
// не перебудовує.
// ================= РОЗУМНЕ РЕДАГУВАННЯ: Enter/Tab/Backspace =================
// Вимога: Enter після ":" переходить у тіло циклу/умови з відступом; Tab
// вставляє відступ замість переходу фокуса; Backspace на початку відступу
// знімає ОДИН РІВЕНЬ відступу за раз (як у звичайних редакторах коду), а
// не по одному символу, і лише коли відступу вже немає — зливає з
// попереднім рядком (стандартна поведінка браузера).
//
// БАГФІКС: пряме присвоєння `textarea.value = ...` НЕ потрапляє в
// нативний стек скасувань браузера — тому Ctrl+Z переставав працювати
// одразу після першого Enter/Tab. document.execCommand('insertText'/
// 'delete') — хоч і застарілий API, але й досі єдиний надійний спосіб
// у Chrome/Edge/Firefox програмно змінити textarea ТА зберегти Ctrl+Z.
function insertTextAtCursor(ta, text) {
    ta.focus();
    if (document.execCommand && document.execCommand('insertText', false, text)) return;
    // резервний варіант (якщо execCommand недоступний у браузері) —
    // працює, але дійсно не зберігає Ctrl+Z для цієї конкретної дії.
    const start = ta.selectionStart, end = ta.selectionEnd;
    ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
    ta.selectionStart = ta.selectionEnd = start + text.length;
}
function deleteRangeAtCursor(ta, from, to) {
    ta.focus();
    ta.setSelectionRange(from, to);
    if (document.execCommand && document.execCommand('delete', false)) return;
    const value = ta.value;
    ta.value = value.slice(0, from) + value.slice(to);
    ta.selectionStart = ta.selectionEnd = from;
}

const CODE_INDENT_UNIT = '    '; // 4 пробіли — той самий крок, що й у решті проєкту
codeEl.addEventListener('keydown', (e) => {
    const ta = codeEl;
    const value = ta.value;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    if (e.key === 'Tab') {
        e.preventDefault();
        insertTextAtCursor(ta, CODE_INDENT_UNIT);
        syncHighlightOverlay();
        return;
    }

    if (e.key === 'Enter') {
        e.preventDefault();
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const currentLine = value.slice(lineStart, start);
        const indentMatch = currentLine.match(/^[ \t]*/);
        let indent = indentMatch ? indentMatch[0] : '';
        // Рядок (до курсора) закінчується на ":" — це початок тіла
        // циклу/умови/функції — переходимо в тіло з додатковим відступом.
        if (/:\s*$/.test(currentLine)) indent += CODE_INDENT_UNIT;
        insertTextAtCursor(ta, '\n' + indent);
        syncHighlightOverlay();
        // синхронізація код→блоки, як і раніше, відбувається по Enter
        // (нижче лишається keyup-обробник, що й викличе applyCodeToBlocks
        // із уже оновленим значенням textarea)
        return;
    }

    if (e.key === 'Backspace' && start === end) {
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const beforeCursor = value.slice(lineStart, start);
        if (beforeCursor.length > 0 && /^[ \t]+$/.test(beforeCursor)) {
            e.preventDefault();
            const remainder = beforeCursor.length % CODE_INDENT_UNIT.length;
            const toRemove = remainder === 0 ? CODE_INDENT_UNIT.length : remainder;
            deleteRangeAtCursor(ta, start - toRemove, start);
            syncHighlightOverlay();
        }
        // інакше — стандартна поведінка (видалення символу, або злиття з
        // попереднім рядком, якщо курсор на самому початку рядка)
    }
});

codeEl.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        applyCodeToBlocks(codeEl.value);
    }
});
// Підсвітка оновлюється на КОЖНЕ введення (на відміну від синхронізації
// з блоками, яка спрацьовує лише по Enter) — це суто візуальний ефект,
// що не чіпає позицію курсора чи блоки.
codeEl.addEventListener('input', syncHighlightOverlay);
codeEl.addEventListener('scroll', () => {
    const pre = document.getElementById('codeHighlight');
    if (pre) { pre.scrollTop = codeEl.scrollTop; pre.scrollLeft = codeEl.scrollLeft; }
});

// ================= DOM READY =================
document.addEventListener('DOMContentLoaded', () => {
    if (!window.Blockly) {
        console.error('Blockly is not loaded. Check script include order.');
        setStatus(t('status_blockly_not_loaded'), 'error');
        return;
    }
    initializeWorkspace();
});
