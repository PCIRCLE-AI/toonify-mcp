# 🎯 Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

MCP-Server + Claude Code Plugin zur automatischen Token-Optimierung für strukturierte Daten.
Reduziert den Claude-API-Token-Verbrauch um **30-65% je nach Datenstruktur** durch transparente TOON-Format-Konvertierung, mit typischen Einsparungen von **50-55%** für strukturierte Daten.

## Neu in v0.4.0

✨ **Verbessertes Caching-System!**
- ✅ LRU-Cache mit TTL-Ablauf und optionaler Festplattenpersistenz
- ✅ 50-500x Leistungsverbesserung bei Cache-Treffern (~0,1ms vs 5-50ms)
- ✅ Drei neue MCP-Tools: `clear_cache`, `get_cache_stats`, `cleanup_expired_cache`
- ✅ Automatisches Caching von Optimierungsergebnissen - vermeidet erneute Verarbeitung identischer Inhalte
- ✅ Kritische Fehlerbehebungen: Race Conditions, übermäßige Festplatten-E/A, O(n) Leistungsprobleme
- ✅ Alle 122 Tests bestehen (waren 105) - 5 Benchmark-Testfehler behoben

## Funktionen

- **30-65% Token-Reduktion** (typischerweise 50-55%) für JSON, CSV, YAML-Daten
- **Mehrsprachige Unterstützung** - Präzise Token-Zählung für über 15 Sprachen
- **Vollautomatisch** - PostToolUse-Hook fängt Tool-Ergebnisse ab
- **Keine Konfiguration nötig** - Funktioniert sofort mit sinnvollen Standardwerten
- **Dual-Modus** - Funktioniert als Plugin (automatisch) oder MCP-Server (manuell)
- **Integrierte Metriken** - Verfolgt Token-Einsparungen lokal
- **Stille Rückfall-Mechanismen** - Unterbricht niemals Ihren Workflow

## Installation

### Option A: Installation aus dem pcircle.ai Marketplace (Am einfachsten) 🌟

**Ein-Klick-Installation:**

Navigieren Sie zum [pcircle.ai Marketplace](https://claudemarketplaces.com) in Claude Code und installieren Sie toonify-mcp mit einem Klick. Der Marketplace übernimmt alles automatisch!

### Option B: Claude Code Plugin (Empfohlen) ⭐

**Automatische Token-Optimierung ohne manuelle Aufrufe:**

```bash
# 1. Global installieren
npm install -g toonify-mcp

# 2. Als Plugin hinzufügen (automatischer Modus)
claude plugin add toonify-mcp

# 3. Installation überprüfen
claude plugin list
# Sollte anzeigen: toonify-mcp ✓
```

**Das war's!** Der PostToolUse-Hook wird nun automatisch strukturierte Daten von Read, Grep und anderen Datei-Tools abfangen und optimieren.

### Option B: MCP-Server (Manueller Modus)

**Für explizite Kontrolle oder andere MCP-Clients:**

```bash
# 1. Global installieren
npm install -g toonify-mcp

# 2. Als MCP-Server registrieren
claude mcp add toonify -- toonify-mcp

# 3. Überprüfen
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
50-55% typische Token-Reduktion erreicht ✨
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

- **GitHub**: https://github.com/kevintseng/toonify-mcp
- **Issues**: https://github.com/kevintseng/toonify-mcp/issues
- **NPM**: https://www.npmjs.com/package/toonify-mcp
- **MCP Docs**: https://code.claude.com/docs/mcp
- **TOON Format**: https://github.com/toon-format/toon

## Mitwirken

Beiträge sind willkommen! Bitte lesen Sie [CONTRIBUTING.md](CONTRIBUTING.md) für Richtlinien.

## Lizenz

MIT License - siehe [LICENSE](LICENSE)

---

## Änderungsprotokoll

### v0.4.0 (2025-12-26)
- ✨ **Verbessertes Caching-System** - LRU-Cache mit TTL-Ablauf und optionaler Persistenz
- ✨ 50-500x Leistungsverbesserung bei Cache-Treffern (~0,1ms vs 5-50ms)
- ✨ Drei neue MCP-Tools für Cache-Verwaltung
- 🐛 Kritische Fehlerbehebungen: Race Conditions, übermäßige Festplatten-E/A, O(n) Leistung
- 🐛 Falsche Cache-Treffer, fehlende Validierung, unbehandelte Fehler behoben
- ✅ Alle 122 Tests bestehen (5 Benchmark-Testfehler behoben)

### v0.3.0 (2025-12-26)
- ✨ **Mehrsprachige Token-Optimierung** - präzise Zählung für über 15 Sprachen
- ✨ Sprachabhängige Token-Multiplikatoren (2x Chinesisch, 2,5x Japanisch, 3x Arabisch, etc.)
- ✨ Erkennung und Optimierung mehrsprachiger Texte
- ✨ Umfassende Benchmark-Tests mit echten Statistiken
- 📊 Datengestützte Token-Einsparungs-Angaben (30-65% Bereich, typischerweise 50-55%)
- ✅ 75+ bestandene Tests, einschließlich mehrsprachiger Randfälle
- 📝 Mehrsprachige README-Versionen

### v0.2.0 (2025-12-25)
- ✨ Claude Code Plugin-Unterstützung mit PostToolUse-Hook hinzugefügt
- ✨ Automatische Token-Optimierung (keine manuellen Aufrufe erforderlich)
- ✨ Plugin-Konfigurationssystem
- ✨ Dual-Modus: Plugin (automatisch) + MCP-Server (manuell)
- 📝 Umfassende Dokumentationsaktualisierung

### v0.1.1 (2024-12-24)
- 🐛 Fehlerbehebungen und Verbesserungen
- 📝 Dokumentationsaktualisierungen

### v0.1.0 (2024-12-24)
- 🎉 Erstveröffentlichung
- ✨ MCP-Server-Implementierung
- ✨ TOON-Format-Optimierung
- ✨ Integrierte Metrik-Verfolgung
