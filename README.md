# 🎯 Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Toonify MCP is an MCP server and Claude Code plugin for automatic token optimization in structured-data and source-code workflows.

It is designed for teams that regularly send large JSON / CSV / YAML payloads or TypeScript / Python / Go / PHP source files into model context and want lower token usage without changing day-to-day workflow.

- **Structured data:** current benchmark suite yields **24.5-66.3%** savings across 12 fixtures, with **48.1% average**
- **Source code:** supports TypeScript / Python / Go / PHP compression in the pipeline
- **Docs and setup guides:** https://toonify.pcircle.ai/
- **Benchmark summary:** https://toonify.pcircle.ai/benchmarks.html

## What's New in v0.6.0

✨ **Pipeline Architecture + Code Compression!**
- ✅ **Pipeline engine** — modular Detector → Router → Compressor → Evaluator architecture
- ✅ **Code compression** — supports TypeScript, Python, Go, and PHP via heuristic comment/whitespace removal
- ✅ **6 compression layers** — from safe (blank lines, inline comments) to aggressive (import summarization, repetitive pattern collapse)
- ✅ **Hook upgraded** — PostToolUse hook now compresses source code in addition to structured data
- ✅ Extensible design — add new formats by implementing a single `Compressor` interface
- ✅ Full backwards compatibility — all external APIs unchanged
- ✅ 196 tests (up from 157), comprehensive code review passed

## Features

- **24.5-66.3% structured-data benchmark range** across the current 12-fixture suite
- **Code compression support** for TypeScript, Python, Go, and PHP source code
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

### Option B: Install from Claude Marketplaces (if available) 🌟

**One-click installation through Claude Marketplaces:**

Browse to [Claude Marketplaces](https://claudemarketplaces.com) in Claude Code and install `toonify-mcp` with one click when marketplace distribution is available for your environment.

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
JSON/CSV/YAML → TOON format
Source code → comment/whitespace removal
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

## Benchmark Snapshot

Current structured-data benchmark suite: [`tests/benchmarks/quick-stats.test.ts`](tests/benchmarks/quick-stats.test.ts)

- Fixtures: `12`
- Average savings: `48.1%`
- Range: `24.5-66.3%`

To reproduce locally:

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest tests/benchmarks/quick-stats.test.ts --runInBand
```

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

- **Docs**: https://toonify.pcircle.ai/
- **GitHub**: https://github.com/PCIRCLE-AI/toonify-mcp
- **Issues**: https://github.com/PCIRCLE-AI/toonify-mcp/issues
- **MCP Docs**: https://code.claude.com/docs/mcp
- **TOON Format**: https://github.com/toon-format/toon

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Support

For setup help, bug reports, and commercial contact paths, see [SUPPORT.md](SUPPORT.md).

## Security

Please report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## License

MIT License - see [LICENSE](LICENSE)

For release history, see [CHANGELOG.md](CHANGELOG.md).
