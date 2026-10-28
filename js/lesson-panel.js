// =====================================================================
// lesson-panel.js — ALPHA: висувна панель теорії до уроку (праворуч).
// =====================================================================
// Модель уроку (у пам'яті і в XML):
//   <lesson id="..."><title lang="uk">…</title></lesson>
//   <theory lang="uk" format="md"><![CDATA[ Markdown ]]></theory>
// format="md" — редактор і безпечний рендер (js/theory-markdown.js);
// без format або format="html" — HTML як є (старі уроки).
//
// • Панель з'являється при відкритті уроку з каталогу або файлу з <theory>.
// • ✏️ відкриває редактор теорії (js/theory-editor.js). Порожній проєкт теж
//   можна описати: ✏️ створює власний урок.
// • Збереження: «💾 Save .xml» дописує <lesson> і <theory> до блоків
//   (augmentProjectDom), тож теорія не губиться.
// • ‹ › — попередній/наступний урок каталогу (код теж завантажується).
// • Ширину можна змінити, перетягнувши ліву межу; ширина зберігається.
// =====================================================================
(function () {
    const WIDTH_KEY = 'upy_lesson_panel_width';
    const LAST_KEY = 'upy_lesson_last';
    const DEFAULT_WIDTH = 420;
    const MIN_WIDTH = 280;

    let current = null;      // {id, nameKey|title, xmlKey, xmlText, model, custom?}
    let panel = null;
    let titleEl, bodyEl, prevBtn, nextBtn, editBtn, closeBtn, handleEl;
    let renderToken = 0;     // відкидає застарілі відповіді (користувач уже перейшов далі)
    let editing = false;     // показувати редактор замість теорії

    function label(key) { return typeof t === 'function' ? t(key) : key; }
    function el(tag, cls, text) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    }
    function textP(text, cls) { const p = el('p', cls); p.textContent = text; return p; }
    function uiLang() { return window.__currentLang || 'uk'; }
    function allLessons() { return (window.LESSON_GROUPS || []).flatMap(g => g.lessons || []); }
    function findLesson(id) { return allLessons().find(l => l.id === id) || null; }
    function isOpen() { return !!panel && panel.classList.contains('open'); }

    // localStorage може бути недоступний (приватний режим, вбудований перегляд)
    function storeGet(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
    function storeSet(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
    function recall() { return findLesson(storeGet(LAST_KEY)); }
    function remember(lesson) { if (!lesson.custom) storeSet(LAST_KEY, lesson.id); }

    // ----- XML → модель -----
    function parseLessonXml(xmlText) {
        if (!xmlText) return null;
        try {
            const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
            if (doc.getElementsByTagName('parsererror').length) return null;
            return doc;
        } catch (_) { return null; }
    }
    function parseModel(xmlText) {
        const doc = parseLessonXml(xmlText);
        if (!doc) return null;
        const titles = {};
        const theory = {};
        const lessonNode = doc.getElementsByTagName('lesson')[0];
        if (lessonNode) {
            Array.from(lessonNode.getElementsByTagName('title')).forEach(n => {
                titles[n.getAttribute('lang') || 'uk'] = n.textContent.trim();
            });
        }
        Array.from(doc.getElementsByTagName('theory')).forEach(n => {
            theory[n.getAttribute('lang') || 'uk'] = {
                format: n.getAttribute('format') || 'html',
                body: n.textContent,
            };
        });
        return { id: lessonNode ? (lessonNode.getAttribute('id') || '') : '', titles, theory };
    }
    function pickEntry(map) {
        return map[uiLang()] || map.uk || Object.values(map)[0] || null;
    }
    function pickTitle(model) {
        return model.titles[uiLang()] || model.titles.uk || Object.values(model.titles)[0] || '';
    }
    function hasContent(model) {
        return !!model && (Object.keys(model.theory).length > 0 || Object.keys(model.titles).length > 0);
    }

    // XML каталожного уроку: спершу кеш, потім lessons/<xmlKey>.xml
    async function getLessonXml(lesson) {
        if (lesson.xmlText) return lesson.xmlText;
        if (!lesson.xmlKey) return null;
        try {
            const r = await fetch(`lessons/${lesson.xmlKey}.xml`);
            if (!r.ok) return null;
            lesson.xmlText = await r.text();
            return lesson.xmlText;
        } catch (_) { return null; }
    }
    async function ensureModel(lesson) {
        if (!lesson.model) {
            const xml = await getLessonXml(lesson);
            lesson.model = parseModel(xml) || { id: lesson.id, titles: {}, theory: {} };
        }
        return lesson.model;
    }
    function newCustomLesson() {
        return {
            id: 'custom-' + Date.now().toString(36),
            custom: true,
            model: { id: '', titles: {}, theory: {} },
        };
    }

    // ----- UI -----
    function setWidth(px) {
        const max = Math.round(window.innerWidth * 0.85);
        const w = Math.max(MIN_WIDTH, Math.min(max, Math.round(px)));
        panel.style.width = w + 'px';
        return w;
    }

    function positionUnderHeader() {
        const header = document.querySelector('header');
        panel.style.top = (header ? Math.round(header.getBoundingClientRect().bottom) : 0) + 'px';
    }

    function build() {
        if (panel) return;
        panel = el('aside', 'lesson-panel');
        panel.id = 'lessonPanel';
        panel.setAttribute('aria-hidden', 'true');

        handleEl = el('div', 'lp-resize');
        const head = el('div', 'lp-head');
        prevBtn = el('button', 'lp-btn');
        prevBtn.addEventListener('click', () => navigate(-1));
        titleEl = el('h3', 'lp-title');
        editBtn = el('button', 'lp-btn lp-edit', '✏️');
        editBtn.addEventListener('click', () => editLessonTheory());
        nextBtn = el('button', 'lp-btn');
        nextBtn.addEventListener('click', () => navigate(1));
        closeBtn = el('button', 'lp-btn lp-close');
        closeBtn.addEventListener('click', closePanel);
        head.append(prevBtn, titleEl, editBtn, nextBtn, closeBtn);

        bodyEl = el('div', 'lp-body');
        panel.append(handleEl, head, bodyEl);
        document.body.appendChild(panel);

        handleEl.addEventListener('pointerdown', startResize);
        setWidth(parseInt(storeGet(WIDTH_KEY), 10) || DEFAULT_WIDTH);
    }

    function refreshLabels() {
        if (!panel) return;
        prevBtn.textContent = '‹';
        prevBtn.title = label('lp_prev');
        nextBtn.textContent = '›';
        nextBtn.title = label('lp_next');
        editBtn.title = label('lp_edit');
        closeBtn.textContent = label('lp_close');
        handleEl.title = label('lp_resize');
    }

    function editorLabels() {
        return {
            titlePh: label('te_title_ph'), textPh: label('te_text_ph'),
            heading: label('te_heading'), bold: label('te_bold'), italic: label('te_italic'),
            code: label('te_code'), list: label('te_list'), image: label('te_image'),
            python: label('te_python'), video: label('te_video'),
            preview: label('te_preview'), edit: label('te_edit'),
            save: label('te_save'), cancel: label('te_cancel'), insert: label('te_insert'),
            fromFile: label('te_from_file'), urlPh: label('te_url_ph'), altPh: label('te_alt_ph'),
            videoPh: label('te_video_ph'), pythonPh: label('te_python_ph'),
            badImage: label('te_bad_image'), badVideo: label('te_bad_video'),
            badType: label('te_bad_type'), tooBig: label('te_too_big'),
            badSvg: label('te_bad_svg'), imageHint: label('te_image_hint'),
            emptyCode: label('te_empty_code'),
        };
    }

    function renderPicker() {
        let any = false;
        (window.LESSON_GROUPS || []).forEach(group => {
            (group.lessons || []).forEach(lesson => {
                any = true;
                const b = el('button', 'lp-picker-item');
                b.textContent = label(lesson.nameKey);
                const small = el('small');
                small.textContent = label(lesson.descKey);
                b.appendChild(small);
                b.addEventListener('click', () => window.openLessonById(lesson.id));
                bodyEl.appendChild(b);
            });
        });
        if (!any) bodyEl.appendChild(textP(label('lessons_coming_soon'), 'lp-muted'));
    }

    function renderEditor(model) {
        const lang = uiLang();
        const entry = model.theory[lang];
        if (entry && entry.format !== 'md') {
            // HTML-теорію (старі уроки) редактор не розбирає: пропонуємо явно перевести
            bodyEl.appendChild(textP(label('te_html_notice'), 'lp-muted'));
            const b = el('button', 'lp-btn te-btn', label('te_to_md'));
            b.type = 'button';
            b.addEventListener('click', () => {
                model.theory[lang] = { format: 'md', body: '' };
                renderEditor(model);
            });
            bodyEl.appendChild(b);
            return;
        }
        window.buildTheoryEditor(bodyEl, {
            title: model.titles[lang] || '',
            body: entry ? entry.body : '',
            labels: editorLabels(),
            onSave: (body, title) => {
                model.theory[lang] = { format: 'md', body };
                if (title) model.titles[lang] = title;
                editing = false;
                if (typeof window.scheduleAutosave === 'function') window.scheduleAutosave();
                render();
            },
            onCancel: () => { editing = false; render(); },
        });
    }

    async function render() {
        if (!panel) return;
        const token = ++renderToken;
        refreshLabels();
        bodyEl.innerHTML = '';

        if (!current) {
            titleEl.textContent = label('lp_pick_lesson');
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            renderPicker();
            return;
        }

        const list = allLessons();
        const idx = list.findIndex(l => l.id === current.id && !current.custom);
        prevBtn.disabled = idx <= 0;
        nextBtn.disabled = idx < 0 || idx >= list.length - 1;
        titleEl.textContent = current.nameKey ? label(current.nameKey) : (current.title || current.id);
        bodyEl.appendChild(textP(label('lp_loading'), 'lp-muted'));

        const model = await ensureModel(current);
        if (token !== renderToken) return;   // відповідь застаріла
        if (!current.nameKey) titleEl.textContent = pickTitle(model) || current.title || current.id;
        bodyEl.innerHTML = '';

        if (editing) { renderEditor(model); return; }

        const entry = pickEntry(model.theory);
        if (!entry) { bodyEl.appendChild(textP(label('lp_no_theory'), 'lp-muted')); return; }
        bodyEl.innerHTML = entry.format === 'md'
            ? window.TheoryMarkdown.renderTheoryMarkdown(entry.body)
            : entry.body;   // HTML-формат старих уроків
    }

    function navigate(delta) {
        if (!current || current.custom) return;
        editing = false;
        const list = allLessons();
        const target = list[list.findIndex(l => l.id === current.id) + delta];
        if (target) window.openLessonById(target.id);
    }

    function openPanel() {
        build();
        positionUnderHeader();
        panel.classList.add('open');
        panel.setAttribute('aria-hidden', 'false');
        render();
    }

    function closePanel() {
        if (!panel) return;
        editing = false;
        panel.classList.remove('open');
        panel.setAttribute('aria-hidden', 'true');
    }

    function startResize(e) {
        e.preventDefault();
        handleEl.setPointerCapture(e.pointerId);
        const move = ev => setWidth(window.innerWidth - ev.clientX);
        const up = () => {
            handleEl.removeEventListener('pointermove', move);
            handleEl.removeEventListener('pointerup', up);
            storeSet(WIDTH_KEY, String(panel.offsetWidth));
        };
        handleEl.addEventListener('pointermove', move);
        handleEl.addEventListener('pointerup', up);
    }

    // ----- публічне API -----

    window.toggleLessonPanel = function () {
        if (isOpen()) { closePanel(); return; }
        if (!current) current = recall();
        openPanel();
    };

    // ✏️: відкрити редактор; без уроку — створити власний
    function editLessonTheory() {
        if (!current) current = newCustomLesson();
        editing = true;
        openPanel();
    }
    window.editLessonTheory = editLessonTheory;

    // Викликається з openLessonById() після завантаження уроку каталогу.
    window.showLessonTheory = function (lesson, xmlText) {
        const extra = {};
        if (xmlText) { extra.xmlText = xmlText; extra.model = parseModel(xmlText) || undefined; }
        current = Object.assign({}, lesson, extra);
        editing = false;
        remember(current);
        openPanel();
    };

    // Урок із XML-тексту або null, якщо теорії й назви немає.
    function lessonFromXml(xmlText) {
        const model = parseModel(xmlText);
        if (!hasContent(model)) return null;
        const catalog = model.id ? findLesson(model.id) : null;
        return catalog
            ? Object.assign({}, catalog, { xmlText, model })
            : { id: model.id || 'file', title: pickTitle(model) || model.id || 'lesson', custom: true, xmlText, model };
    }

    // Викликається з handleProjectFileUpload() після відкриття .xml файлу.
    window.onProjectXmlLoaded = function (xmlText) {
        const lesson = lessonFromXml(xmlText);
        if (!lesson) return;              // звичайний проєкт без теорії — панель не чіпаємо
        current = lesson;
        editing = false;
        remember(current);
        openPanel();
    };

    // Викликається з restoreAutoSavedWorkspace() після збою браузера.
    // Відновлює урок без відкриття панелі.
    window.restoreLessonState = function (xmlText) {
        const lesson = lessonFromXml(xmlText);
        if (!lesson) return;
        current = lesson;
        editing = false;
        remember(current);
    };

    // Текст теорії пишемо як звичайний текст (XML сам екранує < > &). CDATA тут
    // не використовуємо: pretty-print Blockly додає відступи навколо CDATA-вузла і
    // псує перший рядок Markdown (заголовок стає абзацом). Звичайний текст — точний.
    function appendTheoryText(doc, parent, text) {
        parent.appendChild(doc.createTextNode(String(text == null ? '' : text)));
    }

    // Викликається з saveProjectXml() — дописує урок і теорію до збережених блоків.
    window.augmentProjectDom = function (dom) {
        if (!current) return;
        const model = current.model || parseModel(current.xmlText);
        if (!hasContent(model)) return;
        const doc = dom.ownerDocument;
        const ns = dom.namespaceURI;
        const nodes = [];

        const lessonEl = doc.createElementNS(ns, 'lesson');
        lessonEl.setAttribute('id', current.id);
        Object.keys(model.titles).forEach(lang => {
            const te = doc.createElementNS(ns, 'title');
            te.setAttribute('lang', lang);
            te.textContent = model.titles[lang];
            lessonEl.appendChild(te);
        });
        nodes.push(lessonEl);

        Object.keys(model.theory).forEach(lang => {
            const entry = model.theory[lang];
            const th = doc.createElementNS(ns, 'theory');
            th.setAttribute('lang', lang);
            if (entry.format && entry.format !== 'html') th.setAttribute('format', entry.format);
            appendTheoryText(doc, th, entry.body);
            nodes.push(th);
        });

        const ref = dom.firstChild;
        nodes.forEach(n => dom.insertBefore(n, ref));
    };

    function init() {
        // Не перезаписуємо урок, який уже відновлено з автозбереження
        if (!current) current = recall();
        const btn = document.getElementById('lessonTheoryBtn');
        if (btn) btn.addEventListener('click', () => window.toggleLessonPanel());

        const prevLang = window.onLanguageChanged;
        window.onLanguageChanged = function (code) {
            if (typeof prevLang === 'function') prevLang(code);
            if (panel) { refreshLabels(); if (isOpen()) render(); }
        };
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen()) closePanel(); });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
