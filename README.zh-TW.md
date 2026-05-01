# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Toonify MCP 是一個本地優先的 Claude Code 外掛與 MCP 伺服器，重點是讓大型工具輸出不要那麼拖累後續 context。

## 使用者能直接感受到什麼

- 大型 JSON、CSV、YAML、API 回應不會那麼重
- 長篇測試失敗與 stack trace 比較容易帶進同一個工作流程
- 不用改變原本 Claude Code 的使用方式

## 誰最適合先試

- 常常要看大型工具輸出的團隊
- 會把 log 輸出、stack trace、原始碼檔案丟進 Claude Code 的開發者
- 想減少 context 負擔，但不想多一個手動步驟的人

## 什麼情況幫助不大

- 純短文字
- 很小的檔案
- 必須保留原始排版的內容

## 快速安裝

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

## 怎麼快速確認有沒有正常運作

```bash
toonify-mcp status
```

`toonify-mcp status` 會用比較直白的方式顯示最近一次是被優化還是被略過。

## 進階：MCP 模式

```bash
toonify-mcp setup mcp
claude mcp list
```

`claude mcp list` 應該會看到 `toonify: toonify-mcp - ✓ Connected`。

## 公開文件

- 官網：https://toonify.pcircle.ai/
- Benchmark：https://toonify.pcircle.ai/benchmarks-zh.html
- 隱私權政策：https://toonify.pcircle.ai/privacy-zh.html
- 服務條款：https://toonify.pcircle.ai/terms-zh.html

## 最新資訊看哪裡

最新 benchmark、版本變更與網站內容請看：

- [docs/benchmarks-zh.html](docs/benchmarks-zh.html)
- [CHANGELOG.md](CHANGELOG.md)
