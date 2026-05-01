# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Plugin de compressão de contexto para Claude Code. Reduz automaticamente saídas grandes de ferramentas—JSON, CSV, YAML, stack traces e logs—antes de entrarem na janela de contexto.

Funciona como plugin do Claude Code (automático, sem configuração) ou como servidor MCP (sob demanda).

## Funcionalidades

- Comprime respostas grandes de JSON, CSV, YAML e APIs
- Reduz falhas de testes longas e stack traces
- Executa automaticamente em segundo plano—sem alterações no fluxo de trabalho

## Limitações

Ignorado para textos curtos, arquivos muito pequenos e conteúdo onde o formato original deve ser preservado exatamente.

## Instalação

```bash
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp
npm install
npm run build
npm install -g .
toonify-mcp setup
toonify-mcp doctor
```

`toonify-mcp setup` adiciona o marketplace local e instala, atualiza ou reativa o plugin automaticamente.

## Verificação

```bash
toonify-mcp status
```

## Modo MCP (opcional)

```bash
toonify-mcp setup mcp
claude mcp list
```

`claude mcp list` deve mostrar `toonify: toonify-mcp - ✓ Connected`.

## Documentação

- Site: https://toonify.pcircle.ai/
- Benchmarks: https://toonify.pcircle.ai/benchmarks.html
- Privacidade: https://toonify.pcircle.ai/privacy.html
- Termos: https://toonify.pcircle.ai/terms.html
- [CHANGELOG.md](CHANGELOG.md)
