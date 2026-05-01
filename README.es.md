# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Plugin de compresión de contexto para Claude Code. Reduce automáticamente las salidas grandes de herramientas—JSON, CSV, YAML, stack traces y logs—antes de que entren en la ventana de contexto.

Funciona como plugin de Claude Code (automático, sin configuración) o como servidor MCP (bajo demanda).

## Funciones

- Comprime respuestas grandes de JSON, CSV, YAML y APIs
- Reduce fallos de tests largos y stack traces
- Se ejecuta automáticamente en segundo plano—sin cambios en tu flujo de trabajo de Claude Code

## Limitaciones

Se omite para texto corto, archivos muy pequeños y contenido donde el formato original debe preservarse exactamente.

## Instalación

```bash
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp
npm install
npm run build
npm install -g .
toonify-mcp setup
toonify-mcp doctor
```

`toonify-mcp setup` añade el marketplace local e instala, actualiza o reactiva el plugin automáticamente.

## Verificación

```bash
toonify-mcp status
```

## Modo MCP (opcional)

```bash
toonify-mcp setup mcp
claude mcp list
```

`claude mcp list` debe mostrar `toonify: toonify-mcp - ✓ Connected`.

## Documentación

- Sitio: https://toonify.pcircle.ai/
- Benchmarks: https://toonify.pcircle.ai/benchmarks.html
- Privacidad: https://toonify.pcircle.ai/privacy.html
- Términos: https://toonify.pcircle.ai/terms.html
- [CHANGELOG.md](CHANGELOG.md)
