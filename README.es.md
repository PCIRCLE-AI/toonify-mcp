# 🎯 Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Servidor MCP + Plugin de Claude Code que proporciona optimización automática de tokens para datos estructurados **y código fuente**.
Reduce el uso de tokens de la API de Claude en **25-66%** para JSON/CSV/YAML y **20-48%** para código fuente TypeScript/Python/Go mediante una arquitectura pipeline.

## Novedades en v0.6.0

✨ **¡Arquitectura pipeline + compresión de código!**
- ✅ **Motor pipeline** — arquitectura modular Detector → Router → Compressor → Evaluator
- ✅ **Compresión de código** — TypeScript (37%), Python (48%), Go (32%) mediante eliminación heurística de comentarios/espacios
- ✅ **6 capas de compresión** — fusión de líneas vacías, eliminación de comentarios inline, acortamiento de imports, resumen de imports, colapso de patrones repetitivos
- ✅ **Hook mejorado** — el hook PostToolUse ahora comprime código fuente además de datos estructurados
- ✅ Diseño extensible — añade nuevos formatos implementando la interfaz `Compressor`
- ✅ Compatibilidad total hacia atrás — todas las APIs externas sin cambios
- ✅ 196 pruebas (antes 157), revisión de código exhaustiva aprobada

## Características

- **Reducción de tokens del 25-66%** (típicamente ~48%) para datos JSON, CSV y YAML
- **Compresión de código del 20-48%** para código fuente TypeScript, Python y Go
- **Arquitectura pipeline** - Motor extensible Detector → Compressor → Evaluator
- **Soporte multilingüe** - Conteo preciso de tokens para más de 15 idiomas
- **Completamente automático** - El hook PostToolUse intercepta resultados de herramientas
- **Configuración cero** - Funciona inmediatamente con valores predeterminados sensatos
- **Modo dual** - Funciona como plugin (automático) o servidor MCP (manual)
- **Métricas integradas** - Rastrea el ahorro de tokens localmente
- **Fallback silencioso** - Nunca interrumpe tu flujo de trabajo

## Instalación

### Opción A: Descargar desde GitHub (Recomendado) 🌟

**Instalación directa desde el repositorio de GitHub (no se requiere npm publish):**

```bash
# 1. Descargar el repositorio
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp

# 2. Instalar dependencias y compilar
npm install
npm run build

# 3. Instalar globalmente desde el origen local
npm install -g .
```

### Opción B: Instalar desde Claude Marketplaces (si está disponible) 🌟

**Instalación con un clic:**

Abre [Claude Marketplaces](https://claudemarketplaces.com) en Claude Code e instala `toonify-mcp` con un clic cuando la distribución por marketplace esté disponible en tu entorno.

### Opción C: Plugin de Claude Code (Recomendado) ⭐

**Optimización automática de tokens sin llamadas manuales:**

Requisito: completa la opción A o B para que el binario `toonify-mcp` esté disponible.

```bash
# 1. Agregar como plugin (modo automático)
claude plugin add toonify-mcp

# 2. Verificar instalación
claude plugin list
# Debería mostrar: toonify-mcp ✓
```

**¡Eso es todo!** El hook PostToolUse ahora interceptará y optimizará automáticamente los datos estructurados de Read, Grep y otras herramientas de archivos.

### Opción D: Servidor MCP (modo manual)

**Para control explícito o clientes MCP que no sean Claude Code:**

Requisito: completa la opción A o B para que el binario `toonify-mcp` esté disponible.

```bash
# 1. Registrar como servidor MCP
claude mcp add toonify -- toonify-mcp

# 2. Verificar
claude mcp list
# Debería mostrar: toonify: toonify-mcp - ✓ Connected
```

Luego llamar a las herramientas explícitamente:
```bash
claude mcp call toonify optimize_content '{"content": "..."}'
claude mcp call toonify get_stats '{}'
```

## Cómo funciona

### Modo plugin (automático)

```
Usuario: Leer archivo JSON grande
  ↓
Claude Code llama a la herramienta Read
  ↓
El hook PostToolUse intercepta el resultado
  ↓
El hook detecta JSON, convierte a TOON
  ↓
Contenido optimizado enviado a la API de Claude
  ↓
Reducción de tokens del 25-66% (típicamente ~48%) lograda ✨
```

### Modo servidor MCP (manual)

```
Usuario: Llamar explícitamente a mcp__toonify__optimize_content
  ↓
El contenido se convierte a formato TOON
  ↓
Devuelve resultado optimizado
```

## Configuración

Crear `~/.claude/toonify-config.json` (opcional):

```json
{
  "enabled": true,
  "minTokensThreshold": 50,
  "minSavingsThreshold": 30,
  "skipToolPatterns": ["Bash", "Write", "Edit"]
}
```

### Opciones

- **enabled**: Habilitar/deshabilitar optimización automática (predeterminado: `true`)
- **minTokensThreshold**: Tokens mínimos antes de la optimización (predeterminado: `50`)
- **minSavingsThreshold**: Porcentaje mínimo de ahorro requerido (predeterminado: `30%`)
- **skipToolPatterns**: Herramientas que nunca optimizar (predeterminado: `["Bash", "Write", "Edit"]`)

### Variables de entorno

```bash
export TOONIFY_ENABLED=true
export TOONIFY_MIN_TOKENS=50
export TOONIFY_MIN_SAVINGS=30
export TOONIFY_SKIP_TOOLS="Bash,Write"
export TOONIFY_SHOW_STATS=true  # Mostrar estadísticas de optimización en la salida
```

## Ejemplos

### Antes de la optimización (142 tokens)

```json
{
  "products": [
    {"id": 101, "name": "Laptop Pro", "price": 1299},
    {"id": 102, "name": "Magic Mouse", "price": 79}
  ]
}
```

### Después de la optimización (57 tokens, -60%)

```
[TOON-JSON]
products[2]{id,name,price}:
  101,Laptop Pro,1299
  102,Magic Mouse,79
```

**¡Se aplica automáticamente en modo plugin - no se necesitan llamadas manuales!**

## Consejos de uso

### ¿Cuándo se activa la optimización automática?

El hook PostToolUse optimiza automáticamente cuando:
- ✅ El contenido es JSON, CSV o YAML válido
- ✅ Tamaño del contenido ≥ `minTokensThreshold` (predeterminado: 50 tokens)
- ✅ Ahorro estimado ≥ `minSavingsThreshold` (predeterminado: 30%)
- ✅ La herramienta NO está en `skipToolPatterns` (por ejemplo, no es Bash/Write/Edit)

### Ver estadísticas de optimización

```bash
# En modo plugin
claude mcp call toonify get_stats '{}'

# O verificar la salida de Claude Code para estadísticas (si TOONIFY_SHOW_STATS=true)
```

## Solución de problemas

### El hook no se activa

```bash
# 1. Verificar que el plugin esté instalado
claude plugin list | grep toonify

# 2. Verificar configuración
cat ~/.claude/toonify-config.json

# 3. Habilitar estadísticas para ver intentos de optimización
export TOONIFY_SHOW_STATS=true
```

### La optimización no se aplica

- Verificar `minTokensThreshold` - el contenido podría ser demasiado pequeño
- Verificar `minSavingsThreshold` - el ahorro podría ser < 30%
- Verificar `skipToolPatterns` - la herramienta podría estar en la lista de omisión
- Verificar que el contenido sea JSON/CSV/YAML válido

### Problemas de rendimiento

- Reducir `minTokensThreshold` para optimizar más agresivamente
- Aumentar `minSavingsThreshold` para omitir optimizaciones marginales
- Agregar más herramientas a `skipToolPatterns` si es necesario

## Comparación: Plugin vs Servidor MCP

| Característica | Modo Plugin | Modo Servidor MCP |
|----------------|------------|-------------------|
| **Activación** | Automático (PostToolUse) | Manual (llamar herramienta) |
| **Compatibilidad** | Solo Claude Code | Cualquier cliente MCP |
| **Configuración** | Archivo de configuración de plugin | Herramientas MCP |
| **Rendimiento** | Cero sobrecarga | Sobrecarga de llamada |
| **Caso de uso** | Flujo de trabajo diario | Control explícito |

**Recomendación**: Usar modo plugin para optimización automática. Usar modo servidor MCP para control explícito u otros clientes MCP.

## Desinstalación

### Modo plugin
```bash
claude plugin remove toonify-mcp
rm ~/.claude/toonify-config.json
```

### Modo servidor MCP
```bash
claude mcp remove toonify
```

### Paquete
```bash
npm uninstall -g toonify-mcp
```

## Enlaces

- **Docs**: https://toonify.pcircle.ai/
- **GitHub**: https://github.com/PCIRCLE-AI/toonify-mcp
- **Issues**: https://github.com/PCIRCLE-AI/toonify-mcp/issues
- **Documentación MCP**: https://code.claude.com/docs/mcp
- **Formato TOON**: https://github.com/toon-format/toon

## Contribuir

¡Las contribuciones son bienvenidas! Por favor, consulta [CONTRIBUTING.md](CONTRIBUTING.md) para obtener las pautas.

## Soporte

Para ayuda con la instalación, reportes de errores y vías de contacto comercial, consulta [SUPPORT.md](SUPPORT.md).

## Seguridad

Informa las vulnerabilidades de forma privada como se describe en [SECURITY.md](SECURITY.md).

## Licencia

Licencia MIT - ver [LICENSE](LICENSE)

Para el historial de versiones, consulta [CHANGELOG.md](CHANGELOG.md).
