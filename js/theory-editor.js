// =====================================================================
// theory-editor.js — ALPHA: редактор теорії (Markdown) у панелі уроку.
// =====================================================================
// buildTheoryEditor(container, opts) замінює вміст container редактором.
//   opts.title, opts.body   — початкові значення;
//   opts.labels             — підписи (з локалей);
//   opts.onSave(body, title), opts.onCancel()
// Зображення: посилання https:// або файл з диска (вбудовується як data:-URI,
// до 300 КБ). Код Python: блок ```python```. Відео: лише YouTube/Vimeo.
// =====================================================================
(function () {
    // Політика: SVG — переважний формат (схеми, макети). Растр — лише PNG і JPEG,
    // до 300 КБ (фото). SVG санітайзиться перед вбудовуванням.
    const MAX_IMAGE_BYTES = 300 * 1024;
    const RASTER_TYPES = ['image/png', 'image/jpeg'];
    const SVG_TYPE = 'image/svg+xml';

    // Видаляє з SVG все, що може виконати код або витягнути дані з мережі.
    // Повертає очищений рядок або null, якщо це не валідний SVG.
    function sanitizeSvg(text) {
        const doc = new DOMParser().parseFromString(String(text), 'image/svg+xml');
        if (doc.getElementsByTagName('parsererror').length) return null;
        const root = doc.documentElement;
        if (!root || root.localName !== 'svg') return null;

        const BAD_TAGS = ['script', 'foreignobject', 'iframe', 'object', 'embed', 'audio', 'video'];
        // Корінь <svg> теж перевіряємо: querySelectorAll('*') його не включає
        [root, ...root.querySelectorAll('*')].forEach(node => {
            if (BAD_TAGS.includes(node.localName.toLowerCase())) { node.remove(); return; }
            if (node.localName === 'style' && /@import|url\s*\(/i.test(node.textContent)) { node.remove(); return; }
            Array.from(node.attributes).forEach(a => {
                const name = a.name.toLowerCase();
                const value = a.value.trim();
                if (name.startsWith('on')) node.removeAttribute(a.name);
                else if (/(^|:)href$/.test(name) && !value.startsWith('#')) node.removeAttribute(a.name);
                else if (/javascript:|data:text\/html/i.test(value)) node.removeAttribute(a.name);
            });
        });
        // Той самий перевірений корінь серіалізуємо назад (без зайвого XML-заголовка)
        return new XMLSerializer().serializeToString(root);
    }

    // UTF-8 → base64 (для data:-URI з кирилицею у SVG)
    function toBase64Utf8(text) {
        return btoa(unescape(encodeURIComponent(text)));
    }

    function el(tag, cls, text) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    }
    function button(text, onClick, cls) {
        const b = el('button', 'lp-btn te-btn' + (cls ? ' ' + cls : ''), text);
        b.type = 'button';
        b.addEventListener('click', onClick);
        return b;
    }
    // Ім'я для alt: квадратні дужки ламають Markdown-синтаксис
    function safeAlt(s) { return String(s || '').replace(/[\[\]\n]/g, ''); }

    window.buildTheoryEditor = function (container, opts) {
        const L = opts.labels || {};
        const TM = window.TheoryMarkdown;
        container.innerHTML = '';

        const wrap = el('div', 'te-wrap');
        const titleIn = el('input', 'te-title');
        titleIn.type = 'text';
        titleIn.placeholder = L.titlePh || '';
        titleIn.value = opts.title || '';

        const bar = el('div', 'te-bar');
        const row = el('div', 'te-row');
        row.hidden = true;
        const ta = el('textarea', 'te-text');
        ta.spellcheck = false;
        ta.placeholder = L.textPh || '';
        ta.value = opts.body || '';
        const preview = el('div', 'te-preview lp-body');
        preview.hidden = true;
        const msg = el('div', 'te-msg');
        const foot = el('div', 'te-foot');

        function say(text) { msg.textContent = text || ''; }
        function hideRow() { row.hidden = true; row.innerHTML = ''; ta.focus(); }

        function insertAtCursor(text) {
            const s = ta.selectionStart, e = ta.selectionEnd;
            const before = ta.value.slice(0, s);
            const needNl = before.length > 0 && !before.endsWith('\n') && /^```/.test(text);
            const chunk = (needNl ? '\n' : '') + text;
            ta.value = before + chunk + ta.value.slice(e);
            const pos = before.length + chunk.length;
            ta.focus();
            ta.setSelectionRange(pos, pos);
        }
        function wrapSelection(before, after, placeholder) {
            const s = ta.selectionStart, e = ta.selectionEnd;
            const inner = ta.value.slice(s, e) || placeholder;
            ta.value = ta.value.slice(0, s) + before + inner + after + ta.value.slice(e);
            ta.focus();
            ta.setSelectionRange(s + before.length, s + before.length + inner.length);
        }
        function prefixLine(prefix) {
            const s = ta.selectionStart;
            const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
            ta.value = ta.value.slice(0, lineStart) + prefix + ta.value.slice(lineStart);
            ta.focus();
            ta.setSelectionRange(s + prefix.length, s + prefix.length);
        }

        function input(placeholder, cls) {
            const i = el('input', cls || 'te-in');
            i.type = 'text';
            i.placeholder = placeholder || '';
            return i;
        }

        function showRow(kind) {
            row.innerHTML = '';
            row.hidden = false;
            say('');

            if (kind === 'image') {
                const url = input(L.urlPh);
                const alt = input(L.altPh);
                const hint = el('div', 'te-hint', L.imageHint || '');
                const file = el('input');
                file.type = 'file';
                file.accept = '.svg,image/svg+xml,.png,image/png,.jpg,.jpeg,image/jpeg';
                file.hidden = true;
                file.addEventListener('change', () => {
                    const f = file.files && file.files[0];
                    if (!f) return;
                    const isSvg = f.type === SVG_TYPE || /\.svg$/i.test(f.name);
                    const isRaster = RASTER_TYPES.includes(f.type);
                    if (!isSvg && !isRaster) return say(L.badType);
                    const altText = safeAlt(alt.value || f.name.replace(/\.[^.]+$/, ''));
                    if (isSvg) {
                        const reader = new FileReader();
                        reader.onload = () => {
                            const clean = sanitizeSvg(reader.result);
                            if (clean === null) return say(L.badSvg);
                            const uri = 'data:image/svg+xml;base64,' + toBase64Utf8(clean);
                            if (uri.length > MAX_IMAGE_BYTES * 4 / 3 + 64) return say(L.tooBig);
                            insertAtCursor(`![${altText}](${uri})\n`);
                            hideRow();
                        };
                        reader.readAsText(f, 'utf-8');
                        return;
                    }
                    if (f.size > MAX_IMAGE_BYTES) return say(L.tooBig);
                    const reader = new FileReader();
                    reader.onload = () => {
                        insertAtCursor(`![${altText}](${reader.result})\n`);
                        hideRow();
                    };
                    reader.readAsDataURL(f);
                });
                row.append(hint, url, alt,
                    button(L.insert, () => {
                        const u = url.value.trim();
                        if (!TM.isAllowedImageUrl(u)) return say(L.badImage);
                        insertAtCursor(`![${safeAlt(alt.value)}](${u})\n`);
                        hideRow();
                    }),
                    button(L.fromFile, () => file.click()),
                    button(L.cancel, hideRow), file);
                url.focus();
                return;
            }

            if (kind === 'video') {
                const url = input(L.videoPh);
                row.append(url,
                    button(L.insert, () => {
                        const u = url.value.trim();
                        if (!TM.toEmbedUrl(u)) return say(L.badVideo);
                        insertAtCursor(`@video(${u})\n`);
                        hideRow();
                    }),
                    button(L.cancel, hideRow));
                url.focus();
                return;
            }

            if (kind === 'python') {
                const code = el('textarea', 'te-code');
                code.spellcheck = false;
                code.placeholder = L.pythonPh || '';
                code.rows = 5;
                row.append(code,
                    button(L.insert, () => {
                        const body = code.value.replace(/\s+$/, '');
                        if (!body) return say(L.emptyCode);
                        insertAtCursor('```python\n' + body + '\n```\n');
                        hideRow();
                    }),
                    button(L.cancel, hideRow));
                code.focus();
            }
        }

        // ----- панель інструментів -----
        bar.append(
            button(L.heading, () => prefixLine('## ')),
            button(L.bold, () => wrapSelection('**', '**', 'текст')),
            button(L.italic, () => wrapSelection('*', '*', 'текст')),
            button(L.code, () => wrapSelection('`', '`', 'код')),
            button(L.list, () => prefixLine('- ')),
            button(L.image, () => showRow('image')),
            button(L.python, () => showRow('python')),
            button(L.video, () => showRow('video')),
        );

        // ----- перегляд / редагування -----
        const toggle = button(L.preview, () => {
            if (preview.hidden) {
                preview.innerHTML = TM.renderTheoryMarkdown(ta.value);
                preview.hidden = false;
                ta.hidden = true;
                toggle.textContent = L.edit;
            } else {
                preview.hidden = true;
                ta.hidden = false;
                toggle.textContent = L.preview;
                ta.focus();
            }
        });
        foot.append(
            toggle,
            button(L.cancel, () => opts.onCancel && opts.onCancel()),
            button(L.save, () => opts.onSave(ta.value, titleIn.value.trim()), 'te-primary'),
        );

        wrap.append(titleIn, bar, row, ta, preview, msg, foot);
        container.appendChild(wrap);
        ta.focus();
    };
})();
