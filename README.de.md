# 🎯 Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

MCP-Server + Claude Code Plugin zur automatischen Token-Optimierung für strukturierte Daten **und Quellcode**.
Reduziert den Claude-API-Token-Verbrauch um **25-66%** bei JSON/CSV/YAML und **20-48%** bei TypeScript/Python/Go-Quellcode durch eine Pipeline-Architektur.

## Neu in v0.6.0

✨ **Pipeline-Architektur + Code-Komprimierung!**
- ✅ **Pipeline-Engine** — modulare Detector → Router → Compressor → Evaluator Architektur
- ✅ **Code-Komprimierung** — TypeScript (37%), Python (48%), Go (32%) Einsparungen durch heuristikbasierte Kommentar-/Whitespace-Entfernung
- ✅ **6 Komprimierungsschichten** — von sicher (Leerzeilen, Inline-Kommentare) bis aggressiv (Import-Zusammenfassung, repetitives Muster-Kollabieren)
- ✅ **Hook aufgerüstet** — PostToolUse-Hook komprimiert jetzt auch Quellcode zusätzlich zu strukturierten Daten
- ✅ Erweiterbares Design — neue Formate durch Implementierung einer einzelnen `Compressor`-Schnittstelle hinzufügen
- ✅ Vollständige Abwärtskompatibilität — alle externen APIs unverändert
- ✅ 196 Tests (zuvor 157), umfassende Code-Review bestanden

## Funktionen

- **25-66% Token-Reduktion** (typischerweise ~48%) für JSON, CSV, YAML-Daten
- **20-48% Code-Komprimierung** für TypeScript, Python, Go-Quellcode
- **Pipeline-Architektur** - Erweiterbarer Detector → Compressor → Evaluator Engine
- **Mehrsprachige Unterstützung** - Präzise Token-Zählung für über 15 Sprachen
- **Vollautomatisch** - PostToolUse-Hook fängt Tool-Ergebnisse ab
- **Keine Konfiguration nötig** - Funktioniert sofort mit sinnvollen Standardwerten
- **Dual-Modus** - Funktioniert als Plugin (automatisch) oder MCP-Server (manuell)
- **Integrierte Metriken** - Verfolgt Token-Einsparungen lokal
- **Stille Rückfall-Mechanismen** - Unterbricht niemals Ihren Workflow

## Installation

### Option A: Download von GitHub (Empfohlen) 🌟

**Direkte Installation aus dem GitHub-Repository (kein npm publish erforderlich):**

```bash
# 1. Repository herunterladen
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp

# 2. Abhängigkeiten installieren und bauen
npm install
npm run build

# 3. Lokal global installieren
npm install -g .
```

### Option B: Installation über Claude Marketplaces (falls verfügbar) 🌟

**Ein-Klick-Installation:**

Navigieren Sie in Claude Code zu [Claude Marketplaces](https://claudemarketplaces.com) und installieren Sie `toonify-mcp` mit einem Klick, sofern die Marketplace-Verteilung in Ihrer Umgebung verfügbar ist.

### Option C: Claude Code Plugin (Empfohlen) ⭐

**Automatische Token-Optimierung ohne manuelle Aufrufe:**

Voraussetzung: Option A oder B abschließen, damit das `toonify-mcp`-Binary verfügbar ist.

```bash
# 1. Als Plugin hinzufügen (automatischer Modus)
claude plugin add toonify-mcp

# 2. Installation überprüfen
claude plugin list
# Sollte anzeigen: toonify-mcp ✓
```

**Das war's!** Der PostToolUse-Hook wird nun automatisch strukturierte Daten von Read, Grep und anderen Datei-Tools abfangen und optimieren.

### Option D: MCP-Server (Manueller Modus)

**Für explizite Kontrolle oder andere MCP-Clients:**

Voraussetzung: Option A oder B abschließen, damit das `toonify-mcp`-Binary verfügbar ist.

```bash
# 1. Als MCP-Server registrieren
claude mcp add toonify -- toonify-mcp

# 2. Überprüfen
claude mcp list
# Sollte anzeigen: toonify: toonify-mcp - ✓ Connected
```

Dann Tools explizit aufrufen:
```bash
claude mcp call toonify optimize_content '{"content": "..."}'
claude mcp call toonify get_stats '{}'
```

## Funktionsweise

### Plugin-Modus (Automatisch)

```
Benutzer: Liest große JSON-Datei
  ↓
Claude Code ruft Read-Tool auf
  ↓
PostToolUse-Hook fängt Ergebnis ab
  ↓
Hook erkennt JSON, konvertiert zu TOON
  ↓
Optimierter Inhalt wird an Claude-API gesendet
  ↓
25-66% (typischerweise ~48%) Token-Reduktion erreicht ✨
```

### MCP-Server-Modus (Manuell)

```
Benutzer: ruft explizit mcp__toonify__optimize_content auf
  ↓
Inhalt wird in TOON-Format konvertiert
  ↓
Gibt optimiertes Ergebnis zurück
```

## Konfiguration

Erstellen Sie `~/.claude/toonify-config.json` (optional):

```json
{
  "enabled": true,
  "minTokensThreshold": 50,
  "minSavingsThreshold": 30,
  "skipToolPatterns": ["Bash", "Write", "Edit"]
}
```

### Optionen

- **enabled**: Automatische Optimierung aktivieren/deaktivieren (Standard: `true`)
- **minTokensThreshold**: Mindestanzahl an Token vor Optimierung (Standard: `50`)
- **minSavingsThreshold**: Erforderlicher Mindest-Einsparungsprozentsatz (Standard: `30%`)
- **skipToolPatterns**: Tools, die niemals optimiert werden (Standard: `["Bash", "Write", "Edit"]`)

### Umgebungsvariablen

```bash
export TOONIFY_ENABLED=true
export TOONIFY_MIN_TOKENS=50
export TOONIFY_MIN_SAVINGS=30
export TOONIFY_SKIP_TOOLS="Bash,Write"
export TOONIFY_SHOW_STATS=true  # Optimierungsstatistiken in Ausgabe anzeigen
```

## Beispiele

### Vor der Optimierung (142 Token)

```json
{
  "products": [
    {"id": 101, "name": "Laptop Pro", "price": 1299},
    {"id": 102, "name": "Magic Mouse", "price": 79}
  ]
}
```

### Nach der Optimierung (57 Token, -60%)

```
[TOON-JSON]
products[2]{id,name,price}:
  101,Laptop Pro,1299
  102,Magic Mouse,79
```

**Wird automatisch im Plugin-Modus angewendet - keine manuellen Aufrufe erforderlich!**

## Nutzungstipps

### Wann wird die Auto-Optimierung ausgelöst?

Der PostToolUse-Hook optimiert automatisch, wenn:
- ✅ Inhalt valides JSON, CSV oder YAML ist
- ✅ Inhaltsgröße ≥ `minTokensThreshold` (Standard: 50 Token)
- ✅ Geschätzte Einsparungen ≥ `minSavingsThreshold` (Standard: 30%)
- ✅ Tool NICHT in `skipToolPatterns` ist (z.B. nicht Bash/Write/Edit)

### Optimierungsstatistiken anzeigen

```bash
# Im Plugin-Modus
claude mcp call toonify get_stats '{}'

# Oder überprüfen Sie die Claude Code-Ausgabe für Statistiken (wenn TOONIFY_SHOW_STATS=true)
```

## Fehlerbehebung

### Hook wird nicht ausgelöst

```bash
# 1. Überprüfen, ob Plugin installiert ist
claude plugin list | grep toonify

# 2. Konfiguration überprüfen
cat ~/.claude/toonify-config.json

# 3. Statistiken aktivieren, um Optimierungsversuche zu sehen
export TOONIFY_SHOW_STATS=true
```

### Optimierung wird nicht angewendet

- Überprüfen Sie `minTokensThreshold` - Inhalt könnte zu klein sein
- Überprüfen Sie `minSavingsThreshold` - Einsparungen könnten < 30% sein
- Überprüfen Sie `skipToolPatterns` - Tool könnte in Ausschlussliste sein
- Überprüfen Sie, ob Inhalt valides JSON/CSV/YAML ist

### Leistungsprobleme

- Reduzieren Sie `minTokensThreshold` für aggressivere Optimierung
- Erhöhen Sie `minSavingsThreshold`, um marginale Optimierungen zu überspringen
- Fügen Sie bei Bedarf mehr Tools zu `skipToolPatterns` hinzu

## Vergleich: Plugin vs. MCP-Server

| Funktion | Plugin-Modus | MCP-Server-Modus |
|---------|------------|-----------------|
| **Aktivierung** | Automatisch (PostToolUse) | Manuell (Tool aufrufen) |
| **Kompatibilität** | Nur Claude Code | Jeder MCP-Client |
| **Konfiguration** | Plugin-Konfigurationsdatei | MCP-Tools |
| **Leistung** | Kein Overhead | Aufruf-Overhead |
| **Anwendungsfall** | Täglicher Workflow | Explizite Kontrolle |

**Empfehlung**: Verwenden Sie den Plugin-Modus für automatische Optimierung. Verwenden Sie den MCP-Server-Modus für explizite Kontrolle oder andere MCP-Clients.

## Deinstallation

### Plugin-Modus
```bash
claude plugin remove toonify-mcp
rm ~/.claude/toonify-config.json
```

### MCP-Server-Modus
```bash
claude mcp remove toonify
```

### Paket
```bash
npm uninstall -g toonify-mcp
```

## Links

- **Docs**: https://toonify.pcircle.ai/
- **GitHub**: https://github.com/PCIRCLE-AI/toonify-mcp
- **Issues**: https://github.com/PCIRCLE-AI/toonify-mcp/issues
- **MCP Docs**: https://code.claude.com/docs/mcp
- **TOON Format**: https://github.com/toon-format/toon

## Mitwirken

Beiträge sind willkommen! Bitte lesen Sie [CONTRIBUTING.md](CONTRIBUTING.md) für Richtlinien.

## Support

Hilfe bei Einrichtung, Fehlermeldungen und kommerziellen Kontaktwegen finden Sie in [SUPPORT.md](SUPPORT.md).

## Sicherheit

Bitte melden Sie Sicherheitslücken vertraulich wie in [SECURITY.md](SECURITY.md) beschrieben.

## Lizenz

MIT License - siehe [LICENSE](LICENSE)

Den Versionsverlauf finden Sie in [CHANGELOG.md](CHANGELOG.md).
