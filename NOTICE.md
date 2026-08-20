# Сторонній код у цьому репозиторії

Ліцензія `LICENSE` (MIT) стосується лише **власного** коду проєкту.
Нижче — усі сторонні залежності та їхні ліцензії.

| Що | Де | Ліцензія | Джерело |
|---|---|---|---|
| Blockly | `js/blockly.min.js` (vendored) | Apache License 2.0 | https://github.com/google/blockly |
| Skulpt | завантажується з CDN (`cdn.jsdelivr.net`), НЕ vendored | MIT / BSD-подібна | https://github.com/skulpt/skulpt |
| MicroPython-lib (`ssd1306.py`, `umqtt/simple.py`, `umqtt/robust.py`) | `libraries/` | MIT | https://github.com/micropython/micropython-lib — деталі й точні шляхи джерел у `libraries/README.md` |

## Що з цим робити далі
- `js/blockly.min.js` варто замінити на залежність через `package.json`
  (`npm install blockly`), а не тримати мінифікований білд у git — зараз
  немає способу дізнатись точну версію чи оновити її.
- Якщо додаватимеш нові сторонні `.py`-бібліотеки в `libraries/` — одразу
  дописуй рядок сюди й у `libraries/README.md` з посиланням на джерело
  та ліцензію (уже заведена звичка в проєкті, просто зафіксована явно).
