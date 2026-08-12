# Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Plugin de compression de contexte pour Claude Code. Réduit automatiquement les grandes sorties d'outils—JSON, YAML, stack traces et logs—avant qu'elles n'entrent dans la fenêtre de contexte.

Fonctionne comme plugin Claude Code (automatique, sans configuration) ou comme serveur MCP (à la demande).

## Fonctionnalités

- Compresse les grandes réponses JSON, YAML et API
- Réduit les longs échecs de tests et les stack traces
- S'exécute automatiquement en arrière-plan—aucun changement de workflow requis

## Limitations

Ignoré pour les textes courts, les fichiers très petits et les contenus où le formatage exact doit être préservé.

## Installation

```bash
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp
npm install
npm run build
npm install -g .
toonify-mcp setup
toonify-mcp doctor
```

`toonify-mcp setup` ajoute le marketplace local et installe, met à jour ou réactive le plugin automatiquement.

## Vérification

```bash
toonify-mcp status
```

## Mode MCP (optionnel)

```bash
toonify-mcp setup mcp
claude mcp list
```

`claude mcp list` doit afficher `toonify: toonify-mcp - ✓ Connected`.

## Filtre pipe (n'importe quel CLI d'agent)

`toonify-mcp compress` lit stdin, compresse ce qui peut l'être sans risque (JSON/YAML → TOON, logs répétitifs repliés ; le code source, la prose et les nombres sensibles à la précision passent intacts) et écrit sur stdout. Il ne casse jamais un pipe—si la compression ne s'applique pas, l'entrée ressort octet pour octet.

```bash
curl -s https://api.example.com/users | toonify-mcp compress
```

Cela fonctionne avec n'importe quel CLI d'agent, car la sortie est compressée *avant* d'entrer dans le contexte du modèle. Pour qu'un agent l'adopte, ajoutez une règle aux instructions d'agent de votre projet (par ex. `AGENTS.md`) :

```markdown
When a command is likely to print large JSON/YAML or long logs,
pipe it through `toonify-mcp compress` (e.g. `curl ... | toonify-mcp compress`).
It only rewrites output it can compress losslessly; everything else passes through.
```

## OpenAI Codex CLI (à la demande)

```bash
toonify-mcp setup codex
```

Enregistre toonify comme serveur MCP dans `~/.codex/config.toml` (une sauvegarde horodatée du fichier est d'abord créée). Codex peut ensuite appeler l'outil `optimize_content` à la demande.

Note : sur Codex, c'est **à la demande, pas automatique**—les hooks de Codex ne peuvent pas encore remplacer la sortie des outils comme le fait `updatedToolOutput` de Claude Code, et ajouter une copie compressée ferait grossir le contexte au lieu de le réduire. Pour une compression automatique sur Codex, utilisez le filtre pipe ci-dessus.

## Documentation

- Site : https://toonify.pcircle.ai/
- Benchmarks : https://toonify.pcircle.ai/benchmarks.html
- Confidentialité : https://toonify.pcircle.ai/privacy.html
- Conditions : https://toonify.pcircle.ai/terms.html
- [CHANGELOG.md](CHANGELOG.md)
