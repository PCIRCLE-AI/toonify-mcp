# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Claude Code용 컨텍스트 압축 플러그인입니다. 대용량 툴 출력(JSON, YAML, 스택 트레이스, 로그)이 컨텍스트 윈도우에 들어가기 전에 자동으로 축소합니다.

Claude Code 플러그인(자동, 별도 설정 불필요)과 MCP 서버(온디맨드) 두 가지 모드로 사용할 수 있습니다.

## 기능

- 대용량 JSON, YAML, API 응답 압축
- 긴 테스트 실패 및 스택 트레이스 축소
- 백그라운드에서 자동 동작——Claude Code 워크플로우 변경 불필요

## 제한사항

짧은 텍스트, 매우 작은 파일, 원본 형식을 정확히 보존해야 하는 콘텐츠는 건너뜁니다.

## 설치

```bash
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp
npm install
npm run build
npm install -g .
toonify-mcp setup
toonify-mcp doctor
```

`toonify-mcp setup` 이 로컬 marketplace 추가와 plugin 설치, 업데이트, 재활성화를 한 번에 처리합니다.

## 상태 확인

```bash
toonify-mcp status
```

## MCP 모드 (선택)

```bash
toonify-mcp setup mcp
claude mcp list
```

`claude mcp list` 에 `toonify: toonify-mcp - ✓ Connected` 가 표시되면 완료입니다.

## 파이프 필터 (모든 에이전트 CLI)

`toonify-mcp compress` 는 stdin 을 읽어 안전하게 압축할 수 있는 것만 압축한 뒤(JSON/YAML → TOON, 반복되는 로그는 접어서 축소; 소스 코드, 일반 텍스트, 정밀도가 중요한 숫자는 그대로 통과) stdout 으로 내보냅니다. 파이프를 깨뜨리는 일은 없습니다——압축이 적용되지 않으면 입력이 바이트 단위 그대로 출력됩니다.

```bash
curl -s https://api.example.com/users | toonify-mcp compress
```

출력이 모델의 컨텍스트에 들어가기 *전에* 압축되기 때문에 어떤 에이전트 CLI 와도 함께 쓸 수 있습니다. 에이전트가 이를 사용하게 하려면 프로젝트의 에이전트 지침 파일(예: `AGENTS.md`)에 규칙을 추가하세요:

```markdown
When a command is likely to print large JSON/YAML or long logs,
pipe it through `toonify-mcp compress` (e.g. `curl ... | toonify-mcp compress`).
It only rewrites output it can compress losslessly; everything else passes through.
```

## OpenAI Codex CLI (온디맨드)

```bash
toonify-mcp setup codex
```

`~/.codex/config.toml` 에 toonify 를 MCP 서버로 등록합니다(먼저 해당 파일의 타임스탬프 백업을 만듭니다). 이후 Codex 는 필요할 때 `optimize_content` 툴을 호출할 수 있습니다.

참고: Codex 에서는 **온디맨드로만 동작하며 자동이 아닙니다**——Codex 의 훅은 아직 Claude Code 의 `updatedToolOutput` 처럼 툴 출력을 교체할 수 없고, 압축본을 덧붙이면 컨텍스트가 줄어들기는커녕 오히려 커집니다. Codex 에서 자동 압축이 필요하면 위의 파이프 필터를 사용하세요.

## 문서

- 사이트: https://toonify.pcircle.ai/
- 벤치마크: https://toonify.pcircle.ai/benchmarks.html
- 개인정보: https://toonify.pcircle.ai/privacy.html
- 이용약관: https://toonify.pcircle.ai/terms.html
- [CHANGELOG.md](CHANGELOG.md)
