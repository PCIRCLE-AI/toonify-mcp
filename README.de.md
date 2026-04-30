# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Toonify MCP hilft dabei, Claude Code leicht zu halten, wenn große Ausgaben die Sitzung schwer machen.

## Wobei es hilft

- JSON, CSV, YAML und API-Antworten werden leichter
- Lange Testfehler und Stack Traces lassen sich einfacher mitziehen
- Weniger Kontextballast, ohne den eigenen Ablauf umzustellen

## Für wen es sich lohnt

- Wenn oft große Tool-Ausgaben gelesen werden
- Wenn regelmäßig Logs, Traces oder Quellcodedateien in Claude Code landen
- Wenn eine lokale, automatische Lösung gewünscht ist

## Wann es weniger bringt

- Kurzer Text
- Sehr kleine Dateien
- Inhalte, bei denen exakte Formatierung wichtiger ist

## Schnell installieren

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

Wenn alles geklappt hat, sollte `claude plugin list` `toonify-mcp@pcircle-ai` mit `enabled` anzeigen.

## Schnell prüfen

```bash
toonify-mcp doctor
toonify-mcp status
```

## MCP-Modus (optional)

```bash
claude mcp add toonify -- toonify-mcp
claude mcp list
```

## Wo die aktuelle Version steht

- Hauptdokument: [README.md](README.md)
- Traditionelles Chinesisch: [README.zh-TW.md](README.zh-TW.md)
- Öffentliche Website: https://toonify.pcircle.ai/
