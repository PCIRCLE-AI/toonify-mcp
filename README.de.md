# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

![Toonify MCP — Kontext-Komprimierung für Claude Code](docs/social-preview/v3-before-after.svg)

Kontext-Komprimierungs-Plugin für Claude Code. Reduziert große Tool-Ausgaben—JSON, YAML, Stack Traces und Logs—automatisch, bevor sie in das Kontextfenster gelangen.

Funktioniert als Claude Code-Plugin (automatisch, ohne Konfiguration) oder als MCP-Server (auf Anfrage).

## Funktionen

- Komprimiert große JSON-, YAML- und API-Antworten
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

## Pipe-Filter (jede Agent-CLI)

`toonify-mcp compress` liest von stdin, komprimiert, was sich sicher komprimieren lässt (JSON/YAML → TOON, sich wiederholende Logs werden zusammengefasst; Quellcode, Fließtext und präzisionskritische Zahlen passieren unverändert), und schreibt nach stdout. Es bricht niemals eine Pipe—wenn die Komprimierung nicht greift, kommt die Eingabe Byte für Byte unverändert heraus.

```bash
curl -s https://api.example.com/users | toonify-mcp compress
```

Das funktioniert mit jeder Agent-CLI, weil die Ausgabe komprimiert wird, *bevor* sie in den Kontext des Modells gelangt. Damit ein Agent es übernimmt, fügen Sie den Agent-Anweisungen Ihres Projekts (z. B. `AGENTS.md`) eine Regel hinzu:

```markdown
When a command is likely to print large JSON/YAML or long logs,
pipe it through `toonify-mcp compress` (e.g. `curl ... | toonify-mcp compress`).
It only rewrites output it can compress losslessly; everything else passes through.
```

## OpenAI Codex CLI (auf Anfrage)

```bash
toonify-mcp setup codex
```

Registriert toonify als MCP-Server in `~/.codex/config.toml` (zuvor wird ein Backup der Datei mit Zeitstempel angelegt). Codex kann dann das Tool `optimize_content` bei Bedarf aufrufen.

Hinweis: Auf Codex ist das **auf Anfrage, nicht automatisch**—die Hooks von Codex können Tool-Ausgaben noch nicht ersetzen, wie es `updatedToolOutput` in Claude Code tut, und das Anhängen einer komprimierten Kopie würde den Kontext vergrößern statt verkleinern. Für automatische Komprimierung auf Codex nutzen Sie den Pipe-Filter oben.

## Dokumentation

- Website: https://toonify.pcircle.ai/
- Benchmarks: https://toonify.pcircle.ai/benchmarks.html
- Datenschutz: https://toonify.pcircle.ai/privacy.html
- Nutzungsbedingungen: https://toonify.pcircle.ai/terms.html
- [CHANGELOG.md](CHANGELOG.md)
- [CONTRIBUTORS.md](CONTRIBUTORS.md)
