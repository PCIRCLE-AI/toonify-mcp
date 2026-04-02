# 🎯 Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

MCP server + Claude Code Plugin providing automatic token optimization for structured data **and source code**.
Reduces Claude API token usage by **25-66%** on JSON/CSV/YAML and **20-48%** on TypeScript/Python/Go source code through a pipeline architecture.

## What's New in v0.6.0

✨ **Pipeline Architecture + Code Compression!**
- ✅ **Pipeline engine** — modular Detector → Router → Compressor → Evaluator architecture
- ✅ **Code compression** — TypeScript (37%), Python (48%), Go (32%) savings via heuristic-based comment/whitespace removal
- ✅ **6 compression layers** — from safe (blank lines, inline comments) to aggressive (import summarization, repetitive pattern collapse)
- ✅ **Hook upgraded** — PostToolUse hook now compresses source code in addition to structured data
- ✅ Extensible design — add new formats by implementing a single `Compressor` interface
- ✅ Full backwards compatibility — all external APIs unchanged
- ✅ 196 tests (up from 157), comprehensive code review passed

## Features

- **25-66% Token Reduction** (typically ~48%) for JSON, CSV, YAML data
- **20-48% Code Compression** for TypeScript, Python, Go source code
- **Pipeline Architecture** - Extensible Detector → Compressor → Evaluator engine
- **Multilingual Support** - Accurate token counting for 15+ languages
- **Enhanced Caching** - LRU cache with TTL expiration and optional disk persistence
- **Fully Automatic** - PostToolUse hook intercepts tool results
- **Zero Configuration** - Works out of the box with sensible defaults
- **Dual Mode** - Works as Plugin (auto) or MCP Server (manual)
- **Built-in Metrics** - Track token savings locally
- **Silent Fallback** - Never breaks your workflow
- **Security Hardened** - Input size limits, path validation, safe regex, atomic writes

## Installation

### Option A: Download from GitHub (Recommended) 🌟

**Install directly from the GitHub repository (no npm publish required):**

```bash
# 1. Download the repository
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp

# 2. Install deps and build
npm install
npm run build

# 3. Install globally from local source
npm install -g .
```

### Option B: Install from pcircle.ai Marketplace (Easiest) 🌟

**One-click installation from the PCIRCLE AI marketplace:**

Browse to the [pcircle.ai marketplace](https://claudemarketplaces.com) in Claude Code and install toonify-mcp with one click. The marketplace handles everything automatically!

### Option C: Claude Code Plugin (Recommended) ⭐

**Automatic token optimization with zero manual calls:**

Prerequisite: complete Option A or Option B so the `toonify-mcp` binary is available.

```bash
# 1. Add as plugin (automatic mode)
claude plugin add toonify-mcp

# 2. Verify installation
claude plugin list
# Should show: toonify-mcp ✓
```

**That's it!** The PostToolUse hook will now automatically intercept and optimize structured data from Read, Grep, and other file tools.

### Option D: MCP Server (Manual mode)

**For explicit control or non-Claude Code MCP clients:**

Prerequisite: complete Option A or Option B so the `toonify-mcp` binary is available.

```bash
# 1. Register as MCP server
claude mcp add toonify -- toonify-mcp

# 2. Verify
claude mcp list
# Should show: toonify: toonify-mcp - ✓ Connected
```

Then call tools explicitly:
```bash
claude mcp call toonify optimize_content '{"content": "..."}'
claude mcp call toonify get_stats '{}'
```

## How It Works

### Plugin Mode (Automatic)

```
User: Read large JSON file
  ↓
Claude Code calls Read tool
  ↓
PostToolUse hook intercepts result
  ↓
Pipeline: Detect → Route → Compress → Evaluate
  ↓
JSON/CSV/YAML → TOON format (25-66% savings)
Source code → comment/whitespace removal (20-48% savings)
  ↓
Optimized content sent to Claude API ✨
```

### MCP Server Mode (Manual)

```
User: explicitly calls mcp__toonify__optimize_content
  ↓
Content converted to TOON format
  ↓
Returns optimized result
```

## Configuration

Create `~/.claude/toonify-config.json` (optional):

```json
{
  "enabled": true,
  "minTokensThreshold": 50,
  "minSavingsThreshold": 30,
  "skipToolPatterns": ["Bash", "Write", "Edit"]
}
```

### Options

- **enabled**: Enable/disable automatic optimization (default: `true`)
- **minTokensThreshold**: Minimum tokens before optimization (default: `50`)
- **minSavingsThreshold**: Minimum savings percentage required (default: `30%`)
- **skipToolPatterns**: Tools to never optimize (default: `["Bash", "Write", "Edit"]`)

### Environment Variables

```bash
export TOONIFY_ENABLED=true
export TOONIFY_MIN_TOKENS=50
export TOONIFY_MIN_SAVINGS=30
export TOONIFY_SKIP_TOOLS="Bash,Write"
export TOONIFY_SHOW_STATS=true  # Show optimization stats in output
```

## Examples

### Before Optimization (142 tokens)

```json
{
  "products": [
    {"id": 101, "name": "Laptop Pro", "price": 1299},
    {"id": 102, "name": "Magic Mouse", "price": 79}
  ]
}
```

### After Optimization (57 tokens, -60%)

```
[TOON-JSON]
products[2]{id,name,price}:
  101,Laptop Pro,1299
  102,Magic Mouse,79
```

**Automatically applied in Plugin mode - no manual calls needed!**

## Usage Tips

### When Does Auto-Optimization Trigger?

The PostToolUse hook automatically optimizes when:
- ✅ Content is valid JSON, CSV, YAML, **or source code** (TS/Py/Go)
- ✅ Content size ≥ `minTokensThreshold` (default: 50 tokens)
- ✅ Estimated savings ≥ threshold (30% for structured data, 10% for code)
- ✅ Tool is NOT in `skipToolPatterns` (e.g., not Bash/Write/Edit)

### View Optimization Stats

```bash
# In Plugin mode
claude mcp call toonify get_stats '{}'

# Or check Claude Code output for stats (if TOONIFY_SHOW_STATS=true)
```

### Cache Management

Toonify v0.5.0+ includes an enhanced LRU cache with TTL expiration:

```bash
# Get cache statistics
claude mcp call toonify get_cache_stats '{}'

# Clear all cached results
claude mcp call toonify clear_cache '{}'

# Clean up expired entries
claude mcp call toonify cleanup_expired_cache '{}'
```

**Cache benefits:**
- ✅ **50-500x faster** on cache hits (0.1ms vs 5-50ms)
- ✅ Avoids re-optimizing identical content
- ✅ Optional disk persistence for cross-session reuse
- ✅ Automatic LRU eviction when full
- ✅ TTL expiration (default: 1 hour)

See [docs/CACHE.md](docs/CACHE.md) for detailed cache documentation.

## Troubleshooting

### Hook Not Triggering

```bash
# 1. Check plugin is installed
claude plugin list | grep toonify

# 2. Check configuration
cat ~/.claude/toonify-config.json

# 3. Enable stats to see optimization attempts
export TOONIFY_SHOW_STATS=true
```

### Optimization Not Applied

- Check `minTokensThreshold` - content might be too small
- Check `minSavingsThreshold` - savings might be < 30%
- Check `skipToolPatterns` - tool might be in skip list
- Verify content is valid JSON/CSV/YAML or recognized source code

### Performance Issues

- Reduce `minTokensThreshold` to optimize more aggressively
- Increase `minSavingsThreshold` to skip marginal optimizations
- Add more tools to `skipToolPatterns` if needed

## Comparison: Plugin vs MCP Server

| Feature | Plugin Mode | MCP Server Mode |
|---------|------------|-----------------|
| **Activation** | Automatic (PostToolUse) | Manual (call tool) |
| **Compatibility** | Claude Code only | Any MCP client |
| **Configuration** | Plugin config file | MCP tools |
| **Performance** | Zero overhead | Call overhead |
| **Use Case** | Daily workflow | Explicit control |

**Recommendation**: Use Plugin mode for automatic optimization. Use MCP Server mode for explicit control or other MCP clients.

## Uninstall

### Plugin Mode
```bash
claude plugin remove toonify-mcp
rm ~/.claude/toonify-config.json
```

### MCP Server Mode
```bash
claude mcp remove toonify
```

### Package
```bash
npm uninstall -g toonify-mcp
```

## Links

- **GitHub**: https://github.com/PCIRCLE-AI/toonify-mcp
- **Issues**: https://github.com/PCIRCLE-AI/toonify-mcp/issues
- **MCP Docs**: https://code.claude.com/docs/mcp
- **TOON Format**: https://github.com/toon-format/toon

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE)

---

## Changelog

### v0.6.0 (2026-04-03)
- ✨ **Pipeline architecture** — modular Detector → Router → Compressor → Evaluator engine
- ✨ **Code compression** — heuristic-based compression for TypeScript (37%), Python (48%), Go (32%)
- ✨ **6 compression layers** — merge blank lines, remove inline/block comments, shorten imports, summarize imports, collapse repetitive patterns
- ✨ **Safety guarantees** — never removes code logic, preserves TODO/FIXME, preserves JSDoc/docstring summaries
- ✨ **Hook upgraded** — PostToolUse hook now detects and compresses source code (Layers 1-4)
- ✨ **Extensible** — add new content types by implementing `Compressor` interface and registering with pipeline
- 🔧 TokenOptimizer refactored to facade pattern — all external APIs unchanged
- 📊 196 tests (up from 157), comprehensive 16-dimension code review passed

### v0.5.0 (2026-01-21)
- ✨ **PostToolUse hook** fully implemented — auto-optimizes Read/Grep/Glob/WebFetch
- ✨ **Marketplace install** fixed — `claude plugin marketplace add` works correctly
- ✨ **TypeScript 6.0** + MCP SDK 1.29 + Jest 30 with SWC
- ✨ **Token counting accuracy** — raw tiktoken BPE, no inflated language multipliers
- ✨ **YAML detection** hardened — requires structural complexity, rejects plain text
- ✨ **CSV parser** handles quoted fields with embedded commas
- 🔒 10 security vulnerabilities fixed (yaml DoS, picomatch ReDoS, qs bypass)
- 🔒 DoS protection: 10MB input limit, safe RegExp pre-compilation
- 🔒 Path traversal protection on persistent cache paths
- 🔒 Atomic file writes prevent data corruption
- 🛡️ WASM resource cleanup on process shutdown (SIGINT/SIGTERM)
- 🛡️ Async disk I/O — no event loop blocking
- 🛡️ All async persistence errors properly handled (no unhandled rejections)
- 📊 157 tests (up from 75), all modules covered
- 📊 Benchmark-verified savings: avg 48%, median 53%, range 25-66%

### v0.3.0 (2025-12-26)
- ✨ **Multilingual token optimization** - accurate counting for 15+ languages
- ✨ Mixed-language text detection and optimization
- ✨ Comprehensive benchmark testing with real statistics
- 📊 Data-backed token savings claims (25-66% range, typically ~48%)
- ✅ 75+ tests passing, including multilingual edge cases
- 📝 Multilingual README versions

### v0.2.0 (2025-12-25)
- ✨ Added Claude Code Plugin support with PostToolUse hook
- ✨ Automatic token optimization (no manual calls needed)
- ✨ Plugin configuration system
- ✨ Dual mode: Plugin (auto) + MCP Server (manual)
- 📝 Comprehensive documentation update

### v0.1.1 (2024-12-24)
- 🐛 Bug fixes and improvements
- 📝 Documentation updates

### v0.1.0 (2024-12-24)
- 🎉 Initial release
- ✨ MCP Server implementation
- ✨ TOON format optimization
- ✨ Built-in metrics tracking
