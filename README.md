# 🎯 Claude Code Toonify

**[English](README.md) | [繁體中文](README.zh-TW.md)**

**Reduce Claude API token usage by 60%+ using TOON format optimization**

An MCP (Model Context Protocol) server that transparently optimizes token usage in [Claude Code CLI](https://github.com/anthropics/claude-code) by converting structured data to TOON (Token-Oriented Object Notation) format.

## 🌟 Features

- **🎯 60%+ Token Reduction**: Average 63.9% reduction for structured data
- **💰 Significant Cost Savings**: ~$1,380 per million API calls
- **⚡ Fast**: <10ms overhead for typical payloads
- **🔄 Silent Fallback**: Never breaks your workflow
- **📊 Built-in Metrics**: Track savings locally
- **🔌 MCP Integration**: Works seamlessly with Claude Code
- **🌍 Universal Compatibility**: Works with ANY LLM (GPT, Claude, Gemini, etc.)

## 📊 Performance

| Format | Before | After | Savings |
|--------|--------|-------|---------|
| JSON   | 247 bytes | 98 bytes | **60%** |
| CSV    | 180 bytes | 65 bytes | **64%** |
| YAML   | 215 bytes | 89 bytes | **59%** |

**Token reduction example:**
```
JSON (142 tokens):
{
  "products": [
    {"id": 101, "name": "Laptop Pro", "price": 1299},
    {"id": 102, "name": "Magic Mouse", "price": 79}
  ]
}

TOON (57 tokens, 60% reduction):
products[2]{id,name,price}:
  101,Laptop Pro,1299
  102,Magic Mouse,79
```

## 🚀 Installation

### 1. Install the package

```bash
npm install -g @ktseng/claude-code-toonify
```

### 2. Configure Claude Code

Add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "toonify": {
      "command": "claude-code-toonify"
    }
  }
}
```

### 3. Verify installation

```bash
# Check if MCP server is registered
claude mcp list

# Test optimization
claude mcp call toonify optimize_content '{"content": "{\"test\": \"data\"}"}'
```

## 📖 Usage

### Automatic Optimization

The MCP server automatically optimizes tool results when used with Claude Code:

```typescript
// In Claude Code, tool results are automatically intercepted
// Large JSON responses get optimized before sending to API
const fileContent = await tools.Read({ file_path: "data.json" });
// → Automatically converted to TOON if > 50 tokens and structured
```

### Manual Optimization

Use the MCP tools directly:

```bash
# Optimize content
claude mcp call toonify optimize_content '{
  "content": "{\"products\": [{\"id\": 1, \"name\": \"Test\"}]}",
  "toolName": "Read"
}'

# Get statistics
claude mcp call toonify get_stats '{}'
```

## 🔧 Configuration

Configure via environment variables or config file:

```bash
# Environment variables
export TOONIFY_ENABLED=true
export TOONIFY_MIN_TOKENS=50
export TOONIFY_MIN_SAVINGS=30
export TOONIFY_SKIP_TOOLS="Bash,Write"

# Or via ~/.claude/toonify-config.json
{
  "enabled": true,
  "minTokensThreshold": 50,
  "minSavingsThreshold": 30,
  "skipToolPatterns": ["Bash", "Write"]
}
```

## 📊 Metrics Dashboard

View your savings:

```bash
claude mcp call toonify get_stats '{}'
```

Output:
```
📊 Token Optimization Stats
━━━━━━━━━━━━━━━━━━━━━━━━
Total Requests: 1,234
Optimized: 856 (69.4%)

Tokens Before: 1,456,789
Tokens After: 567,234
Total Savings: 889,555 (61.1%)

💰 Cost Savings (at $3/1M input tokens):
   $2.67 saved
```

## 🌍 Compatibility

### ✅ **This MCP Server Works With:**
- **Claude Code CLI** (primary target)
- **Claude Desktop App**
- **Custom MCP clients**
- **Any tool implementing MCP protocol**

**Important**: MCP (Model Context Protocol) is an Anthropic protocol. This MCP server only works with MCP-compatible clients in the Claude ecosystem.

### 🔧 **Using TOON Format with Other LLMs**

While this **MCP server** is Claude-specific, the **TOON format itself** reduces tokens for ANY LLM (GPT, Gemini, Llama, etc.). To use TOON optimization with non-MCP LLMs:

**TypeScript/JavaScript:**
```typescript
import { encode, decode } from '@toon-format/toon';

// Optimize data before sending to any LLM API
const data = {
  products: [
    { id: 101, name: 'Laptop Pro', price: 1299 },
    { id: 102, name: 'Magic Mouse', price: 79 }
  ]
};

const optimizedContent = encode(data); // 60% token reduction

// Use with OpenAI
await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: `Analyze: ${optimizedContent}` }]
});

// Use with Gemini
await gemini.generateContent({
  contents: [{ text: `Analyze: ${optimizedContent}` }]
});
```

**Python:**
```python
# Install: pip install toonify
from toonify import encode
import openai

data = {"products": [...]}
optimized = encode(data)

# Works with any LLM API
openai.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": f"Analyze: {optimized}"}]
)
```

### 📊 **MCP Server vs TOON Library**

| Feature | This MCP Server | TOON Library Direct |
|---------|----------------|---------------------|
| **Target** | Claude Code/Desktop | Any LLM |
| **Integration** | Automatic (via MCP) | Manual (code integration) |
| **Setup** | Configure once | Import in each project |
| **Compatibility** | MCP clients only | Universal |

## 🏗️ Architecture

```
┌──────────────────┐
│   Claude Code    │
│   CLI            │
└─────────┬────────┘
          │
          ↓
┌──────────────────┐
│  Toonify MCP     │
│  Server          │
├──────────────────┤
│ • optimize_content│ ← Compress structured data
│ • get_stats      │ ← View metrics
└─────────┬────────┘
          │
          ↓
┌──────────────────┐
│ TokenOptimizer   │ ← TOON encoding
└──────────────────┘
          │
          ↓
┌──────────────────┐
│ MetricsCollector │ ← Track savings
└──────────────────┘
```

## 🧪 Development

```bash
# Clone repository
git clone https://github.com/ktseng/claude-code-toonify.git
cd claude-code-toonify

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Development mode (watch)
npm run dev
```

## 🎯 When to Use

**✅ Ideal for:**
- Large JSON responses from tools
- CSV/tabular data
- Structured API responses
- Database query results
- File contents with structured data

**⚠️ Not recommended for:**
- Plain text content
- Code files
- Highly irregular data structures
- Content < 50 tokens

## 📚 Technical Details

### How It Works

1. **Interception**: MCP server intercepts tool results via `optimize_content` tool
2. **Detection**: Analyzes content to identify JSON, CSV, or YAML
3. **Optimization**: Converts to TOON format using `@scrapegraph/toonify`
4. **Validation**: Ensures savings > 30% threshold
5. **Fallback**: Returns original if optimization fails or savings too low

### Dependencies

- `@modelcontextprotocol/sdk` - MCP server framework
- `@scrapegraph/toonify` - TOON format encoder/decoder
- `tiktoken` - Token counting (Claude/GPT compatible)
- `yaml` - YAML parsing support

## 🤝 Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) file

## 🙏 Credits

- [Toonify](https://github.com/ScrapeGraphAI/toonify) by ScrapeGraphAI team
- [Claude Code](https://github.com/anthropics/claude-code) by Anthropic
- Original inspiration: [awesome-llm-apps](https://github.com/Shubhamsaboo/awesome-llm-apps)

## 🔗 Links

- **NPM Package**: Coming soon
- **GitHub**: https://github.com/ktseng/claude-code-toonify
- **Issues**: https://github.com/ktseng/claude-code-toonify/issues
- **MCP Documentation**: https://code.claude.com/docs/mcp

---

**⭐ If this tool saves you money on API costs, consider starring the repo!**
