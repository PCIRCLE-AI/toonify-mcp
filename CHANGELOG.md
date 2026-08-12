# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Bash command output is now compressed. `Bash` was previously excluded (not in the hook matcher, and in the default `skipToolPatterns`), yet its output is one of the largest token sinks in a session — `curl`/`jq`/`node` JSON, test-runner and build logs, etc. The hook now compresses Bash's `stdout` through the same selective detect→compress path used for Read/WebFetch (JSON/YAML → TOON, repetitive debug output → collapsed, everything else passed through untouched). Verified live: `stdout` is the *combined* output field (a stderr-only command's bytes land in `stdout`; the `stderr` field was empty in every probe), so compressing `stdout` covers everything; image output (`isImage`) is never touched; exit status and the other response fields are preserved, so command semantics are unchanged. End-to-end against a real Claude Code session, Claude read a compressed 200-row JSON result correctly (73% smaller) and correctly interpreted a collapsed build log ("12 warnings, build failed") — including the `[toonify] repeated N more times` marker. Small/plain command output stays below the token threshold and is left alone. `Write`/`Edit` remain excluded (their results are mutations, not compressible content)

### Fixed
- Plugin-mode hook now genuinely compresses `Read`, `WebFetch`, and `Grep` results instead of never firing on them. `tool_response` for these tools is a structured object, not a plain string, so the hook's entry gate had silently no-op'd on every matched call. The hook now extracts the text field per tool, compresses it, and rebuilds the object with only that field replaced, returned via `hookSpecificOutput.updatedToolOutput` — which *replaces* what Claude sees, unlike `additionalContext`, which only appends and made context bigger, not smaller. Read's and WebFetch's shapes (`{type, file:{filePath, content, numLines, startLine, totalLines}}` and `{bytes, code, codeText, result, durationMs, url}`) were verified by runtime observation — registering this hook via a real Claude Code session's `.claude/settings.json` and reading the literal stdin bytes. Grep's shape (`{mode?: 'content'|'files_with_matches'|'count', numFiles, filenames, content?, numLines?, numMatches?, totalFiles?, totalLines?, appliedLimit?, appliedOffset?}`) and Glob's (`{durationMs, numFiles, filenames, truncated, totalMatches?, countIsComplete?}`) were verified by source inspection instead, after that runtime method turned up nothing: `strings` on the installed Claude Code binary contains the literal Zod schema source for both tools' output, plus the CLI's own result-rendering functions, which confirm `content` backs Grep's `'content'` and `'count'` modes but never the default `'files_with_matches'` mode. (An earlier version of the Grep adapter, built on a secondhand claim of live capture that could not be corroborated, was retracted before this source-verified one replaced it — see the comment above `extractText()` in `hooks/post-tool-use.mjs` for that account.) Glob has no adapter: its schema confirms there is no bulk-text field to compress, only an array of bare filenames plus counters/booleans — TOON's advantage comes from collapsing repeated *object keys*, which doesn't apply to an array of strings. Measured on a real 500-row JSON file through the actual production code path: 63.8% real token reduction (cl100k_base) for Read. A `Read`/Grep-`'content'`-mode line-count invariant is preserved after compression so Claude isn't misled about how much content remains. An unrecognized object (Grep's `files_with_matches`, Glob, an unmatched tool) has no safe text field, so it passes through untouched
- The hook no longer uses `additionalContext` at all, and no longer has a token-growing path. `additionalContext` is purely additive — verified live against a real Claude Code session that `suppressOutput: true` does NOT hide the original tool result, so anything sent there is *added on top of* the full original, growing total context (the opposite of the tool's purpose). Compressed content now always goes out via `updatedToolOutput`, which replaces. For a string `tool_response` (a compat-only path — no current Claude Code tool sends a bare string for the matched tools; Read/Bash/Glob/Grep/WebFetch/WebSearch were all probed live and send objects), the tool's output schema *is* a string, so the compressed string is itself a schema-valid replacement — the inverse of the earlier verified failure where a bare string was rejected *for Read because Read's schema is an object*. Also removed the now-dead `showStats`/`TOONIFY_SHOW_STATS` config: its only output was that additive footer, which either grew context (append path, now gone) or would have corrupted the replaced content, so it had nowhere left to go
- Fixed a ReDoS (quadratic backtracking) vulnerability across five regex sites in the hook and the library's debug-output detector/compressor: `hasMultipleFileLocationDiagnostics`'s file-path regex, a sibling stack-frame regex, and the pointer-line regex `/^\s*[|]?\s*(\^+|~+)\s*$/` used in both the detection path and the *compression* path (`compressDebugOutput`'s pointer filter, `collapseSourceExcerptNoise`, and the library's `removePointerOnlyLines`) each had an ambiguous character-class/literal overlap causing O(n²) backtracking on adversarial input. Verified before the fix: a ~120,000-character adversarial line took the detection path over 10 seconds, and a payload that scores as debug output plus one 150,000-space line took the *compression* path ~15s (hook) / ~14s (library) — the compression path runs on the full, uncapped content that `Pipeline.run` passes through, which the entry-time size guard doesn't protect (it bounds `JSON.parse`/throughput cost, not backtracking). Fixed structurally by capping the length any line is *tested against* these regexes with (a real pointer/diagnostic line is always short, so no legitimate content is ever truncated — only what the vulnerable regex sees is bounded). Regression tests now exercise the compression path directly, not just detection
- Fixed a `PersistentCache` write-path race that surfaced as an intermittent `ENOENT: rename ...tmp` crash and a flaky `lru-cache.test.ts`. The batch-timer's `flushPendingWrites` ran on a `setTimeout` *outside* the serial write queue, so it could overlap a queued `saveAll`/`delete`: with a shared `${filePath}.tmp` that produced the ENOENT (one call renamed the temp away before the other's rename), and even with unique temp paths two concurrent `loadAll → merge → write-full-state` operations could interleave last-writer-wins and drop an update. Fixed at both layers — each atomic write now uses a unique temp path with cleanup on failure, AND the batch flush is routed *through* the same serial queue (a new `flush` queue op) so no two disk writes ever run concurrently. The public `flush()` now enqueues rather than firing off-queue, so its awaited promise actually resolves once the write is durable. Verified with a concurrency test that overlaps a batched save with a `saveAll` 25× and asserts no crash, no orphaned temp, and a durable final state
- Fixed the `postinstall` script failing every `npm install` (including CI) with `SyntaxError: Invalid or unexpected token`: the inline `node -e "..."` command had backticks inside a double-quoted shell string, which `sh -c` interpreted as command substitution. Moved the message to a real `scripts/postinstall.mjs` file with no shell-quoting layer to get wrong
- Fixed the hook's source-code guard (`looksLikeSourceCode`, added earlier in this branch) recognizing only TypeScript/Python/PHP/Go: source in any other language (Java, C, C++, Rust, ...) with repeated near-identical lines could still be misclassified as debug output and have real code lines silently replaced with a `[toonify] repeated N more times` note. Added the same generic-code fallback the library's `Detector` already has
- Removed `CodeCompressor` from the pipeline and the standalone hook: comment-stripping heuristics dropped the closing `"""` of multi-line Python docstrings and truncated regex literals such as `/^https?:\/\//` at the `//`, producing source that no longer parses. Measured savings (0.8% on a React/TS project, 6.5% median on a Python project) did not justify the risk. Source code now always passes through untouched
- Removed CSV detection from the pipeline detector and the standalone hook: encoding CSV as TOON measured as a net loss at every size tried
- `TokenOptimizer`'s processing-time budget is now an entry-time size guard instead of a post-hoc discard. Previously the full pipeline ran and the result was thrown away if the wall clock exceeded `maxProcessingTime` (default 50ms) — a check driven by OS scheduling noise, not actual cost, which made `npm run test:coverage` fail nondeterministically under parallel test load. Raised the default budget to 2000ms and derived a content-length ceiling from it before any pipeline work starts
- Empty or whitespace-only content is now rejected immediately with an explicit `Empty content` reason instead of falling through to the detector

### Changed
- README (all 11 language files), the public docs site (`index.html`/`index-zh.html`, `terms.html`/`terms-zh.html`, `benchmarks.html`/`benchmarks-zh.html`, `llms.txt`, `llms-full.txt`), `package.json`'s description, and `.claude-plugin/plugin.json`'s description no longer claim CSV or source-code compression, matching the above
- MCP server's `optimize_content` tool description no longer lists CSV as an accepted content type

### Tests
- Added regression coverage: Python source with a multi-line docstring and TypeScript source with regex literals both pass through the pipeline and the hook byte-for-byte unchanged
- Added regression coverage for the empty-content guard, the entry-time processing-budget guard (including its exact boundary and interaction with `MAX_CONTENT_SIZE`), and `maxProcessingTime` validation (0/negative/NaN/Infinity)
- Added regression coverage for the object-shaped `tool_response` path: Read/WebFetch/Grep compression and reconstruction (all three Grep modes), the line-count invariant, partial reads, unrecognized tool names, malformed shapes, and Glob (no adapter, by design) passing through safely
- Added regression coverage for the ReDoS fix (adversarial payload completes well under budget) and the generic-code-fallback fix (non-TS/Python/PHP/Go source is not misclassified as debug output)
- Replaced a vacuous 10MB-hook-size-ceiling test (the original fixture had no newline, so it never exercised the code path the guard actually changes) with one using genuinely compressible content that behaves observably differently just under vs. just over the ceiling
- Tightened the hook's diagnostic-collapse test to assert the same location-preservation and omission-marker specifics the library's equivalent test already asserted, so a regression in the hook's own copy can't slip past this suite
- Updated pipeline/detector/hook tests that previously asserted `CodeCompressor` or CSV-to-TOON behavior to assert passthrough instead
- Added tests reaching the debug-output *compression* path directly (hook + library) for the ReDoS fix, since the pre-existing ReDoS tests only exercised detection and never invoked the vulnerable compression regexes; added a WebFetch malformed-shape passthrough test and a library-side generic-code-vs-debug-output classification test to close hook/library coverage asymmetries; tightened the Grep `numLines` assertion to a hardcoded expected value instead of re-deriving it with the implementation's own formula
- Corrected stale comments left over from this branch's iteration (a `Grep-count`-only note that no longer matched the mode-agnostic adapter; a `verified live: Read, WebFetch` note that omitted Grep), added reciprocal cross-references and lockstep-warning comments to the hook/library duplicated code so future edits don't silently diverge, and renamed a `CSV-like`/`類 CSV` benchmark label on the docs site that still implied CSV support

## [0.7.2] - 2026-05-01

### Changed
- Made `toonify-mcp setup` more explicit about local marketplace state, plugin state, and what to do next
- Made `toonify-mcp doctor` more recovery-oriented with clearer install, version, and config guidance
- Made `toonify-mcp status` show the latest optimized or skipped outcome in plainer language
- Made debug-output compression slimmer for repeated TypeScript and lint diagnostics by collapsing similar repeats instead of only exact duplicate lines
- Synced README, landing pages, and AI-readable docs with the improved `setup` / `doctor` / `status` workflow

### Fixed
- Removed TypeScript-style source excerpt noise from debug-output compression when the diagnostic header already carries file and line context
- Kept hook-mode and core debug-output compression aligned for similar repeated diagnostic collapsing

### Tests
- Added and updated CLI and metrics coverage for the new setup, doctor, and status wording
- Added debug-output regression coverage for repeated TypeScript diagnostics and hook/pipeline parity

## [0.7.1] - 2026-05-01

### Changed
- Synced public docs, AI-readable site metadata, and localized pages with the current `toonify-mcp setup` / `doctor` workflow and the streamlined landing-page structure

### Fixed
- Preserve PHP backtick command strings during `#` inline-comment stripping in both the core code compressor and the standalone PostToolUse hook

### Tests
- Added PHP regression coverage for backtick command strings in both the pipeline compressor and the standalone hook path

## [0.7.0] - 2026-04-30

### Added
- Debug-output compression support for long test failures, stack traces, compiler diagnostics, and repetitive lint/build output
- `toonify-mcp setup` for one-command plugin install, update, and re-enable
- `toonify-mcp setup mcp` for faster MCP server registration
- `toonify-mcp doctor` for local install validation
- `toonify-mcp status` for recent optimization visibility
- PHP source-code compression support in the pipeline and standalone PostToolUse hook

### Changed
- Public docs, landing pages, and install guidance now match the current Claude Code plugin workflow
- Install guidance now prefers `toonify-mcp setup` over manual marketplace and plugin commands
- Added machine-readable website surfaces (`llms.txt`, `llms-full.txt`, `robots.txt`, `sitemap.xml`) and FAQ/structured metadata for the public docs site
- Replaced the docs-site Tailwind CDN dependency with a checked-in local CSS build for production-safe static hosting

### Fixed
- Align plugin metadata and install flow with current Claude Code validation requirements
- Fix landing-page FAQ interactions so disclosure items open and close correctly
- Preserve PHP 8 attribute syntax (`#[...]`) during compression instead of treating it as a hash comment
- Preserve PHP heredoc and nowdoc bodies during inline-comment stripping and comment-line removal
- Patched transitive Hono dependencies to remove current moderate audit advisories from the release tree

### Tests
- Added debug-output detector, compressor, CLI, and hook regression coverage
- Added PHP detector, compressor, and hook regression coverage for attributes, heredoc/nowdoc handling, and inline hash comments

## [0.5.0] - 2026-01-21

### Added
- **pcircle.ai marketplace integration** - One-click installation from Claude Code marketplace
  - Created `.claude-plugin/marketplace.json` configuration
  - Registered toonify-mcp as the first plugin in pcircle.ai marketplace
  - Marketplace auto-discovery enabled (discoverable within 24 hours)
  - Simplified installation process - browse marketplace, click install, done!
- **Updated all 11 language README files** with marketplace installation option
  - Added "Option A: Install from pcircle.ai Marketplace (Easiest) 🌟" as primary installation method
  - Available in: English, Traditional Chinese, Japanese, Spanish, French, German, Korean, Russian, Portuguese, Vietnamese, Indonesian
  - Previous installation options shifted to "Option B" (Plugin) and "Option C" (MCP Server)
  - Consistent messaging across all languages emphasizing one-click convenience

### Changed
- Marketplace installation now recommended as the easiest method
- Installation options reorganized to prioritize user experience:
  1. **Marketplace** (easiest - one click)
  2. **Plugin mode** (automatic - npm + claude plugin add)
  3. **MCP Server** (manual - for explicit control)
- Updated dependency versions:
  - `@modelcontextprotocol/sdk` to ^1.25.3
  - `tiktoken` to ^1.0.22
  - `yaml` to ^2.8.2
  - `@types/node` to ^25.0.9
  - `typescript` to ^5.9.3
- Documentation now recommends GitHub download/install instead of npm publish.
- Applied `npm audit fix` for `qs` (DoS vulnerability; transitive dependency).
- Migrated test toolchain to Jest 30 using `@swc/jest` for TypeScript ESM support.

### Technical Details
- **Marketplace configuration**: `.claude-plugin/marketplace.json`
  - Owner: PCIRCLE AI
  - Plugin version: 0.2.3
  - Marketplace version: 1.0.0
  - Source: Current repository root
- **Distribution**: Available at [claudemarketplaces.com](https://claudemarketplaces.com)
- **Discovery timeline**: Auto-discovered within 24 hours (requires 5+ GitHub stars)
- **Documentation**: All 11 language versions updated consistently

## [0.4.0] - 2025-12-26

### Added
- **Enhanced caching system with LRU eviction, TTL expiration, and optional persistence**
  - `LRUCache` class with Least Recently Used eviction strategy
  - TTL (Time-to-Live) expiration for cache entries (default: 1 hour)
  - Optional disk persistence for cross-session cache reuse
  - SHA-256 content-based cache keys
  - Comprehensive cache statistics tracking (hits, misses, evictions, expirations)
- **Three new MCP tools for cache management**
  - `clear_cache` - Clear all cached optimization results
  - `get_cache_stats` - Get detailed cache statistics (LRU + Prompt cache)
  - `cleanup_expired_cache` - Remove expired entries and return count
- **Automatic optimization result caching**
  - TokenOptimizer now caches results to avoid re-processing identical content
  - Cache hits return previously optimized results without re-processing identical content
- **Comprehensive cache documentation**
  - New `docs/CACHE.md` with detailed usage, configuration, and best practices
  - Architecture diagrams and performance analysis
  - Troubleshooting guide and migration instructions

### Changed
- TokenOptimizer constructor now includes `resultCache` configuration option
- Updated README.md with cache management section and performance benchmarks
- Cache is enabled by default with sensible defaults (500 entries, 1 hour TTL, no persistence)
- Removed hardcoded 200-character minimum threshold to allow benchmark tests for small content
- Updated MCP tool response format to standardized `{success, data, error}` structure

### Fixed
- **Critical: Race conditions in PersistentCache** - Added operation serialization queue to prevent concurrent write conflicts
- **Critical: Excessive disk I/O** - Implemented batched writes with 100ms debounce, reducing disk operations by 90%+
- **Performance: O(n) updateStats()** - Optimized from O(n) to O(1) using running totals instead of iterating all entries
- **Bug: False cache hits** - Fixed cache key generation to include metadata (toolName), preventing incorrect cache hits across different tools
- **Bug: Missing config validation** - Added comprehensive validation for resultCache configuration with helpful error messages
- **Bug: Unhandled errors in MCP tools** - Added try-catch error handling to all MCP cache tool handlers
- **Bug: LRU cache persistence** - Made `saveToDisk()` async and properly flush pending writes before completion
- **Test failures**: Fixed all 5 existing benchmark test failures by using configurable thresholds instead of hardcoded limits

### Technical Details
- **New modules**:
  - `src/optimizer/caching/lru-cache.ts` - LRU cache implementation (270 lines)
  - `src/optimizer/caching/persistent-cache.ts` - Disk persistence layer (135 lines)
  - `src/optimizer/caching/cache-types.ts` - Type definitions for LRU cache
  - `tests/caching/lru-cache.test.ts` - Comprehensive test suite (18 tests, 100% pass)
- **Cache configuration**:
  ```typescript
  {
    enabled: true,
    maxSize: 500,           // Maximum cache entries
    ttl: 3600000,           // 1 hour in milliseconds
    persistent: false,      // Disk persistence disabled by default
    persistPath: '~/.toonify-mcp/cache/optimization-cache.json'
  }
  ```
- **Performance metrics**:
  - Cache hit: ~0.1ms (instant return)
  - Cache miss: ~5-50ms (optimization + store)
  - Memory usage: ~2-5 KB per entry, ~1-2.5 MB for 500 entries
- **Test coverage**: 18 new tests covering LRU eviction, TTL expiration, persistence, statistics

## [0.3.0] - 2025-12-26

### Added
- **Multilingual token optimization** - Accurate token counting for 15+ languages
  - Language-aware token multipliers (2x for Chinese, 2.5x for Japanese, 3x for Arabic, etc.)
  - Support for mixed-language text detection and optimization
  - Comprehensive language profiles with detection patterns
- **Comprehensive benchmarking system**
  - Real statistical data from benchmark tests (12 test cases)
  - Multiple data types: small/medium/large JSON, CSV-like, nested structures, API responses
  - Multilingual test cases (English, Chinese, Japanese)
- **Multilingual documentation**
  - README versions in Traditional Chinese (zh-TW), Simplified Chinese (zh-CN), Japanese (ja), Spanish (es), Vietnamese (vi), and Indonesian (id)
  - Language navigation links in all README versions

### Changed
- **Updated token savings claims** with data-backed accuracy
  - From "60%+ on average" to "30-65% depending on data structure"
  - Typical savings: 50-55% for structured data
  - Based on real benchmark results (12 test cases, 7 valid results)
- Improved confidence calculation in language detection
  - Adaptive weighting based on character density
  - Better handling of CJK language overlap (Chinese vs Japanese)
  - Enhanced English detection patterns
- TypeScript type definitions updated for multilingual support

### Fixed
- Language detection accuracy for non-English languages
  - Chinese detection confidence improved from 33.8% to >70%
  - Japanese detection confidence improved from 64% to >70%
  - Arabic detection confidence improved from 32.3% to >70%
- Mixed-language text detection (English + CJK)
- Tiktoken initialization issues in standalone scripts
  - Now using Jest test environment for reliable WASM initialization

### Technical Details
- **New modules**:
  - `src/optimizer/multilingual/language-detector.ts` - Language detection with confidence scoring
  - `src/optimizer/multilingual/language-profiles.ts` - 15+ language profiles with token multipliers
  - `src/optimizer/multilingual/tokenizer-adapter.ts` - Multilingual tokenizer wrapper
  - `tests/multilingual/language-detector.test.ts` - 47 tests for language detection
  - `tests/multilingual/tokenizer-adapter.test.ts` - 28 tests for tokenizer adapter
  - `tests/benchmarks/quick-stats.test.ts` - Benchmark testing with real statistics
- **Test coverage**: 75+ tests passing, including multilingual edge cases
- **Language support**: English, Chinese (Simplified & Traditional), Japanese, Korean, Spanish, French, German, Arabic, Russian, Portuguese, Thai, Tamil, Hindi, Vietnamese, Indonesian

## [0.2.3] - 2025-12-25

### Fixed
- **Critical: Cross-platform compatibility fix for hooks and plugin installation**
  - Removed hardcoded Node.js path (`/opt/homebrew/bin/node`) from hooks configuration
  - Changed hook scripts to use shebang (`#!/usr/bin/env node`) for universal compatibility
  - Fixed plugin installation failure on non-macOS systems (Linux, Windows, nvm users)
  - Removed wildcard patterns in middle of commands from `settings.local.json` (Claude Code doesn't support `cmd *arg* rest:*` format)
  - Updated all permission rules to use prefix matching (`cmd:*`) or exact commands only

### Changed
- Hook scripts now use shebang for platform-agnostic execution
- Settings template now uses Claude Code-compatible command patterns
- Improved documentation for cross-platform setup

### Technical Details
**Root Cause**:
- Hardcoded `/opt/homebrew/bin/node` in hooks.json only works on macOS with Homebrew
- Wildcard in middle of command (`Bash(cmd *arg* rest:*)`) causes entire settings file to be skipped
- Claude Code requires either prefix wildcards (`:*`) or exact commands

**Impact**:
- Users on Linux, Windows, or using nvm couldn't install or use hooks
- Settings validation errors prevented hooks, plugins, and MCP servers from loading

**Solution**:
- All hook scripts made executable with proper shebang
- hooks.json updated to use direct script paths without hardcoded interpreter
- settings.local.json updated to use only supported wildcard patterns

## [0.2.2] - 2025-12-24

### Added
- Initial hook system for post-tool-use optimization
- MCP tools for token optimization

## [0.2.0] - 2025-12-23

### Added
- Initial release with basic TOON format optimization
- Support for JSON, CSV, and YAML optimization
