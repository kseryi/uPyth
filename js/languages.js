// =====================================================================
// languages.js — реєстр мов інтерфейсу + логіка перемикання.
// =====================================================================
// Це ЄДИНЕ місце, звідки береться список мов для спадного меню вгорі
// праворуч. Кожен файл локалізації (js/locales/uk.js, js/locales/en.js,
// або будь-який ВЛАСНИЙ файл користувача) викликає registerLanguage(...),
// щоб додати себе до цього списку — languages.js нічого не знає наперед
// про конкретні мови, лише про механізм їх реєстрації.
//
// ЯК ДОДАТИ ВЛАСНУ МОВУ (наприклад, польську):
//   1. Створіть файл js/locales/pl.js за зразком js/locales/en.js —
//      скопіюйте його і перекладіть значення (ключі — НЕ чіпати).
//   2. Підключіть його в index.htm одним рядком:
//      <script src="js/locales/pl.js"></script>
//      (додайте ПІСЛЯ uk.js/en.js, ПЕРЕД app.js)
//   3. Все — мова сама з'явиться у спадному меню.

window.UPY_LANGUAGES = window.UPY_LANGUAGES || [];
window.UPY_LOCALES = window.UPY_LOCALES || {};

// Реєстрація мови. code — короткий код ('uk','en','pl',...), name — те,
// що показується у спадному меню ('Українська','English',...), dict —
// об'єкт { ключ: 'переклад' }.
window.registerLanguage = function(code, name, dict) {
    window.UPY_LOCALES[code] = Object.assign({}, window.UPY_LOCALES[code] || {}, dict || {});
    const existing = window.UPY_LANGUAGES.find(l => l.code === code);
    if (existing) {
        existing.name = name;
    } else {
        window.UPY_LANGUAGES.push({ code, name });
    }
};

const I18N_STORAGE_KEY = 'uPy.language';
const I18N_DEFAULT_LANG = 'uk';

function i18nGetSavedLanguage() {
    try { return localStorage.getItem(I18N_STORAGE_KEY); } catch (e) { return null; }
}
function i18nSaveLanguage(code) {
    try { localStorage.setItem(I18N_STORAGE_KEY, code); } catch (e) { /* ignore */ }
}

// Переклад одного ключа. Фолбек: поточна мова → uk → сам ключ (щоб
// відсутній переклад показував хоч щось зрозуміле, а не порожнечу).
function t(key) {
    const lang = window.__currentLang || I18N_DEFAULT_LANG;
    const dict = window.UPY_LOCALES[lang] || {};
    if (dict[key] !== undefined) return dict[key];
    const fallback = window.UPY_LOCALES[I18N_DEFAULT_LANG] || {};
    if (fallback[key] !== undefined) return fallback[key];
    return key;
}

// Застосовує переклад до всіх елементів з data-i18n / data-i18n-title /
// data-i18n-html атрибутами. Викликається при кожній зміні мови.
function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.title = t(el.getAttribute('data-i18n-title'));
    });
    // data-i18n-html — для випадків, де в тексті є HTML-розмітка
    // (напр. <b>...</b>). Використовується лише для нашого ВЛАСНОГО
    // статичного контенту (не введеного користувачем), тому безпечно.
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    const titleEl = document.querySelector('title[data-i18n]');
    if (titleEl) document.title = t(titleEl.getAttribute('data-i18n'));
    document.documentElement.lang = window.__currentLang || I18N_DEFAULT_LANG;
}

// Перемикає активну мову: зберігає вибір (переживає перезавантаження
// сторінки, доки користувач не змінить мову сам), застосовує переклад
// інтерфейсу, і сповіщає app.js (через window.onLanguageChanged), щоб
// той оновив локалізовані частини, які не є простими DOM-елементами
// (наприклад, назви категорій toolbox).
function setLanguage(code) {
    if (!window.UPY_LOCALES[code]) {
        console.warn('Мову не зареєстровано:', code);
        return;
    }
    window.__currentLang = code;
    i18nSaveLanguage(code);
    applyTranslations();
    if (typeof window.onLanguageChanged === 'function') {
        window.onLanguageChanged(code);
    }
    const sel = document.getElementById('langSelect');
    if (sel && sel.value !== code) sel.value = code;
}

// Заповнює спадне меню зі списку зареєстрованих мов і встановлює
// початкову мову: збережений вибір користувача, або українська
// за замовчуванням.
function initLanguageSwitcher() {
    const sel = document.getElementById('langSelect');
    if (sel) {
        sel.innerHTML = '';
        window.UPY_LANGUAGES.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.code;
            opt.textContent = l.name;
            sel.appendChild(opt);
        });
        sel.addEventListener('change', () => setLanguage(sel.value));
    }
    const saved = i18nGetSavedLanguage();
    const initial = (saved && window.UPY_LOCALES[saved]) ? saved : I18N_DEFAULT_LANG;
    setLanguage(initial);
}

document.addEventListener('DOMContentLoaded', initLanguageSwitcher);
