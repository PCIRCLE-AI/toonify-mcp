# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Plugin de compression de contexte pour Claude Code. Réduit automatiquement les grandes sorties d'outils—JSON, CSV, YAML, stack traces et logs—avant qu'elles n'entrent dans la fenêtre de contexte.

Fonctionne comme plugin Claude Code (automatique, sans configuration) ou comme serveur MCP (à la demande).

## Fonctionnalités

- Compresse les grandes réponses JSON, CSV, YAML et API
- Réduit les longs échecs de tests et les stack traces
- S'exécute automatiquement en arrière-plan—aucun changement de workflow requis

## Limitations

Ignoré pour les textes courts, les fichiers très petits et les contenus où le formatage exact doit être préservé.

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

`toonify-mcp setup` ajoute le marketplace local et installe, met à jour ou réactive le plugin automatiquement.

## Vérification

```bash
toonify-mcp status
```

## Mode MCP (optionnel)

```bash
toonify-mcp setup mcp
claude mcp list
```

`claude mcp list` doit afficher `toonify: toonify-mcp - ✓ Connected`.

## Documentation

- Site : https://toonify.pcircle.ai/
- Benchmarks : https://toonify.pcircle.ai/benchmarks.html
- Confidentialité : https://toonify.pcircle.ai/privacy.html
- Conditions : https://toonify.pcircle.ai/terms.html
- [CHANGELOG.md](CHANGELOG.md)
