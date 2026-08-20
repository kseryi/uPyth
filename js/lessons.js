// =====================================================================
// lessons.js — каталог уроків (5 груп) + модальне вікно вибору уроку.
// =====================================================================
// Кожен урок — окремий .xml файл у теці /lessons/<група>/<файл>.xml.
// XML завантажується напряму через fetch() з реального файлу — файл
// НЕ дублюється в JS. Тому середовище обов'язково має бути відкрите
// через локальний HTTP-сервер (не file://), як і зазначено в README —
// це вже й так було вимогою проєкту через CORS-обмеження на інші ресурси
// (js/extensions/*.js, бібліотеки для Pico).
//
// СТРУКТУРА КАТАЛОГУ (LESSON_GROUPS): 5 груп. Наразі наповнена лише
// перша ("Приклади") — той приклад, що раніше був у спадному меню
// "💡 Приклад". Решта груп — заготовки під майбутній контент (модальне
// вікно чесно показує "незабаром", а не вигадані уроки).

// id групи -> {name/nameEn через t(), icon, lessons: [{id, name-ключ, desc-ключ, xmlKey}]}
window.LESSON_GROUPS = [
    {
        id: 'examples',
        icon: 'assets/icons/turtle.svg',
        titleKey: 'lessongrp_examples',
        lessons: [
            { id: 'turtle-square', nameKey: 'lesson_turtle_square_name', descKey: 'lesson_turtle_square_desc', xmlKey: 'examples/turtle-square', icon: 'assets/icons/turtle.svg' }
        ]
    },
    { id: 'python_basics', icon: 'assets/icons/code.svg', titleKey: 'lessongrp_python_basics', lessons: [] },
    { id: 'turtle', icon: 'assets/icons/turtle.svg', titleKey: 'lessongrp_turtle', lessons: [] },
    { id: 'tkinter', icon: 'assets/icons/tkinter.svg', titleKey: 'lessongrp_tkinter', lessons: [] },
    { id: 'pico', icon: 'assets/icons/mcu.svg', titleKey: 'lessongrp_pico', lessons: [] }
];

// Кеш завантажених .xml (у пам'яті, на сесію) — щоб повторний вибір
// того самого уроку не робив зайвий мережевий запит.
const lessonXmlCache = {};

async function fetchLessonXml(xmlKey) {
    if (lessonXmlCache[xmlKey]) return lessonXmlCache[xmlKey];
    const path = `lessons/${xmlKey}.xml`;
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} під час завантаження ${path}`);
    }
    const xmlText = await response.text();
    lessonXmlCache[xmlKey] = xmlText;
    return xmlText;
}

(function initLessonsUI() {
    function buildModal() {
        const overlay = document.createElement('div');
        overlay.id = 'lessonsModal';
        overlay.className = 'big-modal-overlay';
        overlay.style.display = 'none';

        const box = document.createElement('div');
        box.className = 'big-modal-box';
        overlay.appendChild(box);

        const header = document.createElement('div');
        header.className = 'big-modal-header';
        const title = document.createElement('h3');
        title.textContent = t('lessons_title');
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
            window.LESSON_GROUPS.forEach(group => {
                const groupHeader = document.createElement('div');
                groupHeader.className = 'modal-group-header'; // той самий стиль заголовка секції, що й у "Бібліотеки"
                groupHeader.innerHTML = `<img src="${group.icon}" width="24" height="24" alt=""/><span>${t(group.titleKey)}</span>`;
                body.appendChild(groupHeader);

                if (!group.lessons.length) {
                    const soon = document.createElement('div');
                    soon.className = 'pico-hint lesson-group-soon';
                    soon.textContent = t('lessons_coming_soon');
                    body.appendChild(soon);
                    return;
                }

                const grid = document.createElement('div');
                grid.className = 'tile-grid lesson-tile-grid';
                body.appendChild(grid);

                group.lessons.forEach(lesson => {
                    const tile = document.createElement('button');
                    tile.type = 'button';
                    tile.className = 'tile-card';

                    const icon = document.createElement('img');
                    icon.className = 'tile-icon';
                    icon.src = lesson.icon || group.icon;
                    icon.width = 48; icon.height = 48;
                    icon.alt = '';
                    tile.appendChild(icon);

                    const name = document.createElement('div');
                    name.className = 'tile-name';
                    name.textContent = t(lesson.nameKey);
                    tile.appendChild(name);

                    const desc = document.createElement('div');
                    desc.className = 'tile-desc';
                    desc.textContent = t(lesson.descKey);
                    tile.appendChild(desc);

                    tile.addEventListener('click', async () => {
                        overlay.style.display = 'none';
                        if (typeof window.loadLessonXml !== 'function') return;
                        try {
                            const xmlText = await fetchLessonXml(lesson.xmlKey);
                            await window.loadLessonXml(xmlText, t(lesson.nameKey));
                        } catch (err) {
                            console.error('Не вдалося завантажити урок', lesson.xmlKey, err);
                            if (typeof setStatus === 'function') {
                                setStatus(t('status_lesson_load_failed'), 'error');
                            }
                        }
                    });

                    grid.appendChild(tile);
                });
            });
        }
        rebuildBody();
        overlay.__rebuildBody = rebuildBody;
        document.body.appendChild(overlay);
        return overlay;
    }

    function attach() {
        const btn = document.getElementById('lessonsBtn');
        if (!btn) return;
        let modal = buildModal();

        const previousOnLanguageChanged = window.onLanguageChanged;
        window.onLanguageChanged = function (code) {
            if (typeof previousOnLanguageChanged === 'function') previousOnLanguageChanged(code);
            const wasOpen = modal.style.display !== 'none';
            modal.remove();
            modal = buildModal();
            modal.style.display = wasOpen ? 'flex' : 'none';
        };

        btn.addEventListener('click', () => {
            if (modal.__rebuildBody) modal.__rebuildBody();
            modal.style.display = 'flex';
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attach);
    } else {
        attach();
    }
})();
