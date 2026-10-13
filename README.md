# Учимся играя

Небольшие браузерные игры для младших школьников (1–4 класс) с совёнком Ухом.
Каждая игра — один HTML-файл без зависимостей: открывается в любом браузере, работает офлайн.

**Играть:** https://arkhamvm.github.io/kids-learning-games/

| Игра | Тема | Класс |
|---|---|---|
| [Слова-друзья](https://arkhamvm.github.io/kids-learning-games/games/sinonimy/) | Синонимы | 2 |

## Запуск локально

Просто откройте `games/<игра>/index.html` в браузере. Или поднимите сервер:

```bash
python3 -m http.server 8765
```

и откройте http://localhost:8765/

## Структура

```
index.html                  галерея игр
games/<slug>/index.html     игра (HTML + CSS + JS + SVG в одном файле)
templates/owl-mascot.html   совёнок Ух — общий шаблон маскота для всех игр (открой, чтобы посмотреть все реакции)
scripts/mascot.py           синхронизация/проверка совёнка во всех играх
scripts/touch-test.mjs      проверка игры касаниями на двух размерах телефона
CLAUDE.md                   правила для Claude Code: как делать новые игры в том же стиле
```

## Проверки

```bash
python3 scripts/mascot.py check
node scripts/touch-test.mjs games/sinonimy/
```

Совёнок: https://arkhamvm.github.io/kids-learning-games/templates/owl-mascot.html
