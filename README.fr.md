# 🎯 Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Serveur MCP + Plugin Claude Code offrant une optimisation automatique des tokens pour les données structurées **et le code source**.
Réduit l'utilisation des tokens de l'API Claude de **25-66 %** sur JSON/CSV/YAML et **20-48 %** sur le code source TypeScript/Python/Go grâce à une architecture pipeline.

## Nouveautés de la v0.6.0

✨ **Architecture pipeline + compression de code !**
- ✅ **Moteur pipeline** — architecture modulaire Detector → Router → Compressor → Evaluator
- ✅ **Compression de code** — TypeScript (37 %), Python (48 %), Go (32 %) via suppression heuristique de commentaires/espaces
- ✅ **6 couches de compression** — fusion de lignes vides, suppression de commentaires inline, raccourcissement des imports, résumé des imports, repli des motifs répétitifs
- ✅ **Hook amélioré** — le hook PostToolUse compresse désormais le code source en plus des données structurées
- ✅ Conception extensible — ajoutez de nouveaux formats en implémentant l'interface `Compressor`
- ✅ Compatibilité totale ascendante — toutes les APIs externes inchangées
- ✅ 196 tests (contre 157 auparavant), revue de code exhaustive validée

## Fonctionnalités

- **Réduction de 25-66 % des tokens** (typiquement ~48 %) pour les données JSON, CSV, YAML
- **Compression de code de 20-48 %** pour le code source TypeScript, Python, Go
- **Architecture pipeline** - Moteur extensible Detector → Compressor → Evaluator
- **Support multilingue** - Comptage précis des tokens pour plus de 15 langues
- **Entièrement automatique** - Le hook PostToolUse intercepte les résultats des outils
- **Zéro configuration** - Fonctionne immédiatement avec des paramètres par défaut sensés
- **Mode double** - Fonctionne comme Plugin (auto) ou serveur MCP (manuel)
- **Métriques intégrées** - Suivez les économies de tokens localement
- **Repli silencieux** - Ne perturbe jamais votre flux de travail

## Installation

### Option A : Télécharger depuis GitHub (Recommandé) 🌟

**Installation directe depuis le dépôt GitHub (pas de publication npm requise) :**

```bash
# 1. Télécharger le dépôt
git clone https://github.com/PCIRCLE-AI/toonify-mcp.git
cd toonify-mcp

# 2. Installer les dépendances et compiler
npm install
npm run build

# 3. Installer globalement depuis la source locale
npm install -g .
```

### Option B : Installer via Claude Marketplaces (si disponible) 🌟

**Installation en un clic :**

Accédez à [Claude Marketplaces](https://claudemarketplaces.com) dans Claude Code et installez `toonify-mcp` en un clic si la distribution via marketplace est disponible dans votre environnement.

### Option C : Plugin Claude Code (Recommandé) ⭐

**Optimisation automatique des tokens sans appels manuels :**

Prérequis : terminer l'option A ou B pour que le binaire `toonify-mcp` soit disponible.

```bash
# 1. Ajouter comme plugin (mode automatique)
claude plugin add toonify-mcp

# 2. Vérifier l'installation
claude plugin list
# Devrait afficher : toonify-mcp ✓
```

**C'est tout !** Le hook PostToolUse interceptera et optimisera automatiquement les données structurées provenant de Read, Grep et d'autres outils de fichiers.

### Option D : Serveur MCP (Mode manuel)

**Pour un contrôle explicite ou d'autres clients MCP :**

Prérequis : terminer l'option A ou B pour que le binaire `toonify-mcp` soit disponible.

```bash
# 1. Enregistrer comme serveur MCP
claude mcp add toonify -- toonify-mcp

# 2. Vérifier
claude mcp list
# Devrait afficher : toonify: toonify-mcp - ✓ Connected
```

Ensuite, appelez les outils explicitement :
```bash
claude mcp call toonify optimize_content '{"content": "..."}'
claude mcp call toonify get_stats '{}'
```

## Comment ça marche

### Mode Plugin (Automatique)

```
Utilisateur : Lire un gros fichier JSON
  ↓
Claude Code appelle l'outil Read
  ↓
Le hook PostToolUse intercepte le résultat
  ↓
Le hook détecte le JSON, convertit en TOON
  ↓
Contenu optimisé envoyé à l'API Claude
  ↓
Réduction de 25-66 % (typiquement ~48 %) des tokens obtenue ✨
```

### Mode Serveur MCP (Manuel)

```
Utilisateur : appelle explicitement mcp__toonify__optimize_content
  ↓
Contenu converti au format TOON
  ↓
Retourne le résultat optimisé
```

## Configuration

Créez `~/.claude/toonify-config.json` (optionnel) :

```json
{
  "enabled": true,
  "minTokensThreshold": 50,
  "minSavingsThreshold": 30,
  "skipToolPatterns": ["Bash", "Write", "Edit"]
}
```

### Options

- **enabled** : Activer/désactiver l'optimisation automatique (par défaut : `true`)
- **minTokensThreshold** : Nombre minimum de tokens avant optimisation (par défaut : `50`)
- **minSavingsThreshold** : Pourcentage minimum d'économies requis (par défaut : `30%`)
- **skipToolPatterns** : Outils à ne jamais optimiser (par défaut : `["Bash", "Write", "Edit"]`)

### Variables d'environnement

```bash
export TOONIFY_ENABLED=true
export TOONIFY_MIN_TOKENS=50
export TOONIFY_MIN_SAVINGS=30
export TOONIFY_SKIP_TOOLS="Bash,Write"
export TOONIFY_SHOW_STATS=true  # Afficher les statistiques d'optimisation dans la sortie
```

## Exemples

### Avant optimisation (142 tokens)

```json
{
  "products": [
    {"id": 101, "name": "Laptop Pro", "price": 1299},
    {"id": 102, "name": "Magic Mouse", "price": 79}
  ]
}
```

### Après optimisation (57 tokens, -60 %)

```
[TOON-JSON]
products[2]{id,name,price}:
  101,Laptop Pro,1299
  102,Magic Mouse,79
```

**Appliqué automatiquement en mode Plugin - aucun appel manuel nécessaire !**

## Conseils d'utilisation

### Quand l'optimisation automatique se déclenche-t-elle ?

Le hook PostToolUse optimise automatiquement lorsque :
- ✅ Le contenu est un JSON, CSV ou YAML valide
- ✅ La taille du contenu ≥ `minTokensThreshold` (par défaut : 50 tokens)
- ✅ Les économies estimées ≥ `minSavingsThreshold` (par défaut : 30 %)
- ✅ L'outil n'est PAS dans `skipToolPatterns` (par ex., pas Bash/Write/Edit)

### Voir les statistiques d'optimisation

```bash
# En mode Plugin
claude mcp call toonify get_stats '{}'

# Ou vérifier la sortie de Claude Code pour les statistiques (si TOONIFY_SHOW_STATS=true)
```

## Dépannage

### Le hook ne se déclenche pas

```bash
# 1. Vérifier que le plugin est installé
claude plugin list | grep toonify

# 2. Vérifier la configuration
cat ~/.claude/toonify-config.json

# 3. Activer les statistiques pour voir les tentatives d'optimisation
export TOONIFY_SHOW_STATS=true
```

### L'optimisation n'est pas appliquée

- Vérifiez `minTokensThreshold` - le contenu pourrait être trop petit
- Vérifiez `minSavingsThreshold` - les économies pourraient être < 30 %
- Vérifiez `skipToolPatterns` - l'outil pourrait être dans la liste d'exclusion
- Vérifiez que le contenu est un JSON/CSV/YAML valide

### Problèmes de performance

- Réduisez `minTokensThreshold` pour optimiser de manière plus agressive
- Augmentez `minSavingsThreshold` pour ignorer les optimisations marginales
- Ajoutez plus d'outils à `skipToolPatterns` si nécessaire

## Comparaison : Plugin vs Serveur MCP

| Fonctionnalité | Mode Plugin | Mode Serveur MCP |
|----------------|-------------|------------------|
| **Activation** | Automatique (PostToolUse) | Manuelle (appel d'outil) |
| **Compatibilité** | Claude Code uniquement | Tout client MCP |
| **Configuration** | Fichier de configuration du plugin | Outils MCP |
| **Performance** | Aucun surcoût | Surcoût d'appel |
| **Cas d'usage** | Flux de travail quotidien | Contrôle explicite |

**Recommandation** : Utilisez le mode Plugin pour l'optimisation automatique. Utilisez le mode Serveur MCP pour un contrôle explicite ou d'autres clients MCP.

## Désinstallation

### Mode Plugin
```bash
claude plugin remove toonify-mcp
rm ~/.claude/toonify-config.json
```

### Mode Serveur MCP
```bash
claude mcp remove toonify
```

### Package
```bash
npm uninstall -g toonify-mcp
```

## Liens

- **Docs** : https://toonify.pcircle.ai/
- **GitHub** : https://github.com/PCIRCLE-AI/toonify-mcp
- **Issues** : https://github.com/PCIRCLE-AI/toonify-mcp/issues
- **Documentation MCP** : https://code.claude.com/docs/mcp
- **Format TOON** : https://github.com/toon-format/toon

## Contribution

Les contributions sont les bienvenues ! Veuillez consulter [CONTRIBUTING.md](CONTRIBUTING.md) pour les directives.

## Support

Pour l'aide à l'installation, les signalements de bugs et les contacts commerciaux, consultez [SUPPORT.md](SUPPORT.md).

## Sécurité

Veuillez signaler les vulnérabilités en privé comme décrit dans [SECURITY.md](SECURITY.md).

## Licence

Licence MIT - voir [LICENSE](LICENSE)

Pour l'historique des versions, consultez [CHANGELOG.md](CHANGELOG.md).
