# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Claude Code 的 context 壓縮外掛。在大型工具輸出進入 context window 之前自動縮小——支援 JSON、CSV、YAML、stack trace 與 log。

可作為 Claude Code 外掛（自動、免設定）或 MCP 伺服器（手動呼叫）使用。

## 功能

- 壓縮大型 JSON、CSV、YAML 與 API 回應
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

## 文件

- 官網：https://toonify.pcircle.ai/
- Benchmark：https://toonify.pcircle.ai/benchmarks-zh.html
- 隱私權政策：https://toonify.pcircle.ai/privacy-zh.html
- 服務條款：https://toonify.pcircle.ai/terms-zh.html
- [docs/benchmarks-zh.html](docs/benchmarks-zh.html)
- [CHANGELOG.md](CHANGELOG.md)
