// =====================================================================
// generator.js — ядро генератора Python (Blocks → Python)
// =====================================================================
// Чиста логіка перетворення блоків Blockly у Python-код: не залежить від
// конкретних типів блоків (Turtle/Tkinter/Pico визначають власні
// генератори в PY[...] окремо) і не звертається до DOM, крім самого
// об'єкта workspace. Завантажується ПЕРШИМ з чотирьох файлів колишнього
// app.js — інші модулі (blocks-turtle.js, workspace.js, ui.js,
// js/extensions/*.js) покладаються на PY/valueToCode/statementToCode/
// indentBlock/toIdentifier та на глобальні змінні, оголошені тут.
// =====================================================================

// ================= GLOBALS =================
let workspace;
let currentTurtleName = 't';
let handleBlocklyResize = null;
let lastSyncedCode = null;   // останній код, з якого вже синхронізовано блоки
let suppressAutoRefresh = false;   // FIX: вимикає проміжні refreshCode() під час масового перезавантаження блоків

// =====================================================================
// САМОДОСТАТНІЙ ГЕНЕРАТОР PYTHON (без залежності від CDN!)
// =====================================================================
// БАГ, ЗНАЙДЕНИЙ ПРИ ТЕСТУВАННІ В РЕАЛЬНОМУ БРАУЗЕРІ: скрипт
// "python.min.js" з CDN або взагалі не завантажується (заблоковано
// мережею/adblock'ом/фаєрволом), або завантажується непередбачувано.
// Тому CDN Python-генератор не використовується ВЗАГАЛІ — PY нижче є
// єдиним і повним генератором для всіх типів блоків цього проєкту.
//
// ГЛОБАЛЬНИЙ РІВЕНЬ (не всередині функції) — навмисно: розширення
// (окремі js-файли на кшталт js/extensions/tkinter.js) підключаються
// ПІСЛЯ app.js і додають власні записи в той самий об'єкт PY, а також
// користуються тими самими valueToCode/statementToCode.
window.PY = {};
const PY = window.PY;

function indentBlock(code) {
    if (!code || !code.trim()) return '    pass\n';
    return code.split('\n').filter(line => line.trim() !== '').map(line => '    ' + line).join('\n') + '\n';
}

// Код для одного значення (value-вхід): бере ПІДКЛЮЧЕНИЙ блок і викликає
// його ВЛАСНИЙ генератор (а не сире значення поля).
function valueToCode(block, name, fallback) {
    const target = block.getInputTargetBlock(name);
    if (!target) return fallback;
    const fn = PY[target.type];
    if (!fn) { console.warn('Немає генератора для типу блоку:', target.type); return fallback; }
    const result = fn(target);
    return Array.isArray(result) ? result[0] : result;
}

// Код для ланцюжка блоків (block -> next -> next -> ...), незалежно від
// того, чи це вкладений statement-вхід, чи блоки верхнього рівня.
function chainToCode(startBlock) {
    let code = '';
    let b = startBlock;
    while (b) {
        const fn = PY[b.type];
        if (fn) {
            const result = fn(b);
            code += Array.isArray(result) ? result[0] : result;
        } else {
            console.warn('Немає генератора для типу блоку:', b.type);
        }
        b = b.getNextBlock();
    }
    return code;
}

function statementToCode(block, name) {
    return indentBlock(chainToCode(block.getInputTargetBlock(name)));
}

// Код для всієї робочої області: кожен окремий "стек" (top block)
// генерується повністю (включно з усіма next-блоками).
function workspaceToPython(ws) {
    return ws.getTopBlocks(true).map(chainToCode).join('');
}
window.__workspaceToPython = workspaceToPython;
// ================= HELPER: коректний ідентифікатор Python =================
function toIdentifier(raw, fallback) {
    const cleaned = (raw || '').trim();
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(cleaned)) return cleaned;
    return fallback;
}
