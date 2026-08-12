# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Plugin de compressão de contexto para Claude Code. Reduz automaticamente saídas grandes de ferramentas—JSON, YAML, stack traces e logs—antes de entrarem na janela de contexto.

Funciona como plugin do Claude Code (automático, sem configuração) ou como servidor MCP (sob demanda).

## Funcionalidades

- Comprime respostas grandes de JSON, YAML e APIs
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

## Filtro pipe (qualquer CLI de agente)

`toonify-mcp compress` lê da stdin, comprime o que é seguro comprimir (JSON/YAML → TOON, logs repetitivos são recolhidos; código-fonte, prosa e números sensíveis à precisão passam intactos) e escreve na stdout. Ele nunca quebra um pipe—quando a compressão não se aplica, a entrada sai byte a byte, sem alterações.

```bash
curl -s https://api.example.com/users | toonify-mcp compress
```

Isso funciona com qualquer CLI de agente, porque a saída é comprimida *antes* de entrar no contexto do modelo. Para que um agente adote isso, adicione uma regra às instruções de agente do seu projeto (por exemplo, `AGENTS.md`):

```markdown
When a command is likely to print large JSON/YAML or long logs,
pipe it through `toonify-mcp compress` (e.g. `curl ... | toonify-mcp compress`).
It only rewrites output it can compress losslessly; everything else passes through.
```

## OpenAI Codex CLI (sob demanda)

```bash
toonify-mcp setup codex
```

Registra o toonify como servidor MCP em `~/.codex/config.toml` (antes disso, é criado um backup do arquivo com carimbo de data/hora). O Codex pode então chamar a ferramenta `optimize_content` sob demanda.

Nota: no Codex isso é **sob demanda, não automático**—os hooks do Codex ainda não conseguem substituir a saída das ferramentas como o `updatedToolOutput` do Claude Code faz, e anexar uma cópia comprimida aumentaria o contexto em vez de reduzi-lo. Para compressão automática no Codex, use o filtro pipe acima.

## Documentação

- Site: https://toonify.pcircle.ai/
- Benchmarks: https://toonify.pcircle.ai/benchmarks.html
- Privacidade: https://toonify.pcircle.ai/privacy.html
- Termos: https://toonify.pcircle.ai/terms.html
- [CHANGELOG.md](CHANGELOG.md)
