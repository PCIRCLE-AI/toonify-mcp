# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Toonify MCP helps Claude Code stay lighter when you work with large tool output.

## What users get

- Large JSON, CSV, YAML, and API responses stop feeling so heavy
- Long test failures and stack traces become easier to pass through a session
- You keep the same Claude Code workflow instead of learning a new one

## Who should try it

- Teams that regularly inspect big tool output
- Developers who keep feeding logs, stack traces, or source files into Claude Code
- Anyone who wants less context bloat without extra manual steps

## When it is less useful

- Short prose
- Tiny files
- Content where exact original formatting matters more than shrinking context

## Quick install

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

## How to check it quickly

```bash
toonify-mcp status
```

## Optional: MCP mode

```bash
toonify-mcp setup mcp
claude mcp list
```

`claude mcp list` should show `toonify: toonify-mcp - ✓ Connected`.

## Public docs

- Site: https://toonify.pcircle.ai/
- Benchmarks: https://toonify.pcircle.ai/benchmarks.html
- Privacy: https://toonify.pcircle.ai/privacy.html
- Terms: https://toonify.pcircle.ai/terms.html

## Latest details

For the latest benchmark snapshot, release notes, and public site:

- [benchmarks.html](docs/benchmarks.html)
- [CHANGELOG.md](CHANGELOG.md)
