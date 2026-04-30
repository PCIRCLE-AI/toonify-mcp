# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Toonify MCP помогает, когда Claude Code начинает «тяжелеть» из-за слишком большого вывода.

## Чем он полезен

- JSON, CSV, YAML и ответы API становятся легче
- Длинные падения тестов и stack trace проще пропускать через одну сессию
- Привычный способ работы в Claude Code менять не нужно

## Кому стоит попробовать

- Тем, кто часто читает большой вывод инструментов
- Тем, кто регулярно отправляет logs, traces или source files в Claude Code
- Тем, кто хочет локальное и автоматическое решение

## Когда пользы меньше

- Короткий текст
- Очень маленькие файлы
- Контент, где важнее сохранить точное оформление

## Быстрая установка

```bash
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp
npm install
npm run build
npm install -g .
claude plugin marketplace add ./.claude-plugin/marketplace.json
claude plugin install toonify-mcp@pcircle-ai --scope local
claude plugin list
```

Если всё прошло нормально, `claude plugin list` должен показывать `toonify-mcp@pcircle-ai` и `enabled`.

## Быстрая проверка

```bash
toonify-mcp doctor
toonify-mcp status
```

## MCP-режим (по желанию)

```bash
claude mcp add toonify -- toonify-mcp
claude mcp list
```

## Где смотреть актуальную версию

- Основной README: [README.md](README.md)
- Традиционный китайский: [README.zh-TW.md](README.zh-TW.md)
- Публичный сайт: https://toonify.pcircle.ai/
