# 🎯 Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

> **讓 Claude Code 使用更便宜！自動幫你省下 30-65% 的費用。**

如果你用 Claude Code 處理資料檔案（像是 Excel、JSON、CSV），這個工具會**自動壓縮**這些資料，讓你少花 **一半的錢**。完全自動，不用學任何技術。

## 💡 這是什麼？

想像一下：
- 你用 Claude Code 讀取一個很大的 Excel 檔案
- 通常這會花你很多 token（就是錢）
- 安裝 Toonify 後，它會**自動**把資料壓縮
- 你的花費立刻減少 **50-55%**

**完全不用改變使用習慣**，裝好就自動運作！

## ✨ 最新版本亮點（v0.4.0）

**更快、更聰明了！**
- ⚡ 速度提升 50-500 倍（幾乎感覺不到延遲）
- 🧠 會記住處理過的資料，不重複工作
- 🔧 修復了多個效能問題，運作更穩定
- ✅ 通過 122 項嚴格測試，品質有保證

## 🌟 為什麼要用？

- 💰 **省錢** - 資料檔案處理費用減少 30-65%（平均省一半）
- 🌏 **支援中文** - 完美支援繁體中文、簡體中文及 15+ 種語言
- 🤖 **全自動** - 裝好就用，背景自動運作
- 🎯 **零學習成本** - 不用看教學，不用改程式
- 🔄 **兩種用法** - 可以全自動，也可以手動控制
- 📊 **看得到省多少** - 隨時查看幫你省了多少錢
- 🛡️ **安全可靠** - 出問題會自動退回，不影響工作

## 📦 如何安裝？

### 方法零：從 pcircle.ai 市集安裝（最簡單）🌟

**一鍵安裝，完全自動：**

在 Claude Code 中瀏覽 [pcircle.ai 市集](https://claudemarketplaces.com)，點一下就能安裝 toonify-mcp！市集會自動處理所有設定。

### 方法一：自動模式（推薦給所有人）⭐

**三個步驟，裝好就會自動省錢：**

```bash
# 步驟 1：安裝工具
npm install -g toonify-mcp

# 步驟 2：加入 Claude Code
claude plugin add toonify-mcp

# 步驟 3：確認安裝成功
claude plugin list
# 看到 toonify-mcp ✓ 就成功了！
```

**完成！** 🎉 從現在開始，每次處理資料檔案都會自動幫你省錢，完全不用做任何事。

### 方法二：手動模式（給進階用戶）

**想要自己控制何時優化？用這個方法：**

```bash
# 步驟 1：安裝工具（同上）
npm install -g toonify-mcp

# 步驟 2：註冊為手動工具
claude mcp add toonify -- toonify-mcp

# 步驟 3：檢查是否安裝成功
claude mcp list
# 看到：toonify: toonify-mcp - ✓ Connected
```

使用時需要手動執行指令：
```bash
# 手動優化資料
claude mcp call toonify optimize_content '{"content": "..."}'

# 查看省了多少錢
claude mcp call toonify get_stats '{}'
```

## 運作原理

### 外掛模式（自動）

```
用戶：讀取大型 JSON 文件
  ↓
Claude Code 調用 Read 工具
  ↓
PostToolUse hook 攔截結果
  ↓
Hook 偵測 JSON，轉換為 TOON
  ↓
優化後的內容發送到 Claude API
  ↓
達成 50-55% 典型 token 減少 ✨
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
- **minSavingsThreshold** (省多少才優化)：要省超過 30% 才優化（預設：30%）
  - 如果只能省 10%，就不優化了
- **skipToolPatterns** (不要優化的類型)：哪些類型的檔案不要優化（預設：`["Bash", "Write", "Edit"]`）
  - 像是執行指令的內容就不適合優化

### 環境變數（進階）

```bash
export TOONIFY_ENABLED=true           # 開關
export TOONIFY_MIN_TOKENS=50          # 最小檔案大小
export TOONIFY_MIN_SAVINGS=30         # 最小省錢比例
export TOONIFY_SKIP_TOOLS="Bash,Write"  # 不要優化的類型
export TOONIFY_SHOW_STATS=true        # 顯示省了多少錢
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

## 使用技巧

### 什麼時候會自動優化？

工具會自動判斷，滿足以下條件就會優化：
- ✅ 檔案類型是 JSON、CSV 或 YAML（資料檔案）
- ✅ 檔案夠大（超過 50 tokens）
- ✅ 能省超過 30%（太少就不值得優化）
- ✅ 不是指令類型（像 Bash、Write、Edit 這類不適合優化）

**總之：你讀取資料檔案，工具就會自動幫你省錢！**

### 如何查看省了多少錢？

```bash
# 方法一：用指令查看
claude mcp call toonify get_stats '{}'

# 方法二：設定自動顯示（在設定中加入 TOONIFY_SHOW_STATS=true）
# 每次優化完都會告訴你省了多少
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
- 💸 省不夠多（少於 30%）
  - 如果只能省 10%，就不划算優化
- 🚫 檔案類型不適合
  - 不是 JSON/CSV/YAML 資料檔案
  - 或者是指令類型（Bash/Write/Edit）

### 想要更積極優化？

如果想讓工具更積極優化，可以調整設定：

```json
{
  "minTokensThreshold": 20,    // 降低門檻，小檔案也優化
  "minSavingsThreshold": 10    // 降低要求，省 10% 也優化
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

- **GitHub**: https://github.com/kevintseng/toonify-mcp
- **Issues**: https://github.com/kevintseng/toonify-mcp/issues
- **NPM**: https://www.npmjs.com/package/toonify-mcp
- **MCP 文檔**: https://code.claude.com/docs/mcp
- **TOON 格式**: https://github.com/toon-format/toon

## 貢獻

歡迎貢獻！請參閱 [CONTRIBUTING.md](CONTRIBUTING.md) 獲取指南。

## 授權

MIT License - 請參閱 [LICENSE](LICENSE)

---

🇹🇼 **Crafted in Taiwan** | 台灣製造
_Where innovation meets tradition_

## 版本更新記錄

### v0.4.0（2025-12-26）- 最新版本
**更快、更聰明！**
- ⚡ 速度提升 50-500 倍（幾乎感覺不到延遲）
- 🧠 會記住處理過的資料，不重複工作
- 🔧 修復了多個效能問題，運作更穩定
- ✅ 通過 122 項嚴格測試，品質有保證

### v0.3.0（2025-12-26）
**支援更多語言！**
- 🌏 完美支援繁體中文、簡體中文、日文等 15+ 種語言
- 📊 針對不同語言做最佳化（中文省得更多）
- 📝 提供多語言說明文件

### v0.2.0（2025-12-25）
**自動模式登場！**
- 🤖 新增自動模式，裝好就能用
- 🎯 不用手動執行指令
- 🔄 提供自動和手動兩種模式

### v0.1.1（2024-12-24）
- 🐛 修復一些小問題
- 📝 改進說明文件

### v0.1.0（2024-12-24）
- 🎉 第一版發布！
