# 🎯 Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Servidor MCP + Plugin Claude Code fornecendo otimização automática de tokens para dados estruturados **e código-fonte**.
Reduz o uso de tokens da API do Claude em **25-66%** em JSON/CSV/YAML e **20-48%** em código-fonte TypeScript/Python/Go através de uma arquitetura pipeline.

## Novidades na v0.6.0

✨ **Arquitetura pipeline + compressão de código!**
- ✅ **Motor pipeline** — arquitetura modular Detector → Router → Compressor → Evaluator
- ✅ **Compressão de código** — TypeScript (37%), Python (48%), Go (32%) de economia através de remoção heurística de comentários/espaços em branco
- ✅ **6 camadas de compressão** — de segura (linhas em branco, comentários inline) a agressiva (sumarização de imports, colapso de padrões repetitivos)
- ✅ **Hook atualizado** — hook PostToolUse agora comprime código-fonte além de dados estruturados
- ✅ Design extensível — adicione novos formatos implementando uma única interface `Compressor`
- ✅ Compatibilidade total com versões anteriores — todas as APIs externas inalteradas
- ✅ 196 testes (antes 157), revisão de código abrangente aprovada

## Recursos

- **Redução de 25-66% de Tokens** (tipicamente ~48%) para dados JSON, CSV, YAML
- **Compressão de Código de 20-48%** para código-fonte TypeScript, Python, Go
- **Arquitetura Pipeline** - Motor extensível Detector → Compressor → Evaluator
- **Suporte Multilíngue** - Contagem precisa de tokens para mais de 15 idiomas
- **Totalmente Automático** - Hook PostToolUse intercepta resultados de ferramentas
- **Configuração Zero** - Funciona imediatamente com padrões sensatos
- **Modo Duplo** - Funciona como Plugin (automático) ou Servidor MCP (manual)
- **Métricas Integradas** - Rastreie economia de tokens localmente
- **Fallback Silencioso** - Nunca quebra seu fluxo de trabalho

## Instalação

### Opção A: Baixar do GitHub (Recomendado) 🌟

**Instalação direta do repositório GitHub (sem necessidade de npm publish):**

```bash
# 1. Baixar o repositório
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp

# 2. Instalar dependências e compilar
npm install
npm run build

# 3. Instalar globalmente a partir da fonte local
npm install -g .
```

### Opção B: Instalar via Claude Marketplaces (se disponível) 🌟

**Instalação com um clique:**

Abra [Claude Marketplaces](https://claudemarketplaces.com) no Claude Code e instale `toonify-mcp` com um clique quando a distribuição por marketplace estiver disponível no seu ambiente.

### Opção C: Plugin Claude Code (Recomendado) ⭐

**Otimização automática de tokens sem chamadas manuais:**

Pré-requisito: conclua a opção A ou B para que o binário `toonify-mcp` esteja disponível.

```bash
# 1. Adicionar como plugin (modo automático)
claude plugin add toonify-mcp

# 2. Verificar instalação
claude plugin list
# Deve mostrar: toonify-mcp ✓
```

**É isso!** O hook PostToolUse agora interceptará e otimizará automaticamente dados estruturados do Read, Grep e outras ferramentas de arquivo.

### Opção D: Servidor MCP (Modo manual)

**Para controle explícito ou clientes MCP não-Claude Code:**

Pré-requisito: conclua a opção A ou B para que o binário `toonify-mcp` esteja disponível.

```bash
# 1. Registrar como servidor MCP
claude mcp add toonify -- toonify-mcp

# 2. Verificar
claude mcp list
# Deve mostrar: toonify: toonify-mcp - ✓ Connected
```

Então chame as ferramentas explicitamente:
```bash
claude mcp call toonify optimize_content '{"content": "..."}'
claude mcp call toonify get_stats '{}'
```

## Como Funciona

### Modo Plugin (Automático)

```
Usuário: Ler arquivo JSON grande
  ↓
Claude Code chama ferramenta Read
  ↓
Hook PostToolUse intercepta resultado
  ↓
Hook detecta JSON, converte para TOON
  ↓
Conteúdo otimizado enviado à API Claude
  ↓
Redução típica de ~48% de tokens alcançada ✨
```

### Modo Servidor MCP (Manual)

```
Usuário: chama explicitamente mcp__toonify__optimize_content
  ↓
Conteúdo convertido para formato TOON
  ↓
Retorna resultado otimizado
```

## Configuração

Crie `~/.claude/toonify-config.json` (opcional):

```json
{
  "enabled": true,
  "minTokensThreshold": 50,
  "minSavingsThreshold": 30,
  "skipToolPatterns": ["Bash", "Write", "Edit"]
}
```

### Opções

- **enabled**: Habilitar/desabilitar otimização automática (padrão: `true`)
- **minTokensThreshold**: Tokens mínimos antes da otimização (padrão: `50`)
- **minSavingsThreshold**: Porcentagem mínima de economia necessária (padrão: `30%`)
- **skipToolPatterns**: Ferramentas que nunca serão otimizadas (padrão: `["Bash", "Write", "Edit"]`)

### Variáveis de Ambiente

```bash
export TOONIFY_ENABLED=true
export TOONIFY_MIN_TOKENS=50
export TOONIFY_MIN_SAVINGS=30
export TOONIFY_SKIP_TOOLS="Bash,Write"
export TOONIFY_SHOW_STATS=true  # Mostrar estatísticas de otimização na saída
```

## Exemplos

### Antes da Otimização (142 tokens)

```json
{
  "products": [
    {"id": 101, "name": "Laptop Pro", "price": 1299},
    {"id": 102, "name": "Magic Mouse", "price": 79}
  ]
}
```

### Depois da Otimização (57 tokens, -60%)

```
[TOON-JSON]
products[2]{id,name,price}:
  101,Laptop Pro,1299
  102,Magic Mouse,79
```

**Aplicado automaticamente no modo Plugin - não são necessárias chamadas manuais!**

## Dicas de Uso

### Quando a Otimização Automática é Acionada?

O hook PostToolUse otimiza automaticamente quando:
- ✅ Conteúdo é JSON, CSV ou YAML válido
- ✅ Tamanho do conteúdo ≥ `minTokensThreshold` (padrão: 50 tokens)
- ✅ Economia estimada ≥ `minSavingsThreshold` (padrão: 30%)
- ✅ Ferramenta NÃO está em `skipToolPatterns` (ex: não Bash/Write/Edit)

### Visualizar Estatísticas de Otimização

```bash
# No modo Plugin
claude mcp call toonify get_stats '{}'

# Ou verifique a saída do Claude Code para estatísticas (se TOONIFY_SHOW_STATS=true)
```

## Solução de Problemas

### Hook Não Está Sendo Acionado

```bash
# 1. Verificar se o plugin está instalado
claude plugin list | grep toonify

# 2. Verificar configuração
cat ~/.claude/toonify-config.json

# 3. Habilitar estatísticas para ver tentativas de otimização
export TOONIFY_SHOW_STATS=true
```

### Otimização Não Aplicada

- Verifique `minTokensThreshold` - conteúdo pode ser muito pequeno
- Verifique `minSavingsThreshold` - economia pode ser < 30%
- Verifique `skipToolPatterns` - ferramenta pode estar na lista de exclusão
- Verifique se o conteúdo é JSON/CSV/YAML válido

### Problemas de Desempenho

- Reduza `minTokensThreshold` para otimizar mais agressivamente
- Aumente `minSavingsThreshold` para pular otimizações marginais
- Adicione mais ferramentas a `skipToolPatterns` se necessário

## Comparação: Plugin vs Servidor MCP

| Recurso | Modo Plugin | Modo Servidor MCP |
|---------|------------|-----------------|
| **Ativação** | Automática (PostToolUse) | Manual (chamar ferramenta) |
| **Compatibilidade** | Apenas Claude Code | Qualquer cliente MCP |
| **Configuração** | Arquivo de config do plugin | Ferramentas MCP |
| **Desempenho** | Overhead zero | Overhead de chamada |
| **Caso de Uso** | Fluxo de trabalho diário | Controle explícito |

**Recomendação**: Use o modo Plugin para otimização automática. Use o modo Servidor MCP para controle explícito ou outros clientes MCP.

## Desinstalar

### Modo Plugin
```bash
claude plugin remove toonify-mcp
rm ~/.claude/toonify-config.json
```

### Modo Servidor MCP
```bash
claude mcp remove toonify
```

### Pacote
```bash
npm uninstall -g toonify-mcp
```

## Links

- **Docs**: https://toonify.pcircle.ai/
- **GitHub**: https://github.com/PCIRCLE-AI/toonify-mcp
- **Issues**: https://github.com/PCIRCLE-AI/toonify-mcp/issues
- **MCP Docs**: https://code.claude.com/docs/mcp
- **TOON Format**: https://github.com/toon-format/toon

## Contribuindo

Contribuições são bem-vindas! Por favor, consulte [CONTRIBUTING.md](CONTRIBUTING.md) para diretrizes.

## Suporte

Para ajuda de instalação, relatos de bugs e caminhos de contato comercial, consulte [SUPPORT.md](SUPPORT.md).

## Segurança

Reporte vulnerabilidades em particular conforme descrito em [SECURITY.md](SECURITY.md).

## Licença

Licença MIT - veja [LICENSE](LICENSE)

Para o histórico de releases, consulte [CHANGELOG.md](CHANGELOG.md).
