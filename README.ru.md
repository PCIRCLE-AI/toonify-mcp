# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Плагин сжатия контекста для Claude Code. Автоматически уменьшает большие выходные данные инструментов—JSON, YAML, трассировки стека и логи—прежде чем они попадают в контекстное окно.

Работает как плагин Claude Code (автоматически, без настройки) или как MCP-сервер (по запросу).

## Возможности

- Сжимает большие JSON, YAML и ответы API
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

## Pipe-фильтр (любой агентный CLI)

`toonify-mcp compress` читает stdin, сжимает то, что можно сжать безопасно (JSON/YAML → TOON, повторяющиеся логи сворачиваются; исходный код, обычный текст и числа, чувствительные к точности, проходят без изменений), и пишет в stdout. Он никогда не ломает конвейер (pipe)—если сжатие неприменимо, вход выходит байт в байт без изменений.

```bash
curl -s https://api.example.com/users | toonify-mcp compress
```

Это работает с любым агентным CLI, потому что вывод сжимается *до* того, как попадает в контекст модели. Чтобы агент начал этим пользоваться, добавьте правило в инструкции агента вашего проекта (например, `AGENTS.md`):

```markdown
When a command is likely to print large JSON/YAML or long logs,
pipe it through `toonify-mcp compress` (e.g. `curl ... | toonify-mcp compress`).
It only rewrites output it can compress losslessly; everything else passes through.
```

## OpenAI Codex CLI (по запросу)

```bash
toonify-mcp setup codex
```

Регистрирует toonify как MCP-сервер в `~/.codex/config.toml` (сначала создаётся резервная копия файла с меткой времени). После этого Codex может вызывать инструмент `optimize_content` по запросу.

Примечание: в Codex это работает **по запросу, а не автоматически**—хуки Codex пока не могут заменять вывод инструментов так, как это делает `updatedToolOutput` в Claude Code, а добавление сжатой копии увеличило бы контекст вместо его уменьшения. Для автоматического сжатия в Codex используйте pipe-фильтр выше.

## Документация

- Сайт: https://toonify.pcircle.ai/
- Бенчмарки: https://toonify.pcircle.ai/benchmarks.html
- Конфиденциальность: https://toonify.pcircle.ai/privacy.html
- Условия использования: https://toonify.pcircle.ai/terms.html
- [CHANGELOG.md](CHANGELOG.md)
