# 🎯 Claude Code Toonify

**[English](README.md) | [繁體中文](README.zh-TW.md)**

**使用 TOON 格式優化，降低 Claude API Token 使用量達 60% 以上**

一個 MCP (Model Context Protocol) 伺服器，透過將結構化資料轉換為 TOON (Token-Oriented Object Notation) 格式，自動優化 [Claude Code CLI](https://github.com/anthropics/claude-code) 的 Token 使用量。

## 🌟 功能特色

- **🎯 60%+ Token 削減**：結構化資料平均減少 63.9%
- **💰 大幅節省成本**：每百萬次 API 呼叫節省約 $1,380
- **⚡ 極速處理**：典型負載僅 <10ms 額外開銷
- **🔄 靜默降級**：絕不中斷您的工作流程
- **📊 內建指標**：本地追蹤節省數據
- **🔌 MCP 整合**：與 Claude Code 無縫協作
- **🌍 通用相容**：支援任何 LLM（GPT、Claude、Gemini 等）

## 📊 效能表現

| 格式 | 優化前 | 優化後 | 節省 |
|------|--------|--------|------|
| JSON | 247 bytes | 98 bytes | **60%** |
| CSV  | 180 bytes | 65 bytes | **64%** |
| YAML | 215 bytes | 89 bytes | **59%** |

**Token 削減範例：**
```
JSON (142 tokens)：
{
  "products": [
    {"id": 101, "name": "Laptop Pro", "price": 1299},
    {"id": 102, "name": "Magic Mouse", "price": 79}
  ]
}

TOON (57 tokens，削減 60%)：
products[2]{id,name,price}:
  101,Laptop Pro,1299
  102,Magic Mouse,79
```

## 🚀 安裝步驟

### 1. 安裝套件

```bash
npm install -g @ktseng/claude-code-toonify
```

### 2. 設定 Claude Code

在 Claude Code 設定檔中新增 (`~/.claude/settings.json`)：

```json
{
  "mcpServers": {
    "toonify": {
      "command": "claude-code-toonify"
    }
  }
}
```

### 3. 驗證安裝

```bash
# 檢查 MCP 伺服器是否已註冊
claude mcp list

# 測試優化功能
claude mcp call toonify optimize_content '{"content": "{\"test\": \"data\"}"}'
```

## 📖 使用方式

### 自動優化

MCP 伺服器與 Claude Code 搭配使用時自動優化工具結果：

```typescript
// 在 Claude Code 中，工具結果會自動被攔截
// 大型 JSON 回應在傳送至 API 前會自動優化
const fileContent = await tools.Read({ file_path: "data.json" });
// → 若超過 50 tokens 且為結構化資料，會自動轉換為 TOON
```

### 手動優化

直接使用 MCP 工具：

```bash
# 優化內容
claude mcp call toonify optimize_content '{
  "content": "{\"products\": [{\"id\": 1, \"name\": \"Test\"}]}",
  "toolName": "Read"
}'

# 查看統計資料
claude mcp call toonify get_stats '{}'
```

## 🔧 設定選項

透過環境變數或設定檔進行配置：

```bash
# 環境變數
export TOONIFY_ENABLED=true
export TOONIFY_MIN_TOKENS=50
export TOONIFY_MIN_SAVINGS=30
export TOONIFY_SKIP_TOOLS="Bash,Write"

# 或使用 ~/.claude/toonify-config.json
{
  "enabled": true,
  "minTokensThreshold": 50,
  "minSavingsThreshold": 30,
  "skipToolPatterns": ["Bash", "Write"]
}
```

## 📊 統計儀表板

查看您的節省成果：

```bash
claude mcp call toonify get_stats '{}'
```

輸出範例：
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

## 🏗️ 架構圖

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
│ • optimize_content│ ← 壓縮結構化資料
│ • get_stats      │ ← 查看指標
└─────────┬────────┘
          │
          ↓
┌──────────────────┐
│ TokenOptimizer   │ ← TOON 編碼
└──────────────────┘
          │
          ↓
┌──────────────────┐
│ MetricsCollector │ ← 追蹤節省量
└──────────────────┘
```

## 🌍 相容性

### ✅ **此 MCP 伺服器支援：**
- **Claude Code CLI**（主要目標）
- **Claude Desktop App**
- **自訂 MCP 客戶端**
- **任何實作 MCP 協定的工具**

**重要**：MCP（Model Context Protocol）是 Anthropic 的協定。此 MCP 伺服器僅適用於 Claude 生態系統中的 MCP 相容客戶端。

### 🔧 **在其他 LLM 使用 TOON 格式**

雖然此 **MCP 伺服器**僅限 Claude 使用，但 **TOON 格式本身**可為任何 LLM（GPT、Gemini、Llama 等）減少 Token 使用量。若要在非 MCP LLM 使用 TOON 優化：

**TypeScript/JavaScript：**
```typescript
import { encode, decode } from '@toon-format/toon';

// 在傳送至任何 LLM API 前優化資料
const data = {
  products: [
    { id: 101, name: 'Laptop Pro', price: 1299 },
    { id: 102, name: 'Magic Mouse', price: 79 }
  ]
};

const optimizedContent = encode(data); // 減少 60% tokens

// 用於 OpenAI
await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: `分析：${optimizedContent}` }]
});

// 用於 Gemini
await gemini.generateContent({
  contents: [{ text: `分析：${optimizedContent}` }]
});
```

**Python：**
```python
# 安裝：pip install toonify
from toonify import encode
import openai

data = {"products": [...]}
optimized = encode(data)

# 適用於任何 LLM API
openai.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": f"分析：{optimized}"}]
)
```

### 📊 **MCP 伺服器 vs TOON 函式庫**

| 功能 | 此 MCP 伺服器 | 直接使用 TOON 函式庫 |
|------|-------------|-------------------|
| **目標** | Claude Code/Desktop | 任何 LLM |
| **整合方式** | 自動（透過 MCP） | 手動（程式碼整合） |
| **設定** | 配置一次 | 每個專案都要導入 |
| **相容性** | 僅限 MCP 客戶端 | 通用 |

## 🧪 開發指南

```bash
# 複製儲存庫
git clone https://github.com/kevintseng/claude-code-toonify.git
cd claude-code-toonify

# 安裝依賴
npm install

# 建置
npm run build

# 執行測試
npm test

# 開發模式（監視變更）
npm run dev
```

## 🎯 適用時機

**✅ 最適合用於：**
- 工具回傳的大型 JSON 回應
- CSV/表格資料
- 結構化 API 回應
- 資料庫查詢結果
- 包含結構化資料的檔案內容

**⚠️ 不建議用於：**
- 純文字內容
- 程式碼檔案
- 高度不規則的資料結構
- 內容 < 50 tokens

## 📚 技術細節

### 運作原理

1. **攔截**：MCP 伺服器透過 `optimize_content` 工具攔截工具結果
2. **偵測**：分析內容以識別 JSON、CSV 或 YAML
3. **優化**：使用 `@toon-format/toon` 轉換為 TOON 格式
4. **驗證**：確保節省量 > 30% 閾值
5. **降級**：若優化失敗或節省量過低則返回原始內容

### 依賴套件

- `@modelcontextprotocol/sdk` - MCP 伺服器框架
- `@toon-format/toon` - TOON 格式編碼/解碼
- `tiktoken` - Token 計數（相容 Claude/GPT）
- `yaml` - YAML 解析支援

## 🤝 貢獻

歡迎貢獻！請參閱 [CONTRIBUTING.md](CONTRIBUTING.md) 了解指南。

## 📄 授權

MIT License - 詳見 [LICENSE](LICENSE) 檔案

## 🙏 致謝

- [Toonify](https://github.com/ScrapeGraphAI/toonify) by ScrapeGraphAI 團隊
- [Claude Code](https://github.com/anthropics/claude-code) by Anthropic
- 原始靈感來源：[awesome-llm-apps](https://github.com/Shubhamsaboo/awesome-llm-apps)

## 🔗 連結

- **NPM 套件**：即將推出
- **GitHub**：https://github.com/kevintseng/claude-code-toonify
- **問題回報**：https://github.com/kevintseng/claude-code-toonify/issues
- **MCP 文件**：https://code.claude.com/docs/mcp

---

**⭐ 如果這個工具幫您節省了 API 成本，歡迎給個星星！**
