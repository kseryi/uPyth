// =====================================================================
// lessons.js — каталог уроків (5 груп) + модальне вікно вибору уроку.
// =====================================================================

window.LESSON_GROUPS = [
    {
        id: 'examples',
        icon: 'assets/icons/turtle.svg',
        titleKey: 'lessongrp_examples',
        lessons: [
            { id: 'turtle-square', nameKey: 'lesson_turtle_square_name', descKey: 'lesson_turtle_square_desc', xmlKey: 'turtle-square', icon: 'assets/icons/turtle.svg' }
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

// Єдиний шлях відкриття уроку: завантажує блоки, потім показує теорію.
// Використовують плитки каталогу, стрілки панелі теорії та інші виклики.
window.openLessonById = async function openLessonById(id) {
    const lesson = (window.LESSON_GROUPS || []).flatMap(g => g.lessons || []).find(l => l.id === id);
    if (!lesson || typeof window.loadLessonXml !== 'function') return false;
    try {
        const xmlText = await fetchLessonXml(lesson.xmlKey);
        const loaded = await window.loadLessonXml(xmlText, t(lesson.nameKey));
        if (loaded === false) return false;          // користувач скасував заміну блоків
        if (typeof window.showLessonTheory === 'function') window.showLessonTheory(lesson, xmlText);
        return true;
    } catch (err) {
        console.error('Не вдалося завантажити урок', lesson.xmlKey, err);
        if (typeof setStatus === 'function') setStatus(t('status_lesson_load_failed'), 'error');
        return false;
    }
};

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
                    soon.className = 'pico-hint';
                    soon.style.padding = '4px 4px 12px';
                    soon.textContent = t('lessons_coming_soon');
                    body.appendChild(soon);
                    return;
                }

                const grid = document.createElement('div');
                grid.className = 'tile-grid';
                grid.style.marginBottom = '14px';
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
                        await window.openLessonById(lesson.id);
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
