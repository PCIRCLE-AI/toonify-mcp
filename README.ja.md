# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Claude Code 向けのコンテキスト圧縮プラグインです。大きなツール出力（JSON、CSV、YAML、スタックトレース、ログ）がコンテキストウィンドウに入る前に自動で縮小します。

Claude Code プラグイン（自動・設定不要）と MCP サーバー（オンデマンド）の両方として使えます。

## 機能

- 大きな JSON、CSV、YAML、API レスポンスを圧縮
- 長いテスト失敗や stack trace を縮小
- バックグラウンドで自動動作——Claude Code のワークフローを変更する必要なし

## 制限事項

短い文章、小さいファイル、元のフォーマットを厳密に保つ必要があるコンテンツはスキップされます。

## インストール

```bash
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp
npm install
npm run build
npm install -g .
toonify-mcp setup
toonify-mcp doctor
```

`toonify-mcp setup` がローカル marketplace の追加から、プラグインのインストール、更新、再有効化までまとめて処理します。

## 動作確認

```bash
toonify-mcp status
```

## MCP モード（任意）

```bash
toonify-mcp setup mcp
claude mcp list
```

`claude mcp list` に `toonify: toonify-mcp - ✓ Connected` と表示されれば完了です。

## ドキュメント

- サイト: https://toonify.pcircle.ai/
- ベンチマーク: https://toonify.pcircle.ai/benchmarks.html
- プライバシー: https://toonify.pcircle.ai/privacy.html
- 利用規約: https://toonify.pcircle.ai/terms.html
- [CHANGELOG.md](CHANGELOG.md)
