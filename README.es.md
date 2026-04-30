# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Toonify MCP sirve para que Claude Code no se vuelva pesado cuando trabajas con salidas grandes.

## Lo que te ayuda a resolver

- JSON, CSV, YAML y respuestas de API más livianos
- Fallos de tests y stack traces largos más manejables
- Menos carga de contexto sin cambiar tu forma de trabajar

## Cuándo vale la pena probarlo

- Si lees salidas grandes de herramientas
- Si sueles meter logs, traces o archivos fuente en Claude Code
- Si quieres algo automático y local

## Cuándo aporta poco

- Texto corto
- Archivos muy pequeños
- Contenido donde el formato exacto importa más que el ahorro

## Instalación rápida

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

Si todo quedó bien, `claude plugin list` debería mostrar `toonify-mcp@pcircle-ai` con `enabled`.

## Comprobación rápida

```bash
toonify-mcp doctor
toonify-mcp status
```

## Modo MCP (opcional)

```bash
claude mcp add toonify -- toonify-mcp
claude mcp list
```

## Dónde mirar lo último

- Guía principal: [README.md](README.md)
- Versión en chino tradicional: [README.zh-TW.md](README.zh-TW.md)
- Web pública: https://toonify.pcircle.ai/
