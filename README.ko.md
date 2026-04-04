# 🎯 Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

구조화된 데이터 **및 소스 코드**의 자동 토큰 최적화를 제공하는 MCP 서버 + Claude Code 플러그인입니다.
파이프라인 아키텍처를 통해 JSON/CSV/YAML에서 **25-66%**, TypeScript/Python/Go 소스 코드에서 **20-48%** 의 토큰 감소를 달성합니다.

## v0.6.0의 새로운 기능

✨ **파이프라인 아키텍처 + 코드 압축!**
- ✅ **파이프라인 엔진** — 모듈형 Detector → Router → Compressor → Evaluator 아키텍처
- ✅ **코드 압축** — TypeScript(37%), Python(48%), Go(32%) 휴리스틱 기반 압축
- ✅ **6개 압축 레이어** — 빈 줄 병합, 인라인 주석 제거, import 경로 축약, import 요약, 반복 패턴 축소
- ✅ **훅 강화** — PostToolUse 훅이 구조화된 데이터 외에 소스 코드도 압축
- ✅ 확장 가능한 설계 — `Compressor` 인터페이스를 구현하여 새로운 형식 추가
- ✅ 완전한 하위 호환성 — 모든 외부 API 변경 없음
- ✅ 196개 테스트(157개에서 증가), 포괄적인 코드 리뷰 통과

## 주요 기능

- **25-66% 토큰 감소** (일반적으로 약 48%) JSON, CSV, YAML 데이터 대상
- **20-48% 코드 압축** - TypeScript, Python, Go 소스 코드 대상
- **파이프라인 아키텍처** - 확장 가능한 Detector → Compressor → Evaluator 엔진
- **다국어 지원** - 15개 이상의 언어에 대한 정확한 토큰 계산
- **완전 자동** - PostToolUse 훅이 도구 결과를 자동으로 가로챔
- **무설정** - 합리적인 기본값으로 즉시 작동
- **이중 모드** - 플러그인(자동) 또는 MCP 서버(수동)로 작동
- **내장 메트릭** - 로컬에서 토큰 절감 추적
- **자동 폴백** - 워크플로우를 중단하지 않음

## 설치 방법

### 옵션 A: GitHub에서 다운로드 (권장) 🌟

**GitHub 저장소에서 직접 설치 (npm 공개 불필요):**

```bash
# 1. 저장소 다운로드
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp

# 2. 의존성 설치 및 빌드
npm install
npm run build

# 3. 로컬 소스에서 전역 설치
npm install -g .
```

### 옵션 B: Claude Marketplaces에서 설치 (사용 가능한 경우) 🌟

**원클릭 설치:**

Claude Code에서 [Claude Marketplaces](https://claudemarketplaces.com)를 열고, 환경에서 marketplace distribution이 지원될 경우 `toonify-mcp`를 클릭 한 번으로 설치할 수 있습니다.

### 옵션 C: Claude Code 플러그인 (권장) ⭐

**수동 호출 없이 자동 토큰 최적화:**

전제 조건: 옵션 A 또는 B를 완료하여 `toonify-mcp` 바이너리를 사용할 수 있어야 합니다.

```bash
# 1. 플러그인으로 추가 (자동 모드)
claude plugin add toonify-mcp

# 2. 설치 확인
claude plugin list
# 다음과 같이 표시되어야 함: toonify-mcp ✓
```

**완료!** 이제 PostToolUse 훅이 Read, Grep 및 기타 파일 도구에서 구조화된 데이터를 자동으로 가로채고 최적화합니다.

### 옵션 D: MCP 서버 (수동 모드)

**명시적 제어가 필요하거나 Claude Code가 아닌 MCP 클라이언트용:**

전제 조건: 옵션 A 또는 B를 완료하여 `toonify-mcp` 바이너리를 사용할 수 있어야 합니다.

```bash
# 1. MCP 서버로 등록
claude mcp add toonify -- toonify-mcp

# 2. 확인
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
일반적으로 약 48% 토큰 감소 달성 ✨
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

- **Docs**: https://toonify.pcircle.ai/
- **GitHub**: https://github.com/PCIRCLE-AI/toonify-mcp
- **Issues**: https://github.com/PCIRCLE-AI/toonify-mcp/issues
- **MCP Docs**: https://code.claude.com/docs/mcp
- **TOON Format**: https://github.com/toon-format/toon

## 기여

기여를 환영합니다! 가이드라인은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참조하세요.

## 지원

설치 도움말, 버그 보고, 상업 문의 경로는 [SUPPORT.md](SUPPORT.md)를 참고하세요.

## 보안

취약점은 [SECURITY.md](SECURITY.md)에 안내된 방식으로 비공개로 제보해 주세요.

## 라이선스

MIT License - [LICENSE](LICENSE) 참조

릴리스 이력은 [CHANGELOG.md](CHANGELOG.md)를 참고하세요.
