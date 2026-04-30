# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Toonify MCP는 큰 출력 때문에 Claude Code가 무거워질 때 부담을 줄여주는 도구입니다.

## 바로 체감되는 점

- JSON, CSV, YAML, API 응답이 덜 무거워집니다
- 긴 테스트 실패와 stack trace를 다루기 쉬워집니다
- 평소 Claude Code 쓰던 방식은 그대로 유지됩니다

## 이런 사람에게 잘 맞습니다

- 큰 tool output을 자주 읽는 사람
- logs, traces, source file을 자주 Claude Code에 넣는 사람
- 로컬에서 자동으로 동작하길 원하는 사람

## 이런 경우엔 효과가 작습니다

- 짧은 일반 텍스트
- 아주 작은 파일
- 원본 포맷을 꼭 그대로 유지해야 하는 내용

## 빠른 설치

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

## 빠른 확인

```bash
toonify-mcp status
```

## MCP 모드(선택)

```bash
toonify-mcp setup mcp
claude mcp list
```

## 최신 정보는 여기서

- 메인 안내: [README.md](README.md)
- 번체 중국어: [README.zh-TW.md](README.zh-TW.md)
- 공개 사이트: https://toonify.pcircle.ai/
