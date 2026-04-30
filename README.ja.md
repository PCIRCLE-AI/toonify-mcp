# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Toonify MCP は、大きな出力で Claude Code が重くなりがちな場面を楽にするためのツールです。

## 何が楽になるか

- JSON、CSV、YAML、API レスポンスが軽くなる
- 長いテスト失敗や stack trace を扱いやすくなる
- 普段の Claude Code の流れを変えなくていい

## まず試すとよい人

- 大きなツール出力をよく読む人
- logs、traces、ソースコードをよく Claude Code に入れる人
- ローカルで自動的に動くものがほしい人

## あまり向いていないケース

- 短い文章
- とても小さいファイル
- 元のレイアウトを厳密に保ちたい内容

## かんたんインストール

```bash
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp
npm install
npm run build
npm install -g .
claude plugin marketplace add ./.claude-plugin/marketplace.json
claude plugin install toonify-mcp@pcircle-ai --scope local
claude plugin list
```

うまく入れば、`claude plugin list` に `toonify-mcp@pcircle-ai` と `enabled` が表示されます。

## すぐ確認する

```bash
toonify-mcp doctor
toonify-mcp status
```

## MCP モード（必要なときだけ）

```bash
claude mcp add toonify -- toonify-mcp
claude mcp list
```

## 最新情報を見る場所

- メインの案内: [README.md](README.md)
- 繁體中文版: [README.zh-TW.md](README.zh-TW.md)
- 公開サイト: https://toonify.pcircle.ai/
