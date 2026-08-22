# uPyth

Навчальне середовище для вивчення Python через блоки (Blockly) з
підтримкою Turtle-графіки, Tkinter-подібного GUI та Raspberry Pi Pico
(MicroPython). Код і робочу область можна редагувати в обидва боки —
зміна блоків оновлює текст Python, і навпаки.

## Стек

- [Blockly](https://github.com/google/blockly) — редактор блоків (vendored, `js/blockly.min.js`)
- [Skulpt](https://skulpt.org/) — виконання Python у браузері (vendored, `js/vendor/skulpt/`)
- Чистий JavaScript (ES2017+), без фреймворків і без збірки — відкривається напряму в браузері

Обидві бібліотеки (Blockly, Skulpt) — **vendored, не CDN**: середовище
працює повністю офлайн, без інтернету, одразу після завантаження файлів
проєкту. Це принципово для цільової аудиторії (шкільні комп'ютери з
нестабільним або відсутнім інтернетом).

## Швидкий старт

Збірка не потрібна. Будь-який локальний HTTP-сервер підійде
(`file://` не працює через CORS-обмеження на завантаження модулів):

```bash
python3 -m http.server 8000
# або
npx serve .
```

Відкрити `http://localhost:8000/index.htm`.

## Структура проєкту

```
index.htm              Головна сторінка, toolbox (перелік блоків)
style.css               Стилі інтерфейсу
src/core/                Логіка середовища (колишній app.js, розбитий за відповідальністю)
  generator.js            Ядро генератора Python (PY, valueToCode, statementToCode)
  blocks-turtle.js         Визначення "core"-блоків + модуль Turtle
  workspace.js              Синхронізація workspace↔код, запуск, збереження/завантаження
  ui.js                      Панелі, меню, кнопки, редактор коду
js/
  extensions.js            Реєстр модулів, що вмикаються користувачем (Tkinter, Pico)
  extensions/                Самі модулі (tkinter.js, pico.js, pico_libraries.js)
  languages.js              Реєстр мов інтерфейсу + логіка перемикання
  locales/                   Словники перекладу (uk.js, en.js)
  lessons.js                Каталог уроків/прикладів
libraries/                Реальний код MicroPython-бібліотек для Pico (див. libraries/README.md)
lessons/                  .xml-файли готових уроків
assets/icons/             Іконки
```

## Тести

Юніт-тести генератора Python (`PY[...]` у `src/core/generator.js` +
`src/core/blocks-turtle.js`) — без npm-залежностей, на вбудованому
`node:test` (Node ≥ 18):

```bash
npm test
```

Тести завантажують `generator.js`/`blocks-turtle.js` в ізольованому
`vm`-контексті з мінімальною заглушкою `Blockly`/`t()` — реальний
браузер не потрібен. Деталі підходу — у
[`tests/helpers/load-generator.js`](tests/helpers/load-generator.js).

## Лінтер

```bash
npm install   # одноразово, підтягує eslint + globals
npm run lint       # перевірка
npm run lint:fix   # авто-виправлення того, що можна виправити автоматично
```

Конфіг — [`eslint.config.js`](eslint.config.js) (flat config, ESLint ≥ 9).
Проєкт — набір класичних `<script src="...">` без модулів/бандлера,
тому `no-undef` навмисно вимкнено для `src/core/**` і `js/*.js` —
причина розписана коментарем на початку конфіг-файлу. Крос-файлові
регресії ловлять тести (`npm test`), лінтер — мертвий код, дублікати й
стиль у межах одного файлу.

## Відомі обмеження

- **Raspberry Pi Pico (модуль `js/extensions/pico.js`) працює лише в
  Chrome/Edge** — з'єднання з платою йде через Web Serial API, якого
  немає у Firefox і Safari. Решта середовища (блоки, Turtle, Tkinter)
  від браузера не залежить. Деталі й запланований шлях вирішення
  (локальний Python-агент як міст для будь-якого браузера) — у
  [`NOTICE.md`](NOTICE.md).

## Документація

- [`HOW_TO_ADD_BLOCKS.md`](HOW_TO_ADD_BLOCKS.md) — покроково, як додати новий блок
- [`CHANGELOG.md`](CHANGELOG.md) — історія змін
- [`NOTICE.md`](NOTICE.md) — ліцензії сторонніх бібліотек (Blockly, Skulpt, MicroPython-lib)
- [`libraries/README.md`](libraries/README.md) — джерела бібліотек для Pico

## Ліцензія

MIT для власного коду проєкту — див. [`LICENSE`](LICENSE). Сторонній
код (Blockly, Skulpt, MicroPython-lib) має власні ліцензії — див.
[`NOTICE.md`](NOTICE.md).
