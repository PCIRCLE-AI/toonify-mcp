# 🎯 Toonify MCP

**[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [한국어](README.ko.md) | [Русский](README.ru.md) | [Português](README.pt.md) | [Tiếng Việt](README.vi.md) | [Bahasa Indonesia](README.id.md)**

Serveur MCP + Plugin Claude Code offrant une optimisation automatique des tokens pour les données structurées.
Réduit l'utilisation des tokens de l'API Claude de **30 à 65 % selon la structure des données** grâce à la conversion transparente au format TOON, avec des économies typiques de **50 à 55 %** pour les données structurées.

## Nouveautés de la v0.5.0

✨ **Mises à jour SDK et tooling !**
- ✅ SDK MCP mis à jour vers la branche 1.25.x
- ✅ Dépendances tokenizer et YAML mises à jour
- ✅ Migration vers Jest 30 avec transformation ESM TypeScript via SWC
- ✅ Correctifs de sécurité appliqués via npm audit

## Fonctionnalités

- **Réduction de 30 à 65 % des tokens** (typiquement 50 à 55 %) pour les données JSON, CSV, YAML
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

### Option B : Installer depuis le marketplace pcircle.ai (Le plus facile) 🌟

**Installation en un clic :**

Accédez au [marketplace pcircle.ai](https://claudemarketplaces.com) dans Claude Code et installez toonify-mcp en un clic. Le marketplace gère tout automatiquement !

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
Réduction typique de 50 à 55 % des tokens obtenue ✨
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

- **GitHub** : https://github.com/PCIRCLE-AI/toonify-mcp
- **Issues** : https://github.com/PCIRCLE-AI/toonify-mcp/issues
- **GitHub** : https://github.com/PCIRCLE-AI/toonify-mcp
- **Documentation MCP** : https://code.claude.com/docs/mcp
- **Format TOON** : https://github.com/toon-format/toon

## Contribution

Les contributions sont les bienvenues ! Veuillez consulter [CONTRIBUTING.md](CONTRIBUTING.md) pour les directives.

## Licence

Licence MIT - voir [LICENSE](LICENSE)

---

## Journal des modifications

### v0.5.0 (2026-01-21)
- ✨ **Mises à jour SDK et tooling** - SDK MCP, tokenizer et YAML mis à jour
- ✨ Migration vers Jest 30 avec transformation ESM TypeScript via SWC
- 🔒 Correctifs de sécurité via npm audit

### v0.3.0 (2025-12-26)
- ✨ **Optimisation multilingue des tokens** - comptage précis pour plus de 15 langues
- ✨ Multiplicateurs de tokens adaptés aux langues (2x chinois, 2,5x japonais, 3x arabe, etc.)
- ✨ Détection et optimisation des textes multilingues
- ✨ Tests de référence complets avec statistiques réelles
- 📊 Revendications d'économies de tokens basées sur des données (plage de 30 à 65 %, typiquement 50 à 55 %)
- ✅ Plus de 75 tests réussis, y compris les cas limites multilingues
- 📝 Versions multilingues du README

### v0.2.0 (2025-12-25)
- ✨ Ajout du support du Plugin Claude Code avec hook PostToolUse
- ✨ Optimisation automatique des tokens (aucun appel manuel nécessaire)
- ✨ Système de configuration du plugin
- ✨ Mode double : Plugin (auto) + Serveur MCP (manuel)
- 📝 Mise à jour complète de la documentation

### v0.1.1 (2024-12-24)
- 🐛 Corrections de bugs et améliorations
- 📝 Mises à jour de la documentation

### v0.1.0 (2024-12-24)
- 🎉 Version initiale
- ✨ Implémentation du serveur MCP
- ✨ Optimisation au format TOON
- ✨ Suivi des métriques intégré
