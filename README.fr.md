# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Toonify MCP aide Claude Code à rester fluide quand les sorties deviennent trop lourdes.

## Ce que ça apporte

- Des JSON, CSV, YAML et réponses d’API plus légers
- Des erreurs de tests et stack traces plus faciles à faire passer
- Moins de poids dans le contexte, sans changer votre routine

## Quand l’essayer

- Si vous manipulez souvent de grosses sorties d’outils
- Si vous envoyez régulièrement logs, traces ou fichiers source dans Claude Code
- Si vous voulez quelque chose de local et automatique

## Quand c’est moins utile

- Texte court
- Très petits fichiers
- Contenu où la mise en forme exacte compte davantage

## Installation rapide

```bash
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp
npm install
npm run build
npm install -g .
toonify-mcp setup
toonify-mcp doctor
```

`toonify-mcp setup` gère le marketplace local et s’occupe aussi d’installer, mettre à jour ou réactiver le plugin.

## Vérification rapide

```bash
toonify-mcp status
```

## Mode MCP (optionnel)

```bash
toonify-mcp setup mcp
claude mcp list
```

## Où voir la version la plus à jour

- Guide principal : [README.md](README.md)
- Version chinoise traditionnelle : [README.zh-TW.md](README.zh-TW.md)
- Site public : https://toonify.pcircle.ai/
