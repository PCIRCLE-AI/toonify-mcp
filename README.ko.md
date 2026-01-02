# 🎯 Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

구조화된 데이터의 자동 토큰 최적화를 제공하는 MCP 서버 + Claude Code 플러그인입니다.
투명한 TOON 형식 변환을 통해 Claude API 토큰 사용량을 **데이터 구조에 따라 30-65% 감소**시키며, 구조화된 데이터의 경우 일반적으로 **50-55%의 절감 효과**를 제공합니다.

## v0.4.0의 새로운 기능

✨ **향상된 캐싱 시스템!**
- ✅ TTL 만료 및 선택적 디스크 지속성을 갖춘 LRU 캐시
- ✅ 캐시 적중 시 50-500배 성능 향상 (~0.1ms vs 5-50ms)
- ✅ 3개의 새로운 MCP 도구: `clear_cache`, `get_cache_stats`, `cleanup_expired_cache`
- ✅ 자동 최적화 결과 캐싱 - 동일한 콘텐츠 재처리 방지
- ✅ 중요한 버그 수정: 경쟁 조건, 과도한 디스크 I/O, O(n) 성능 문제
- ✅ 모든 122개 테스트 통과 (이전 105개) - 5개 벤치마크 테스트 실패 수정

## 주요 기능

- **30-65% 토큰 감소** (일반적으로 50-55%) JSON, CSV, YAML 데이터 대상
- **다국어 지원** - 15개 이상의 언어에 대한 정확한 토큰 계산
- **완전 자동** - PostToolUse 훅이 도구 결과를 자동으로 가로챔
- **무설정** - 합리적인 기본값으로 즉시 작동
- **이중 모드** - 플러그인(자동) 또는 MCP 서버(수동)로 작동
- **내장 메트릭** - 로컬에서 토큰 절감 추적
- **자동 폴백** - 워크플로우를 중단하지 않음

## 설치 방법

### 옵션 A: pcircle.ai 마켓플레이스에서 설치 (가장 쉬움) 🌟

**원클릭 설치:**

Claude Code에서 [pcircle.ai 마켓플레이스](https://claudemarketplaces.com)를 방문하여 toonify-mcp를 클릭 한 번으로 설치하세요. 마켓플레이스가 모든 것을 자동으로 처리합니다!

### 옵션 B: Claude Code 플러그인 (권장) ⭐

**수동 호출 없이 자동 토큰 최적화:**

```bash
# 1. 전역 설치
npm install -g toonify-mcp

# 2. 플러그인으로 추가 (자동 모드)
claude plugin add toonify-mcp

# 3. 설치 확인
claude plugin list
# 다음과 같이 표시되어야 함: toonify-mcp ✓
```

**완료!** 이제 PostToolUse 훅이 Read, Grep 및 기타 파일 도구에서 구조화된 데이터를 자동으로 가로채고 최적화합니다.

### 옵션 B: MCP 서버 (수동 모드)

**명시적 제어가 필요하거나 Claude Code가 아닌 MCP 클라이언트용:**

```bash
# 1. 전역 설치
npm install -g toonify-mcp

# 2. MCP 서버로 등록
claude mcp add toonify -- toonify-mcp

# 3. 확인
claude mcp list
# 다음과 같이 표시되어야 함: toonify: toonify-mcp - ✓ Connected
```

그런 다음 도구를 명시적으로 호출:
```bash
claude mcp call toonify optimize_content '{"content": "..."}'
claude mcp call toonify get_stats '{}'
```

## 작동 방식

### 플러그인 모드 (자동)

```
사용자: 대용량 JSON 파일 읽기
  ↓
Claude Code가 Read 도구 호출
  ↓
PostToolUse 훅이 결과를 가로챔
  ↓
훅이 JSON을 감지하고 TOON으로 변환
  ↓
최적화된 콘텐츠가 Claude API로 전송
  ↓
일반적으로 50-55% 토큰 감소 달성 ✨
```

### MCP 서버 모드 (수동)

```
사용자: mcp__toonify__optimize_content를 명시적으로 호출
  ↓
콘텐츠가 TOON 형식으로 변환됨
  ↓
최적화된 결과 반환
```

## 설정

`~/.claude/toonify-config.json` 파일 생성 (선택사항):

```json
{
  "enabled": true,
  "minTokensThreshold": 50,
  "minSavingsThreshold": 30,
  "skipToolPatterns": ["Bash", "Write", "Edit"]
}
```

### 옵션

- **enabled**: 자동 최적화 활성화/비활성화 (기본값: `true`)
- **minTokensThreshold**: 최적화 전 최소 토큰 수 (기본값: `50`)
- **minSavingsThreshold**: 필요한 최소 절감 비율 (기본값: `30%`)
- **skipToolPatterns**: 최적화하지 않을 도구 (기본값: `["Bash", "Write", "Edit"]`)

### 환경 변수

```bash
export TOONIFY_ENABLED=true
export TOONIFY_MIN_TOKENS=50
export TOONIFY_MIN_SAVINGS=30
export TOONIFY_SKIP_TOOLS="Bash,Write"
export TOONIFY_SHOW_STATS=true  # 출력에 최적화 통계 표시
```

## 예제

### 최적화 전 (142 토큰)

```json
{
  "products": [
    {"id": 101, "name": "Laptop Pro", "price": 1299},
    {"id": 102, "name": "Magic Mouse", "price": 79}
  ]
}
```

### 최적화 후 (57 토큰, -60%)

```
[TOON-JSON]
products[2]{id,name,price}:
  101,Laptop Pro,1299
  102,Magic Mouse,79
```

**플러그인 모드에서 자동으로 적용됨 - 수동 호출 불필요!**

## 사용 팁

### 자동 최적화는 언제 실행되나요?

PostToolUse 훅은 다음 조건에서 자동으로 최적화합니다:
- ✅ 콘텐츠가 유효한 JSON, CSV 또는 YAML인 경우
- ✅ 콘텐츠 크기 ≥ `minTokensThreshold` (기본값: 50 토큰)
- ✅ 예상 절감량 ≥ `minSavingsThreshold` (기본값: 30%)
- ✅ 도구가 `skipToolPatterns`에 없는 경우 (예: Bash/Write/Edit 아님)

### 최적화 통계 보기

```bash
# 플러그인 모드에서
claude mcp call toonify get_stats '{}'

# 또는 Claude Code 출력에서 통계 확인 (TOONIFY_SHOW_STATS=true인 경우)
```

## 문제 해결

### 훅이 실행되지 않음

```bash
# 1. 플러그인 설치 확인
claude plugin list | grep toonify

# 2. 설정 확인
cat ~/.claude/toonify-config.json

# 3. 통계를 활성화하여 최적화 시도 확인
export TOONIFY_SHOW_STATS=true
```

### 최적화가 적용되지 않음

- `minTokensThreshold` 확인 - 콘텐츠가 너무 작을 수 있음
- `minSavingsThreshold` 확인 - 절감량이 30% 미만일 수 있음
- `skipToolPatterns` 확인 - 도구가 건너뛰기 목록에 있을 수 있음
- 콘텐츠가 유효한 JSON/CSV/YAML인지 확인

### 성능 문제

- `minTokensThreshold`를 낮춰 더 적극적으로 최적화
- `minSavingsThreshold`를 높여 미미한 최적화 건너뛰기
- 필요한 경우 `skipToolPatterns`에 더 많은 도구 추가

## 비교: 플러그인 vs MCP 서버

| 기능 | 플러그인 모드 | MCP 서버 모드 |
|---------|------------|-----------------|
| **활성화** | 자동 (PostToolUse) | 수동 (도구 호출) |
| **호환성** | Claude Code만 | 모든 MCP 클라이언트 |
| **설정** | 플러그인 설정 파일 | MCP 도구 |
| **성능** | 오버헤드 없음 | 호출 오버헤드 |
| **사용 사례** | 일상 워크플로우 | 명시적 제어 |

**권장사항**: 자동 최적화를 위해 플러그인 모드를 사용하세요. 명시적 제어가 필요하거나 다른 MCP 클라이언트를 사용하는 경우 MCP 서버 모드를 사용하세요.

## 제거

### 플러그인 모드
```bash
claude plugin remove toonify-mcp
rm ~/.claude/toonify-config.json
```

### MCP 서버 모드
```bash
claude mcp remove toonify
```

### 패키지
```bash
npm uninstall -g toonify-mcp
```

## 링크

- **GitHub**: https://github.com/kevintseng/toonify-mcp
- **Issues**: https://github.com/kevintseng/toonify-mcp/issues
- **NPM**: https://www.npmjs.com/package/toonify-mcp
- **MCP Docs**: https://code.claude.com/docs/mcp
- **TOON Format**: https://github.com/toon-format/toon

## 기여

기여를 환영합니다! 가이드라인은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참조하세요.

## 라이선스

MIT License - [LICENSE](LICENSE) 참조

---

## 변경 이력

### v0.4.0 (2025-12-26)
- ✨ **향상된 캐싱 시스템** - TTL 만료 및 선택적 지속성을 갖춘 LRU 캐시
- ✨ 캐시 적중 시 50-500배 성능 향상 (~0.1ms vs 5-50ms)
- ✨ 캐시 관리를 위한 3개의 새로운 MCP 도구
- 🐛 중요한 버그 수정: 경쟁 조건, 과도한 디스크 I/O, O(n) 성능
- 🐛 잘못된 캐시 적중, 누락된 검증, 처리되지 않은 오류 수정
- ✅ 모든 122개 테스트 통과 (5개 벤치마크 테스트 실패 수정)

### v0.3.0 (2025-12-26)
- ✨ **다국어 토큰 최적화** - 15개 이상의 언어에 대한 정확한 계산
- ✨ 언어별 토큰 승수 (중국어 2배, 일본어 2.5배, 아랍어 3배 등)
- ✨ 혼합 언어 텍스트 감지 및 최적화
- ✨ 실제 통계를 사용한 포괄적인 벤치마크 테스트
- 📊 데이터 기반 토큰 절감 수치 (30-65% 범위, 일반적으로 50-55%)
- ✅ 다국어 엣지 케이스를 포함한 75개 이상의 테스트 통과
- 📝 다국어 README 버전

### v0.2.0 (2025-12-25)
- ✨ PostToolUse 훅을 사용한 Claude Code 플러그인 지원 추가
- ✨ 자동 토큰 최적화 (수동 호출 불필요)
- ✨ 플러그인 설정 시스템
- ✨ 이중 모드: 플러그인 (자동) + MCP 서버 (수동)
- 📝 포괄적인 문서 업데이트

### v0.1.1 (2024-12-24)
- 🐛 버그 수정 및 개선
- 📝 문서 업데이트

### v0.1.0 (2024-12-24)
- 🎉 초기 릴리스
- ✨ MCP 서버 구현
- ✨ TOON 형식 최적화
- ✨ 내장 메트릭 추적
