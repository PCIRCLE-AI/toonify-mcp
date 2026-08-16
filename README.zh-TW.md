# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

![Toonify MCP — Claude Code 的 context 壓縮工具](docs/social-preview/v3-before-after.svg)

Claude Code 的 context 壓縮外掛。在大型工具輸出進入 context window 之前自動縮小——支援 JSON、YAML、stack trace 與 log。

可作為 Claude Code 外掛（自動、免設定）或 MCP 伺服器（手動呼叫）使用。

## 功能

- 壓縮大型 JSON、YAML 與 API 回應
- 縮短長篇測試失敗與 stack trace
- 在背景自動運作，不影響原有的 Claude Code 使用方式

## 限制

以下情況不會觸發壓縮：短文字、很小的檔案、必須保留原始格式的內容。

## 安裝

```bash
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp
npm install
npm run build
npm install -g .
toonify-mcp setup
toonify-mcp doctor
```

`toonify-mcp setup` 會自動處理本地 marketplace、安裝、更新，或重新啟用外掛。

## 確認狀態

```bash
toonify-mcp status
```

## MCP 模式（選用）

```bash
toonify-mcp setup mcp
claude mcp list
```

`claude mcp list` 應該會看到 `toonify: toonify-mcp - ✓ Connected`。

## Pipe filter（任何 agent CLI 都適用）

`toonify-mcp compress` 從 stdin 讀取內容，壓縮可以安全壓縮的部分（JSON/YAML → TOON、重複的 log 摺疊起來；原始碼、一般文字、對精確度敏感的數字則原樣通過），再寫到 stdout。它絕不會弄壞 pipe——遇到不適合壓縮的輸入，會一個 byte 都不差地原樣輸出。

```bash
curl -s https://api.example.com/users | toonify-mcp compress
```

因為輸出是在進入模型的 context *之前*就已經壓縮好，所以任何 agent CLI 都適用。想讓 agent 主動採用，在專案的 agent 指令檔（例如 `AGENTS.md`）加上一條規則：

```markdown
When a command is likely to print large JSON/YAML or long logs,
pipe it through `toonify-mcp compress` (e.g. `curl ... | toonify-mcp compress`).
It only rewrites output it can compress losslessly; everything else passes through.
```

## OpenAI Codex CLI（手動呼叫）

```bash
toonify-mcp setup codex
```

這會在 `~/.codex/config.toml` 把 toonify 註冊為 MCP 伺服器（會先幫該檔案做一份帶時間戳的備份）。之後 Codex 就能視需要呼叫 `optimize_content` 工具。

注意：在 Codex 上這是**手動呼叫，不是自動**——Codex 的 hook 還做不到像 Claude Code 的 `updatedToolOutput` 那樣直接取代工具輸出，而附加一份壓縮副本只會讓 context 變大而不是變小。想在 Codex 上自動壓縮，請用上面的 pipe filter。

## 文件

- 官網：https://toonify.pcircle.ai/
- Benchmark：https://toonify.pcircle.ai/benchmarks-zh.html
- 隱私權政策：https://toonify.pcircle.ai/privacy-zh.html
- 服務條款：https://toonify.pcircle.ai/terms-zh.html
- [docs/benchmarks-zh.html](docs/benchmarks-zh.html)
- [CHANGELOG.md](CHANGELOG.md)
- [CONTRIBUTORS.md](CONTRIBUTORS.md)
