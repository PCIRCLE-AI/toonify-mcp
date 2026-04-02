# 🎯 Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Servidor MCP + Plugin de Claude Code que proporciona optimización automática de tokens para datos estructurados.
Reduce el uso de tokens de la API de Claude en **25-66% según la estructura de datos** mediante conversión transparente al formato TOON, con ahorros típicos del **~48%** para datos estructurados.

## Novedades en v0.5.0

✨ **¡Actualizaciones de SDK y tooling!**
- ✅ SDK MCP actualizado a la línea 1.25.x
- ✅ Dependencias de tokenizer y YAML actualizadas
- ✅ Migración a Jest 30 con transform ESM de TypeScript basado en SWC
- ✅ Correcciones de seguridad aplicadas vía npm audit

## Características

- **Reducción de tokens del 25-66%** (típicamente ~48%) para datos JSON, CSV y YAML
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

### Opción B: Instalar desde el marketplace pcircle.ai (Más fácil) 🌟

**Instalación con un clic:**

Navega al [marketplace pcircle.ai](https://claudemarketplaces.com) en Claude Code e instala toonify-mcp con un clic. ¡El marketplace maneja todo automáticamente!

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

- **GitHub**: https://github.com/PCIRCLE-AI/toonify-mcp
- **Issues**: https://github.com/PCIRCLE-AI/toonify-mcp/issues
- **GitHub**: https://github.com/PCIRCLE-AI/toonify-mcp
- **Documentación MCP**: https://code.claude.com/docs/mcp
- **Formato TOON**: https://github.com/toon-format/toon

## Contribuir

¡Las contribuciones son bienvenidas! Por favor, consulta [CONTRIBUTING.md](CONTRIBUTING.md) para obtener las pautas.

## Licencia

Licencia MIT - ver [LICENSE](LICENSE)

---

## Registro de cambios

### v0.5.0 (2026-01-21)
- ✨ **Actualizaciones de SDK y tooling** - SDK MCP, tokenizer y YAML actualizados
- ✨ Migración a Jest 30 con transform ESM de TypeScript basado en SWC
- 🔒 Correcciones de seguridad vía npm audit

### v0.3.0 (2025-12-26)
- ✨ **Optimización de tokens multilingüe** - conteo preciso para más de 15 idiomas
- ✨ Multiplicadores de tokens conscientes del idioma (2x chino, 2.5x japonés, 3x árabe, etc.)
- ✨ Detección y optimización de texto en idiomas mixtos
- ✨ Pruebas de referencia completas con estadísticas reales
- 📊 Afirmaciones de ahorro de tokens respaldadas por datos (rango 25-66%, típicamente ~48%)
- ✅ Más de 75 pruebas pasadas, incluidos casos extremos multilingües
- 📝 Versiones README multilingües

### v0.2.0 (2025-12-25)
- ✨ Soporte de plugin Claude Code agregado con hook PostToolUse
- ✨ Optimización automática de tokens (no se necesitan llamadas manuales)
- ✨ Sistema de configuración de plugin
- ✨ Modo dual: Plugin (automático) + Servidor MCP (manual)
- 📝 Actualización completa de la documentación

### v0.1.1 (2024-12-24)
- 🐛 Correcciones de errores y mejoras
- 📝 Actualizaciones de documentación

### v0.1.0 (2024-12-24)
- 🎉 Lanzamiento inicial
- ✨ Implementación del servidor MCP
- ✨ Optimización de formato TOON
- ✨ Seguimiento de métricas integrado
