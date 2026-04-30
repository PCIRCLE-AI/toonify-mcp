# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Toonify MCP is an MCP server and Claude Code plugin for compressing large tool output before it bloats context.

It is designed for teams that regularly send large JSON / CSV / YAML payloads, API responses, generated output, or supported source files into Claude Code and want lower context overhead without changing day-to-day workflow.

- **Structured data:** current benchmark suite yields **24.5-66.3%** savings across 12 fixtures, with **48.1% average**
- **Source code:** supports TypeScript / Python / Go / PHP compression in the pipeline
- **Best fit:** large tool output, generated output, and reviewing large source files
- **Not ideal:** short prose tasks, very small files, or content that depends heavily on original formatting
- **Docs and setup guides:** https://toonify.pcircle.ai/
- **Benchmark summary:** https://toonify.pcircle.ai/benchmarks.html

## Why Teams Try Toonify

- **Built for large output workflows** — JSON, CSV, YAML, API responses, generated output, and supported source files
- **Workflow stays the same** — Plugin mode runs automatically after tool use
- **Runs locally** — supported compression, caching, and metrics stay on your machine
- **Selective by design** — content is optimized only when estimated savings clear the configured threshold
- **Dual mode** — use Plugin mode for automatic behavior or MCP Server mode for explicit control
- **Safe fallback** — if optimization is not worth it, Toonify keeps the original content
- **Evidence-backed** — `204` tests passing locally, plus a checked-in structured-data benchmark suite

## Supported Content and Boundaries

| Content Type | Current Handling | What Stays Intact |
| --- | --- | --- |
| JSON / CSV / YAML / API responses | Converted into a more compact TOON representation | Core fields, structure, relationships, key values |
| Supported source code | TypeScript / Python / Go / PHP comments and whitespace are reduced conservatively | Syntax structure, identifiers, and known protected language constructs |
| Small files or prose-heavy text | Usually skipped because the payoff is low | Original wording and reading flow |
| Formatting-sensitive content | Not treated as a primary fit | Avoids pretending layout-dependent content should be compressed the same way |

## Practical Use Cases

- **Large API responses** — inspect JSON payloads and repeated records without dragging every raw field into the next model turn
- **CSV or generated exports** — reduce repetitive structure when the main job is understanding rows, columns, and anomalies
- **Whole source-file reads** — lighten larger TypeScript / Python / Go / PHP files before they hit context
- **Framework-heavy PHP files** — review Laravel / Symfony-style files with attributes, namespaces, and imports more efficiently

## Installation

### Default Path: Install the Plugin

```bash
# 1. Download the repository
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp

# 2. Install deps and build
npm install
npm run build

# 3. Install globally from local source
npm install -g .

# 4. Add as plugin (automatic mode)
claude plugin add toonify-mcp

# 5. Verify installation
claude plugin list
# Should show: toonify-mcp ✓
```

Plugin mode is the fastest way to try Toonify. Once installed, supported structured data and source-code results are optimized automatically after tool use.

### Advanced Path: MCP Server (Manual Mode)

**For explicit control or non-Claude Code MCP clients:**

Prerequisite: complete the default install path so the `toonify-mcp` binary is available.

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

### Marketplace Install (When Available)

Browse to [Claude Marketplaces](https://claudemarketplaces.com) in Claude Code and install `toonify-mcp` with one click when marketplace distribution is available for your environment.

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
- Tests passing locally: `204`

To reproduce locally:

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest tests/benchmarks/quick-stats.test.ts --runInBand
```

## Usage Tips

### When Does Auto-Optimization Trigger?

The PostToolUse hook automatically optimizes when:
- ✅ Content is valid JSON, CSV, YAML, **or source code** (TS/Py/Go/PHP)
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
