# 🎯 Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

MCP サーバー + Claude Code プラグインによる構造化データの自動トークン最適化。
透過的な TOON フォーマット変換により、**データ構造に応じて Claude API トークン使用量を 30-65% 削減**し、構造化データでは一般的に **50-55%** の節約を実現します。

## v0.4.0 の新機能

✨ **強化されたキャッシングシステム！**
- ✅ TTL 有効期限とオプションのディスク永続化を備えた LRU キャッシュ
- ✅ キャッシュヒット時のパフォーマンスが 50-500 倍向上（約 0.1ms vs 5-50ms）
- ✅ 3 つの新しい MCP ツール：`clear_cache`、`get_cache_stats`、`cleanup_expired_cache`
- ✅ 自動最適化結果キャッシング - 同一コンテンツの再処理を回避
- ✅ 重大なバグ修正：競合状態、過剰なディスク I/O、O(n) パフォーマンス問題
- ✅ 全 122 テスト合格（以前は 105）- 5 つのベンチマークテスト失敗を修正

## 機能

- **30-65% のトークン削減**（通常 50-55%）- JSON、CSV、YAML データに対応
- **多言語サポート** - 15 以上の言語の正確なトークンカウント
- **完全自動** - PostToolUse フックがツール結果を傍受
- **設定不要** - 賢明なデフォルト設定で開箱即用
- **デュアルモード** - プラグイン（自動）または MCP サーバー（手動）として動作
- **組み込みメトリクス** - トークン節約をローカルで追跡
- **サイレントフォールバック** - ワークフローを中断しません

## インストール

### オプション A：pcircle.ai マーケットプレイスからインストール（最も簡単）🌟

**ワンクリックインストール：**

Claude Code で [pcircle.ai マーケットプレイス](https://claudemarketplaces.com) を開き、toonify-mcp をワンクリックでインストール。マーケットプレイスがすべて自動的に処理します！

### オプション B：Claude Code プラグイン（推奨）⭐

**手動呼び出し不要の自動トークン最適化：**

```bash
# 1. グローバルインストール
npm install -g toonify-mcp

# 2. プラグインとして追加（自動モード）
claude plugin add toonify-mcp

# 3. インストールを確認
claude plugin list
# 表示されるはず：toonify-mcp ✓
```

**これで完了！** PostToolUse フックが Read、Grep、その他のファイルツールからの構造化データを自動的に傍受して最適化します。

### オプション B：MCP サーバー（手動モード）

**明示的な制御または非 Claude Code MCP クライアント用：**

```bash
# 1. グローバルインストール
npm install -g toonify-mcp

# 2. MCP サーバーとして登録
claude mcp add toonify -- toonify-mcp

# 3. 確認
claude mcp list
# 表示されるはず：toonify: toonify-mcp - ✓ Connected
```

次にツールを明示的に呼び出します：
```bash
claude mcp call toonify optimize_content '{"content": "..."}'
claude mcp call toonify get_stats '{}'
```

## 動作原理

### プラグインモード（自動）

```
ユーザー：大きな JSON ファイルを読む
  ↓
Claude Code が Read ツールを呼び出す
  ↓
PostToolUse フックが結果を傍受
  ↓
フックが JSON を検出し、TOON に変換
  ↓
最適化されたコンテンツを Claude API に送信
  ↓
50-55% の典型的なトークン削減を達成 ✨
```

### MCP サーバーモード（手動）

```
ユーザー：mcp__toonify__optimize_content を明示的に呼び出す
  ↓
コンテンツを TOON フォーマットに変換
  ↓
最適化された結果を返す
```

## 設定

`~/.claude/toonify-config.json` を作成（オプション）：

```json
{
  "enabled": true,
  "minTokensThreshold": 50,
  "minSavingsThreshold": 30,
  "skipToolPatterns": ["Bash", "Write", "Edit"]
}
```

### オプション

- **enabled**：自動最適化を有効/無効にする（デフォルト：`true`）
- **minTokensThreshold**：最適化前の最小トークン数（デフォルト：`50`）
- **minSavingsThreshold**：必要な最小節約率（デフォルト：`30%`）
- **skipToolPatterns**：最適化しないツール（デフォルト：`["Bash", "Write", "Edit"]`）

### 環境変数

```bash
export TOONIFY_ENABLED=true
export TOONIFY_MIN_TOKENS=50
export TOONIFY_MIN_SAVINGS=30
export TOONIFY_SKIP_TOOLS="Bash,Write"
export TOONIFY_SHOW_STATS=true  # 出力に最適化統計を表示
```

## 例

### 最適化前（142 トークン）

```json
{
  "products": [
    {"id": 101, "name": "Laptop Pro", "price": 1299},
    {"id": 102, "name": "Magic Mouse", "price": 79}
  ]
}
```

### 最適化後（57 トークン、-60%）

```
[TOON-JSON]
products[2]{id,name,price}:
  101,Laptop Pro,1299
  102,Magic Mouse,79
```

**プラグインモードで自動的に適用 - 手動呼び出し不要！**

## 使用のヒント

### いつ自動最適化がトリガーされますか？

PostToolUse フックは次の場合に自動的に最適化します：
- ✅ コンテンツが有効な JSON、CSV、または YAML
- ✅ コンテンツサイズ ≥ `minTokensThreshold`（デフォルト：50 トークン）
- ✅ 推定節約 ≥ `minSavingsThreshold`（デフォルト：30%）
- ✅ ツールが `skipToolPatterns` に含まれていない（例：Bash/Write/Edit ではない）

### 最適化統計を表示

```bash
# プラグインモードで
claude mcp call toonify get_stats '{}'

# または Claude Code 出力の統計を確認（TOONIFY_SHOW_STATS=true の場合）
```

## トラブルシューティング

### フックがトリガーされない

```bash
# 1. プラグインがインストールされているか確認
claude plugin list | grep toonify

# 2. 設定を確認
cat ~/.claude/toonify-config.json

# 3. 統計を有効にして最適化の試みを確認
export TOONIFY_SHOW_STATS=true
```

### 最適化が適用されない

- `minTokensThreshold` を確認 - コンテンツが小さすぎる可能性
- `minSavingsThreshold` を確認 - 節約が 30% 未満の可能性
- `skipToolPatterns` を確認 - ツールがスキップリストに含まれている可能性
- コンテンツが有効な JSON/CSV/YAML であることを確認

### パフォーマンスの問題

- `minTokensThreshold` を下げてより積極的に最適化
- `minSavingsThreshold` を上げて限界的な最適化をスキップ
- 必要に応じて、より多くのツールを `skipToolPatterns` に追加

## 比較：プラグイン vs MCP サーバー

| 機能 | プラグインモード | MCP サーバーモード |
|------|--------------|------------------|
| **アクティベーション** | 自動（PostToolUse） | 手動（ツール呼び出し） |
| **互換性** | Claude Code のみ | 任意の MCP クライアント |
| **設定** | プラグイン設定ファイル | MCP ツール |
| **パフォーマンス** | ゼロオーバーヘッド | 呼び出しオーバーヘッド |
| **ユースケース** | 日常のワークフロー | 明示的な制御 |

**推奨**：自動最適化にはプラグインモードを使用。明示的な制御または他の MCP クライアントには MCP サーバーモードを使用。

## アンインストール

### プラグインモード
```bash
claude plugin remove toonify-mcp
rm ~/.claude/toonify-config.json
```

### MCP サーバーモード
```bash
claude mcp remove toonify
```

### パッケージ
```bash
npm uninstall -g toonify-mcp
```

## リンク

- **GitHub**：https://github.com/kevintseng/toonify-mcp
- **Issues**：https://github.com/kevintseng/toonify-mcp/issues
- **NPM**：https://www.npmjs.com/package/toonify-mcp
- **MCP ドキュメント**：https://code.claude.com/docs/mcp
- **TOON フォーマット**：https://github.com/toon-format/toon

## 貢献

貢献を歓迎します！ガイドラインについては [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ライセンス

MIT ライセンス - 詳細は [LICENSE](LICENSE) を参照

---

## 変更履歴

### v0.4.0（2025-12-26）
- ✨ **強化されたキャッシングシステム** - TTL 有効期限とオプションのディスク永続化を備えた LRU キャッシュ
- ✨ キャッシュヒット時のパフォーマンスが 50-500 倍向上（約 0.1ms vs 5-50ms）
- ✨ キャッシュ管理のための 3 つの新しい MCP ツール
- 🐛 重大なバグ修正：競合状態、過剰なディスク I/O、O(n) パフォーマンス
- 🐛 誤ったキャッシュヒット、検証の欠落、未処理エラーを修正
- ✅ 全 122 テスト合格（5 つのベンチマークテスト失敗を修正）

### v0.3.0（2025-12-26）
- ✨ **多言語トークン最適化** - 15 以上の言語の正確なカウント
- ✨ 言語を考慮したトークン倍率（中国語 2 倍、日本語 2.5 倍、アラビア語 3 倍など）
- ✨ 混合言語テキストの検出と最適化
- ✨ 実際の統計を使用した包括的なベンチマークテスト
- 📊 データに裏付けられたトークン節約の主張（30-65% の範囲、通常 50-55%）
- ✅ 多言語エッジケースを含む 75 以上のテスト合格
- 📝 多言語 README バージョン

### v0.2.0（2025-12-25）
- ✨ PostToolUse フックによる Claude Code プラグインサポートの追加
- ✨ 自動トークン最適化（手動呼び出し不要）
- ✨ プラグイン設定システム
- ✨ デュアルモード：プラグイン（自動）+ MCP サーバー（手動）
- 📝 包括的なドキュメント更新

### v0.1.1（2024-12-24）
- 🐛 バグ修正と改善
- 📝 ドキュメント更新

### v0.1.0（2024-12-24）
- 🎉 初回リリース
- ✨ MCP サーバー実装
- ✨ TOON フォーマット最適化
- ✨ 組み込みメトリクス追跡
