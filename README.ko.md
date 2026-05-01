# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Claude Code용 컨텍스트 압축 플러그인입니다. 대용량 툴 출력(JSON, CSV, YAML, 스택 트레이스, 로그)이 컨텍스트 윈도우에 들어가기 전에 자동으로 축소합니다.

Claude Code 플러그인(자동, 별도 설정 불필요)과 MCP 서버(온디맨드) 두 가지 모드로 사용할 수 있습니다.

## 기능

- 대용량 JSON, CSV, YAML, API 응답 압축
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

## 문서

- 사이트: https://toonify.pcircle.ai/
- 벤치마크: https://toonify.pcircle.ai/benchmarks.html
- 개인정보: https://toonify.pcircle.ai/privacy.html
- 이용약관: https://toonify.pcircle.ai/terms.html
- [CHANGELOG.md](CHANGELOG.md)
