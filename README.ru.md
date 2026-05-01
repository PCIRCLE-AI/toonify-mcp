# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Плагин сжатия контекста для Claude Code. Автоматически уменьшает большие выходные данные инструментов—JSON, CSV, YAML, трассировки стека и логи—прежде чем они попадают в контекстное окно.

Работает как плагин Claude Code (автоматически, без настройки) или как MCP-сервер (по запросу).

## Возможности

- Сжимает большие JSON, CSV, YAML и ответы API
- Сокращает длинные ошибки тестов и трассировки стека
- Работает автоматически в фоне—без изменений в рабочем процессе

## Ограничения

Пропускается для коротких текстов, очень маленьких файлов и контента, где необходимо сохранить точное исходное форматирование.

## Установка

```bash
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp
npm install
npm run build
npm install -g .
toonify-mcp setup
toonify-mcp doctor
```

`toonify-mcp setup` добавляет локальный marketplace и автоматически устанавливает, обновляет или повторно включает плагин.

## Проверка статуса

```bash
toonify-mcp status
```

## MCP-режим (по желанию)

```bash
toonify-mcp setup mcp
claude mcp list
```

`claude mcp list` должен показать `toonify: toonify-mcp - ✓ Connected`.

## Документация

- Сайт: https://toonify.pcircle.ai/
- Бенчмарки: https://toonify.pcircle.ai/benchmarks.html
- Конфиденциальность: https://toonify.pcircle.ai/privacy.html
- Условия использования: https://toonify.pcircle.ai/terms.html
- [CHANGELOG.md](CHANGELOG.md)
