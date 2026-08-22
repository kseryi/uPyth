# Сторонній код у цьому репозиторії

Ліцензія `LICENSE` (MIT) стосується лише **власного** коду проєкту.
Нижче — усі сторонні залежності та їхні ліцензії.

| Що | Де | Ліцензія | Джерело |
|---|---|---|---|
| Blockly | `js/blockly.min.js` (vendored) | Apache License 2.0 | https://github.com/google/blockly |
| Skulpt 1.2.0 | `js/vendor/skulpt/` (vendored) | MIT | https://github.com/skulpt/skulpt |
| MicroPython-lib (`ssd1306.py`, `umqtt/simple.py`, `umqtt/robust.py`) | `libraries/` | MIT | https://github.com/micropython/micropython-lib — деталі й точні шляхи джерел у `libraries/README.md` |

## Відоме обмеження: Raspberry Pi Pico працює лише в Chrome/Edge

Модуль `js/extensions/pico.js` використовує **Web Serial API** для
зв'язку з платою Raspberry Pi Pico напряму з браузера. Це нестандартний
API, підтримуваний **лише в Chrome/Edge (Chromium)** — Firefox і Safari
його не реалізують і найближчим часом не планують (позиція Mozilla —
"not currently planned" з міркувань безпеки/дизайну API).

Наслідок: у школах, де встановлено Firefox (типово для деяких
навчальних дистрибутивів Linux) або на macOS/iOS із Safari, підключення
до Pico прямо з середовища uPyth **не працюватиме**, хоча решта
функціоналу (блоки, Turtle, Tkinter) — працює в будь-якому браузері.

**Реалізований підхід (не лише план):** середовище саме визначає, який
спосіб з'єднання доступний. У Chrome/Edge кнопка "Підключити" одразу працює
через Web Serial API, як і раніше. У будь-якому іншому браузері (Firefox,
Safari) панель Pico показує явне попередження і пропонує підключення
через локальний агент замість мовчазної непрацюючої кнопки.

**Що вже готово, а що ще ні:**
- готово: автовизначення підтримки Web Serial (`js/extensions/pico.js`,
  `WEB_SERIAL_SUPPORTED`), UI-попередження для непідтримуваних браузерів,
  архітектурний "стик" для агента (`PicoAgentBridge` — адреса локального
  сервера, точка підключення в UI вже перемикається на цей клас);
- ще не готово (окрема задача розвитку, заплановано на грантові кошти):
  сама Python-агент програма (`pyserial` + локальний HTTP/WebSocket-сервер)
  і її встановлювачі для Windows/Linux/macOS. Без цього `PicoAgentBridge`
  чесно повідомляє користувачу, що з'єднання поки не реалізоване, замість
  того щоб прикидатись робочим.
