# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Plugin de compresión de contexto para Claude Code. Reduce automáticamente las salidas grandes de herramientas—JSON, YAML, stack traces y logs—antes de que entren en la ventana de contexto.

Funciona como plugin de Claude Code (automático, sin configuración) o como servidor MCP (bajo demanda).

## Funciones

- Comprime respuestas grandes de JSON, YAML y APIs
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

## Filtro pipe (cualquier CLI de agente)

`toonify-mcp compress` lee de stdin, comprime lo que es seguro comprimir (JSON/YAML → TOON, logs repetitivos colapsados; el código fuente, la prosa y los números sensibles a la precisión pasan intactos) y escribe en stdout. Nunca rompe un pipe—cuando la compresión no aplica, la entrada sale byte a byte, sin cambios.

```bash
curl -s https://api.example.com/users | toonify-mcp compress
```

Esto funciona con cualquier CLI de agente, porque la salida se comprime *antes* de entrar en el contexto del modelo. Para que un agente lo adopte, añade una regla a las instrucciones de agente de tu proyecto (p. ej. `AGENTS.md`):

```markdown
When a command is likely to print large JSON/YAML or long logs,
pipe it through `toonify-mcp compress` (e.g. `curl ... | toonify-mcp compress`).
It only rewrites output it can compress losslessly; everything else passes through.
```

## OpenAI Codex CLI (bajo demanda)

```bash
toonify-mcp setup codex
```

Registra toonify como servidor MCP en `~/.codex/config.toml` (antes se crea una copia de seguridad del archivo con marca de tiempo). Codex puede entonces llamar a la herramienta `optimize_content` bajo demanda.

Nota: en Codex esto es **bajo demanda, no automático**—los hooks de Codex aún no pueden reemplazar la salida de las herramientas como lo hace `updatedToolOutput` de Claude Code, y añadir una copia comprimida haría crecer el contexto en lugar de reducirlo. Para compresión automática en Codex, usa el filtro pipe de arriba.

## Documentación

- Sitio: https://toonify.pcircle.ai/
- Benchmarks: https://toonify.pcircle.ai/benchmarks.html
- Privacidad: https://toonify.pcircle.ai/privacy.html
- Términos: https://toonify.pcircle.ai/terms.html
- [CHANGELOG.md](CHANGELOG.md)
