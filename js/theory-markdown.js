// =====================================================================
// theory-markdown.js — безпечний рендер теорії (Markdown-підмножина).
// =====================================================================
// Теорія зберігається в XML як Markdown: <theory lang="uk" format="md">.
// Рендер НЕ довіряє вмісту: спочатку екранує весь текст, потім дозволяє
// лише короткий набір тегів. Сирий HTML з файлу не проходить.
//
// Підтримується:
//   # / ## / ###        заголовки (h2/h3/h4)
//   **жирний**, *курсив*, `код`
//   ```python ... ```    блок коду
//   ![опис](url)         зображення (https:// або data:image/...;base64,...)
//   [текст](https://…)   посилання (лише https)
//   - пункт              список
//   @video(url)          відео (YouTube/Vimeo, перетворюється на вбудований плеєр)
//   порожній рядок       новий абзац
// =====================================================================
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.TheoryMarkdown = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {

    // Політика зображень: SVG (переважно), PNG і JPEG. GIF і WebP не дозволяємо.
    const IMG_OK = /^(https:\/\/|data:image\/(png|jpeg|jpg|svg\+xml);base64,)[A-Za-z0-9+/=._~:?#&%;,-]+$/i;
    const LINK_OK = /^https:\/\/[^\s"'<>]+$/i;

    function esc(s) {
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function isAllowedImageUrl(u) { return IMG_OK.test(u); }

    // Перетворює посилання на відео на вбудовуваний URL або повертає null.
    function toEmbedUrl(u) {
        let x;
        try { x = new URL(u); } catch (_) { return null; }
        if (x.protocol !== 'https:') return null;
        const host = x.hostname.replace(/^www\./, '');
        let id = null;
        if (host === 'youtube.com' && x.pathname === '/watch') id = x.searchParams.get('v');
        else if (host === 'youtu.be') id = x.pathname.slice(1);
        else if ((host === 'youtube.com' || host === 'youtube-nocookie.com') && x.pathname.startsWith('/embed/')) id = x.pathname.slice(7);
        if (id && /^[A-Za-z0-9_-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
        if (host === 'vimeo.com' || host === 'player.vimeo.com') {
            const m = x.pathname.match(/\/(?:video\/)?(\d+)/);
            if (m) return `https://player.vimeo.com/video/${m[1]}`;
        }
        return null;
    }

    // Рядок → HTML. Спочатку екрануємо все, потім додаємо дозволену розмітку.
    function inline(src) {
        const parts = String(src).split(/(`[^`\n]+`)/);
        return parts.map((p, i) => {
            if (i % 2 === 1) return `<code>${esc(p.slice(1, -1))}</code>`;
            let s = esc(p);
            s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) =>
                isAllowedImageUrl(url) ? `<img src="${url}" alt="${alt}">` : m);
            s = s.replace(/(?<!!)\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) =>
                LINK_OK.test(url) ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>` : m);
            s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
            s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
            return s;
        }).join('');
    }

    function renderTheoryMarkdown(md) {
        const lines = String(md == null ? '' : md).replace(/\r\n?/g, '\n').split('\n');
        const out = [];
        let para = [];
        let list = null;

        const flushPara = () => {
            if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
        };
        const flushList = () => {
            if (list) { out.push(`<ul>${list.map(li => `<li>${inline(li)}</li>`).join('')}</ul>`); list = null; }
        };
        const flush = () => { flushPara(); flushList(); };

        let i = 0;
        while (i < lines.length) {
            const line = lines[i];

            const fence = line.match(/^```\s*([A-Za-z0-9_+-]*)\s*$/);
            if (fence) {
                flush();
                const code = [];
                i++;
                while (i < lines.length && !/^```\s*$/.test(lines[i])) { code.push(lines[i]); i++; }
                i++; // закриваючий ```
                const cls = fence[1] ? ` class="language-${fence[1].toLowerCase()}"` : '';
                out.push(`<pre><code${cls}>${esc(code.join('\n'))}</code></pre>`);
                continue;
            }

            const video = line.match(/^@video\((\S+)\)\s*$/);
            if (video) {
                flush();
                const src = toEmbedUrl(video[1]);
                out.push(src
                    ? `<div class="lp-video"><iframe src="${esc(src)}" allowfullscreen></iframe></div>`
                    : `<p>${esc(line)}</p>`);
                i++;
                continue;
            }

            const h = line.match(/^(#{1,3})\s+(.*)$/);
            if (h) {
                flush();
                const lvl = h[1].length + 1;
                out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`);
                i++;
                continue;
            }

            if (/^- /.test(line)) {
                flushPara();
                (list = list || []).push(line.slice(2));
                i++;
                continue;
            }

            if (line.trim() === '') { flush(); i++; continue; }

            flushList();
            para.push(line.trim());
            i++;
        }
        flush();
        return out.join('\n');
    }

    // Текст для CDATA: якщо всередині є "]]>", розбиваємо секцію.
    function cdata(text) {
        return '<![CDATA[' + String(text == null ? '' : text).split(']]>').join(']]]]><![CDATA[>') + ']]>';
    }

    return { renderTheoryMarkdown, toEmbedUrl, isAllowedImageUrl, cdata };
});
