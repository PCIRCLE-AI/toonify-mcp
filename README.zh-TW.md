# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Toonify MCP 是一個給 Claude Code 與 MCP 工作流程使用的本地壓縮工具，能在大型工具輸出進入上下文前，先對結構化資料與支援的原始碼做壓縮。

- **結構化資料：** 目前 benchmark 測試套件在 12 個 fixtures 上得到 **24.5-66.3%** 的節省，平均 **48.1%**
- **原始碼：** 支援 TypeScript / Python / Go / PHP 的壓縮流程
- **最適合：** 大型工具輸出、產生出的資料，以及原始碼檔案檢視
- **不一定適合：** 純文字、小檔案，或特別依賴原始排版的內容
- **文件與安裝說明：** https://toonify.pcircle.ai/
- **Benchmark 摘要：** https://toonify.pcircle.ai/benchmarks-zh.html

## 為什麼團隊會試 Toonify

- **就是為了大型輸出工作流程** — JSON、CSV、YAML、API 回應、產生出的記錄資料，以及支援的原始碼
- **工作流程不用改** — 外掛模式會在工具執行後自動運作
- **本地執行** — 支援的壓縮、快取與統計都留在你的電腦上
- **值得時才壓縮** — 只有當預估節省超過門檻時才會動作
- **雙模式** — 外掛模式適合日常使用，MCP Server 適合需要明確控制的情境
- **安全回退** — 如果優化不值得，Toonify 會保留原始內容
- **有驗證依據** — 本地 `204` 項測試通過，並有已提交的結構化資料 benchmark 測試套件

## 支援內容與使用邊界

| 內容類型 | 目前處理方式 | 保留的重點 |
| --- | --- | --- |
| JSON / CSV / YAML / API 回應 | 轉成較緊湊的 TOON 表示法 | 主要欄位、資料結構、關聯與核心值 |
| 支援的原始碼 | 保守地精簡 TypeScript / Python / Go / PHP 的註解與空白 | 語法結構、識別符與已知需保護的語言特性 |
| 小檔案或以敘述為主的文字 | 通常略過，因為收益有限 | 原始文字內容與閱讀節奏 |
| 高度依賴排版的內容 | 不把它視為主要適用情境 | 避免假裝所有依賴版面的內容都該被同樣壓縮 |

## 實際使用場景

- **大型 API 回應** — 檢視 JSON payload 與重複 records 時，不必每次都把原始欄位完整帶進下一輪
- **CSV 或匯出資料** — 當真正要看的，是資料列、欄位與異常點，而不是重複結構本身
- **整份原始碼檔案檢視** — 在較大的 TypeScript / Python / Go / PHP 檔案進入上下文前先減輕重量
- **框架導向的 PHP 檔案** — 更有效率地檢視帶有 attribute、namespace、imports 的 Laravel / Symfony 類型檔案

## 如何安裝

### 預設路徑：安裝外掛

```bash
# 1. 下載專案
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp

# 2. 安裝依賴並建置
npm install
npm run build

# 3. 從本機安裝
npm install -g .

# 4. 加入 Claude Code 外掛
claude plugin add toonify-mcp

# 5. 確認安裝成功
claude plugin list
# 看到 toonify-mcp ✓ 就成功了！
```

外掛模式是最快感受到 Toonify 的方式。裝好後，支援的結構化資料與原始碼結果會在工具執行後自動壓縮。

### 進階路徑：MCP Server 模式

**適合想自己控制何時優化，或要接到其他 MCP 客戶端的情境。**

前置條件：先完成預設安裝路徑，確保 `toonify-mcp` 已可使用。

```bash
# 1. 註冊為 MCP 工具
claude mcp add toonify -- toonify-mcp

# 2. 檢查是否安裝成功
claude mcp list
# 看到：toonify: toonify-mcp - ✓ Connected
```

使用時可手動執行：
```bash
claude mcp call toonify optimize_content '{"content": "..."}'
claude mcp call toonify get_stats '{}'
```

### Claude Marketplaces（若可用）

如果你的環境已支援 marketplace 發布，也可以在 Claude Code 內透過 [Claude Marketplaces](https://claudemarketplaces.com) 安裝 `toonify-mcp`。

## 運作原理

### 外掛模式（自動）

```
用戶：讀取大型 JSON 文件
  ↓
Claude Code 調用 Read 工具
  ↓
PostToolUse hook 攔截結果
  ↓
Pipeline：Detect → Route → Compress → Evaluate
  ↓
JSON/CSV/YAML → TOON 格式
原始碼 → 註解與空白精簡
  ↓
優化後的內容送進後續工作流程 ✨
```

### MCP 伺服器模式（手動）

```
用戶：明確調用 mcp__toonify__optimize_content
  ↓
內容轉換為 TOON 格式
  ↓
返回優化後的結果
```

## 進階設定（可選，不設定也能用）

**大部分人不需要調整設定，預設值就很好用了！**

如果你想微調，可以創建設定檔 `~/.claude/toonify-config.json`：

```json
{
  "enabled": true,
  "minTokensThreshold": 50,
  "minSavingsThreshold": 30,
  "skipToolPatterns": ["Bash", "Write", "Edit"]
}
```

### 設定選項說明

- **enabled** (開關)：要不要自動優化（預設：開啟）
- **minTokensThreshold** (最小檔案大小)：檔案要多大才優化（預設：50 tokens）
  - 太小的檔案優化效果不明顯，所以會跳過
- **minSavingsThreshold** (最小節省門檻)：要省超過 30% 才優化（預設：30%）
  - 如果預估節省太少，就不優化
- **skipToolPatterns** (不要優化的類型)：哪些類型的檔案不要優化（預設：`["Bash", "Write", "Edit"]`）
  - 像是執行指令的內容就不適合優化

### 環境變數（進階）

```bash
export TOONIFY_ENABLED=true           # 開關
export TOONIFY_MIN_TOKENS=50          # 最小檔案大小
export TOONIFY_MIN_SAVINGS=30         # 最小節省門檻
export TOONIFY_SKIP_TOOLS="Bash,Write"  # 不要優化的類型
export TOONIFY_SHOW_STATS=true        # 顯示優化統計
```

## 範例

### 優化前（142 tokens）

```json
{
  "products": [
    {"id": 101, "name": "Laptop Pro", "price": 1299},
    {"id": 102, "name": "Magic Mouse", "price": 79}
  ]
}
```

### 優化後（57 tokens，-60%）

```
[TOON-JSON]
products[2]{id,name,price}:
  101,Laptop Pro,1299
  102,Magic Mouse,79
```

**在外掛模式下自動應用 - 無需手動調用！**

## Benchmark 摘要

目前結構化資料 benchmark 測試套件：[`tests/benchmarks/quick-stats.test.ts`](tests/benchmarks/quick-stats.test.ts)

- 測試案例：`12`
- 平均節省：`48.1%`
- 範圍：`24.5-66.3%`
- 本地測試通過：`204`

本機重跑方式：

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest tests/benchmarks/quick-stats.test.ts --runInBand
```

## 使用技巧

### 什麼時候會自動優化？

工具會自動判斷，滿足以下條件就會優化：
- ✅ 檔案類型是 JSON、CSV 或 YAML（資料檔案）或程式碼（TS/Py/Go/PHP）
- ✅ 檔案夠大（超過 50 tokens）
- ✅ 能省超過 30%（太少就不值得優化）
- ✅ 不是指令類型（像 Bash、Write、Edit 這類不適合優化）

**總之：你讀取大型資料檔案或支援的原始碼時，工具會自動判斷是否值得壓縮。**

### 如何查看優化統計？

```bash
# 方法一：用指令查看
claude mcp call toonify get_stats '{}'

# 方法二：設定自動顯示（在設定中加入 TOONIFY_SHOW_STATS=true）
# 每次優化完都會顯示統計資訊
```

## 遇到問題怎麼辦？

### 工具好像沒在運作？

**檢查步驟：**

```bash
# 1. 確認工具有安裝
claude plugin list | grep toonify
# 應該要看到 toonify-mcp ✓

# 2. 檢查設定檔（如果有改過）
cat ~/.claude/toonify-config.json

# 3. 開啟顯示功能，看看是否有在優化
export TOONIFY_SHOW_STATS=true
```

### 為什麼沒有優化我的檔案？

**可能原因：**

- 📄 檔案太小（少於 50 tokens）
  - 小檔案優化效果不明顯，所以會跳過
- 💸 預估節省不足（少於 30%）
  - 如果預估節省太少，就不值得優化
- 🚫 檔案類型不適合
  - 不是 JSON/CSV/YAML 資料檔案
  - 或者是指令類型（Bash/Write/Edit）

### 想要更積極優化？

如果想讓工具更積極優化，可以調整設定：

```json
{
  "minTokensThreshold": 20,    // 降低門檻，小檔案也優化
  "minSavingsThreshold": 10    // 降低要求，節省 10% 也優化
}
```

**注意：** 太積極可能優化一些不該優化的內容，建議保持預設值。

## 兩種模式的差別

| 比較項目 | 方法一：自動模式 | 方法二：手動模式 |
|---------|-----------------|-----------------|
| **操作方式** | 完全自動，不用管 | 需要自己執行指令 |
| **適合對象** | 一般用戶（推薦） | 進階用戶或特殊需求 |
| **使用限制** | 只能用在 Claude Code | 任何支援 MCP 的工具都能用 |
| **速度** | 最快（背景自動運作） | 需要手動執行 |
| **適合情境** | 日常使用 | 想要自己控制何時優化 |

**我該選哪個？**
- 🙋 一般用戶：選**方法一（自動模式）**，裝好就不用管了
- 🔧 進階用戶：如果想要精確控制，選**方法二（手動模式）**
- 💡 不確定：選**方法一**就對了！

## 不想用了怎麼移除？

### 方法一（自動模式）移除方式
```bash
# 步驟 1：從 Claude Code 移除
claude plugin remove toonify-mcp

# 步驟 2：刪除設定檔（如果有的話）
rm ~/.claude/toonify-config.json
```

### 方法二（手動模式）移除方式
```bash
claude mcp remove toonify
```

### 完全移除（包含程式本身）
```bash
npm uninstall -g toonify-mcp
```

**就這樣！移除很簡單。**

## 連結

- **文件站**: https://toonify.pcircle.ai/
- **GitHub**: https://github.com/PCIRCLE-AI/toonify-mcp
- **Issues**: https://github.com/PCIRCLE-AI/toonify-mcp/issues
- **MCP 文檔**: https://code.claude.com/docs/mcp
- **TOON 格式**: https://github.com/toon-format/toon

## 貢獻

歡迎貢獻！請參閱 [CONTRIBUTING.md](CONTRIBUTING.md) 獲取指南。

## 支援

若需要安裝協助、回報問題或查看商業聯絡方式，請參閱 [SUPPORT.md](SUPPORT.md)。

## 安全性回報

若發現安全性問題，請依照 [SECURITY.md](SECURITY.md) 的方式私下回報。

## 授權

MIT License - 請參閱 [LICENSE](LICENSE)

完整版本歷史請看 [CHANGELOG.md](CHANGELOG.md)。
