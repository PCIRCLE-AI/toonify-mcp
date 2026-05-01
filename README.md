# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Context compression plugin for Claude Code. Automatically trims large tool output—JSON, CSV, YAML, stack traces, and logs—before it enters the context window.

Works as a Claude Code plugin (automatic, zero-config) or as an MCP server (on-demand).

## Features

- Compresses large JSON, CSV, YAML, and API responses
- Reduces long test failures and stack traces
- Runs automatically in the background—no change to your Claude Code workflow required

## Limitations

Skipped for short text, very small files, and content where exact original formatting must be preserved.

## Installation

```bash
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp
npm install
npm run build
npm install -g .
toonify-mcp setup
toonify-mcp doctor
```

`toonify-mcp setup` adds the local marketplace and installs, updates, or re-enables the plugin automatically.

## Check status

```bash
toonify-mcp status
```

## MCP mode (optional)

```bash
toonify-mcp setup mcp
claude mcp list
```

`claude mcp list` should show `toonify: toonify-mcp - ✓ Connected`.

## Docs

- Site: https://toonify.pcircle.ai/
- Benchmarks: https://toonify.pcircle.ai/benchmarks.html
- Privacy: https://toonify.pcircle.ai/privacy.html
- Terms: https://toonify.pcircle.ai/terms.html
- [benchmarks.html](docs/benchmarks.html)
- [CHANGELOG.md](CHANGELOG.md)
