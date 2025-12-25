# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
  - Cache hit returns result in ~0.1ms (vs 5-50ms for optimization)
  - **50-500x performance improvement** on cache hits
- **Comprehensive cache documentation**
  - New `docs/CACHE.md` with detailed usage, configuration, and best practices
  - Architecture diagrams and performance analysis
  - Troubleshooting guide and migration instructions

### Changed
- TokenOptimizer constructor now includes `resultCache` configuration option
- Updated README.md with cache management section and performance benchmarks
- Cache is enabled by default with sensible defaults (500 entries, 1 hour TTL, no persistence)

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
