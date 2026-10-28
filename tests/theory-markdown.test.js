// =====================================================================
// tests/theory-markdown.test.js — безпека і коректність рендера теорії
// =====================================================================
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderTheoryMarkdown: r, toEmbedUrl, isAllowedImageUrl, cdata } = require('../js/theory-markdown.js');

// ---- безпека ----

test('сирий <script> екранується і не виконується', () => {
    const html = r('<script>alert(1)</script>');
    assert.ok(!html.includes('<script'), html);
    assert.ok(html.includes('&lt;script&gt;'));
});

test('подія onerror в <img> не потрапляє в HTML', () => {
    const html = r('<img src=x onerror=alert(1)>');
    assert.ok(!/<img/i.test(html), html);
    assert.ok(html.includes('&lt;img'));
});

test('посилання javascript: не рендериться як посилання', () => {
    const html = r('[клік](javascript:alert(1))');
    assert.ok(!html.includes('href='), html);
});

test('зображення javascript: не рендериться', () => {
    const html = r('![x](javascript:alert(1))');
    assert.ok(!html.includes('<img'), html);
});

test('зображення з http:// (незахищене) відхиляється, з https:// дозволяється', () => {
    assert.ok(!r('![a](http://x.org/a.png)').includes('<img'));
    assert.ok(r('![a](https://x.org/a.png)').includes('<img src="https://x.org/a.png"'));
});

test('data:-URI картинка дозволяється', () => {
    const uri = 'data:image/png;base64,iVBORw0KGgo=';
    assert.ok(isAllowedImageUrl(uri));
    assert.ok(r(`![плюс](${uri})`).includes(`src="${uri}"`));
});

test('data:text/html не дозволяється як картинка', () => {
    assert.equal(isAllowedImageUrl('data:text/html;base64,PHNjcmlwdD4='), false);
});

// ---- розмітка ----

test('заголовки: # → h2, ## → h3, ### → h4', () => {
    assert.equal(r('# Один'), '<h2>Один</h2>');
    assert.equal(r('## Два'), '<h3>Два</h3>');
    assert.equal(r('### Три'), '<h4>Три</h4>');
});

test('жирний, курсив і код у рядку', () => {
    assert.equal(r('**a** *b* `c`'), '<p><strong>a</strong> <em>b</em> <code>c</code></p>');
});

test('вміст `коду` не отримує жирного чи курсиву', () => {
    assert.equal(r('`**x**`'), '<p><code>**x**</code></p>');
});

test('блок python: код екранується, мова в класі', () => {
    const html = r('```python\nif a < b:\n    print("<ok>")\n```');
    assert.ok(html.startsWith('<pre><code class="language-python">'), html);
    assert.ok(html.includes('if a &lt; b:'));
    assert.ok(html.includes('&quot;&lt;ok&gt;&quot;') || html.includes('"&lt;ok&gt;"'));
});

test('список з дефісів', () => {
    assert.equal(r('- раз\n- два'), '<ul><li>раз</li><li>два</li></ul>');
});

test('абзаци розділяються порожнім рядком', () => {
    assert.equal(r('перший\n\nдругий'), '<p>перший</p>\n<p>другий</p>');
});

test('посилання https рендериться з безпечними атрибутами', () => {
    const html = r('[сайт](https://example.org)');
    assert.ok(html.includes('href="https://example.org"'));
    assert.ok(html.includes('rel="noopener noreferrer"'));
});

// ---- відео ----

test('YouTube watch-посилання → вбудований nocookie-плеєр', () => {
    assert.equal(toEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    assert.equal(toEmbedUrl('https://youtu.be/dQw4w9WgXcQ'),
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
});

test('відео з чужого сайту не вбудовується', () => {
    assert.equal(toEmbedUrl('https://evil.example/watch?v=abcdefgh'), null);
    assert.ok(r('@video(https://evil.example/x)').includes('<p>'));
});

test('@video(...) з YouTube дає iframe з allowfullscreen', () => {
    const html = r('@video(https://youtu.be/dQw4w9WgXcQ)');
    assert.ok(html.includes('<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"'));
});

// ---- CDATA ----

test('cdata: "]]>" у тексті не ламає XML', () => {
    const body = 'код: a[b[0]]>c';
    const wrapped = cdata(body);
    assert.ok(wrapped.startsWith('<![CDATA[') && wrapped.endsWith(']]>'));
    const inner = wrapped.slice(9, -3).split(']]]]><![CDATA[>').join(']]>');
    assert.equal(inner, body);
});

// ---- політика зображень: SVG, PNG, JPEG ----

test('data:image/gif і data:image/webp не дозволяються (політика: SVG/PNG/JPEG)', () => {
    assert.equal(isAllowedImageUrl('data:image/gif;base64,R0lGOD=='), false);
    assert.equal(isAllowedImageUrl('data:image/webp;base64,UklGRg=='), false);
});

test('data:image/svg+xml дозволяється (переважний формат)', () => {
    assert.equal(isAllowedImageUrl('data:image/svg+xml;base64,PHN2Zy8+'), true);
});

test('data:image/jpeg дозволяється', () => {
    assert.equal(isAllowedImageUrl('data:image/jpeg;base64,/9j/4AAQ'), true);
});
