# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Toonify MCP ajuda quando o Claude Code começa a ficar pesado por causa de saídas muito grandes.

## O que melhora para o usuário

- JSON, CSV, YAML e respostas de API ficam mais leves
- Falhas longas de teste e stack traces ficam mais fáceis de levar na sessão
- Você continua usando o Claude Code do mesmo jeito

## Para quem faz sentido

- Quem lê tool output grande com frequência
- Quem costuma jogar logs, traces ou arquivos de código no Claude Code
- Quem quer algo local e automático

## Quando ajuda menos

- Texto curto
- Arquivos muito pequenos
- Conteúdo em que o formato original importa mais do que economizar contexto

## Instalação rápida

```bash
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp
npm install
npm run build
npm install -g .
claude plugin marketplace add ./.claude-plugin/marketplace.json
claude plugin install toonify-mcp@pcircle-ai --scope local
claude plugin list
```

Se tudo estiver certo, `claude plugin list` deve mostrar `toonify-mcp@pcircle-ai` com `enabled`.

## Verificação rápida

```bash
toonify-mcp doctor
toonify-mcp status
```

## Modo MCP (opcional)

```bash
claude mcp add toonify -- toonify-mcp
claude mcp list
```

## Onde ver a versão mais atual

- Guia principal: [README.md](README.md)
- Versão em chinês tradicional: [README.zh-TW.md](README.zh-TW.md)
- Site público: https://toonify.pcircle.ai/
