# 🎯 Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Servidor MCP + Plugin Claude Code fornecendo otimização automática de tokens para dados estruturados.
Reduz o uso de tokens da API do Claude em **30-65% dependendo da estrutura de dados** através da conversão transparente para o formato TOON, com economias típicas de **50-55%** para dados estruturados.

## Novidades na v0.5.0

✨ **Atualizações de SDK e tooling!**
- ✅ SDK MCP atualizado para a linha 1.25.x
- ✅ Dependências de tokenizer e YAML atualizadas
- ✅ Migração para Jest 30 com transform ESM de TypeScript via SWC
- ✅ Correções de segurança aplicadas via npm audit

## Recursos

- **Redução de 30-65% de Tokens** (tipicamente 50-55%) para dados JSON, CSV, YAML
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

### Opção B: Instalar do marketplace pcircle.ai (Mais fácil) 🌟

**Instalação com um clique:**

Navegue até o [marketplace pcircle.ai](https://claudemarketplaces.com) no Claude Code e instale toonify-mcp com um clique. O marketplace cuida de tudo automaticamente!

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
Redução típica de 50-55% de tokens alcançada ✨
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

- **GitHub**: https://github.com/PCIRCLE-AI/toonify-mcp
- **Issues**: https://github.com/PCIRCLE-AI/toonify-mcp/issues
- **GitHub**: https://github.com/PCIRCLE-AI/toonify-mcp
- **MCP Docs**: https://code.claude.com/docs/mcp
- **TOON Format**: https://github.com/toon-format/toon

## Contribuindo

Contribuições são bem-vindas! Por favor, consulte [CONTRIBUTING.md](CONTRIBUTING.md) para diretrizes.

## Licença

Licença MIT - veja [LICENSE](LICENSE)

---

## Changelog

### v0.5.0 (2026-01-21)
- ✨ **Atualizações de SDK e tooling** - SDK MCP, tokenizer e YAML atualizados
- ✨ Migração para Jest 30 com transform ESM de TypeScript via SWC
- 🔒 Correções de segurança via npm audit

### v0.3.0 (2025-12-26)
- ✨ **Otimização multilíngue de tokens** - contagem precisa para mais de 15 idiomas
- ✨ Multiplicadores de tokens conscientes do idioma (2x chinês, 2.5x japonês, 3x árabe, etc.)
- ✨ Detecção e otimização de texto em idiomas mistos
- ✨ Testes de benchmark abrangentes com estatísticas reais
- 📊 Alegações de economia de tokens baseadas em dados (faixa de 30-65%, tipicamente 50-55%)
- ✅ Mais de 75 testes passando, incluindo casos extremos multilíngues
- 📝 Versões multilíngues do README

### v0.2.0 (2025-12-25)
- ✨ Adicionado suporte a Plugin Claude Code com hook PostToolUse
- ✨ Otimização automática de tokens (não são necessárias chamadas manuais)
- ✨ Sistema de configuração de plugin
- ✨ Modo duplo: Plugin (automático) + Servidor MCP (manual)
- 📝 Atualização abrangente da documentação

### v0.1.1 (2024-12-24)
- 🐛 Correções de bugs e melhorias
- 📝 Atualizações de documentação

### v0.1.0 (2024-12-24)
- 🎉 Lançamento inicial
- ✨ Implementação do Servidor MCP
- ✨ Otimização de formato TOON
- ✨ Rastreamento de métricas integrado
