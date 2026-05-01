# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Kontext-Komprimierungs-Plugin für Claude Code. Reduziert große Tool-Ausgaben—JSON, CSV, YAML, Stack Traces und Logs—automatisch, bevor sie in das Kontextfenster gelangen.

Funktioniert als Claude Code-Plugin (automatisch, ohne Konfiguration) oder als MCP-Server (auf Anfrage).

## Funktionen

- Komprimiert große JSON-, CSV-, YAML- und API-Antworten
- Reduziert lange Test-Fehler und Stack Traces
- Läuft automatisch im Hintergrund—keine Änderungen am Workflow erforderlich

## Einschränkungen

Wird übersprungen bei kurzen Texten, sehr kleinen Dateien und Inhalten, bei denen das exakte Originalformat erhalten bleiben muss.

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

`toonify-mcp setup` fügt den lokalen Marketplace hinzu und installiert, aktualisiert oder reaktiviert das Plugin automatisch.

## Status prüfen

```bash
toonify-mcp status
```

## MCP-Modus (optional)

```bash
toonify-mcp setup mcp
claude mcp list
```

`claude mcp list` sollte `toonify: toonify-mcp - ✓ Connected` anzeigen.

## Dokumentation

- Website: https://toonify.pcircle.ai/
- Benchmarks: https://toonify.pcircle.ai/benchmarks.html
- Datenschutz: https://toonify.pcircle.ai/privacy.html
- Nutzungsbedingungen: https://toonify.pcircle.ai/terms.html
- [CHANGELOG.md](CHANGELOG.md)
