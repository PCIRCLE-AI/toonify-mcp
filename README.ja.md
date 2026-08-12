# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Claude Code 向けのコンテキスト圧縮プラグインです。大きなツール出力（JSON、YAML、スタックトレース、ログ）がコンテキストウィンドウに入る前に自動で縮小します。

Claude Code プラグイン（自動・設定不要）と MCP サーバー（オンデマンド）の両方として使えます。

## 機能

- 大きな JSON、YAML、API レスポンスを圧縮
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

## パイプフィルター（任意のエージェント CLI）

`toonify-mcp compress` は stdin を読み取り、安全に圧縮できるものだけを圧縮して（JSON/YAML → TOON、繰り返しの多いログは折りたたみ。ソースコード、文章、精度が重要な数値はそのまま通過）、stdout に書き出します。パイプを壊すことはありません——圧縮が適用されない場合、入力はバイト単位でそのまま出力されます。

```bash
curl -s https://api.example.com/users | toonify-mcp compress
```

出力がモデルのコンテキストに入る*前*に圧縮されるため、どのエージェント CLI でも使えます。エージェントに使わせるには、プロジェクトのエージェント指示ファイル（例: `AGENTS.md`）にルールを追加してください:

```markdown
When a command is likely to print large JSON/YAML or long logs,
pipe it through `toonify-mcp compress` (e.g. `curl ... | toonify-mcp compress`).
It only rewrites output it can compress losslessly; everything else passes through.
```

## OpenAI Codex CLI（オンデマンド）

```bash
toonify-mcp setup codex
```

`~/.codex/config.toml` に toonify を MCP サーバーとして登録します（実行前にタイムスタンプ付きバックアップを作成します）。以降、Codex は必要に応じて `optimize_content` ツールを呼び出せます。

注意: Codex では**オンデマンドのみで、自動ではありません**——Codex のフックは Claude Code の `updatedToolOutput` のようにツール出力を置き換えることがまだできず、圧縮済みのコピーを追記するとコンテキストは縮むどころか増えてしまいます。Codex で自動圧縮したい場合は、上記のパイプフィルターを使ってください。

## ドキュメント

- サイト: https://toonify.pcircle.ai/
- ベンチマーク: https://toonify.pcircle.ai/benchmarks.html
- プライバシー: https://toonify.pcircle.ai/privacy.html
- 利用規約: https://toonify.pcircle.ai/terms.html
- [CHANGELOG.md](CHANGELOG.md)
