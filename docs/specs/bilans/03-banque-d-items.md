# 03 — Banque d'items

## §1. Emplacement et pipeline

```
data/positionnement/<niveau>.<matiere>.v<N>.yaml     ← source de vérité éditoriale
        │  validation (JSON Schema + règles métier)
        ▼
data/positionnement/.compiled/<slug>.json            ← généré, non commité
        │  import typé
        ▼
lib/positionnement/banks.ts                          ← accès en lecture, généré
```

Le YAML est la **seule** source éditoriale. Aucun item écrit en dur dans du TSX.
La compilation est un script `scripts/positionnement/compile-bank.ts`, exécuté en CI
avant `typecheck`. Elle échoue au premier item invalide (pas de tolérance).

## §2. Règles de validation bloquantes

| # | Règle | Motif |
|---|---|---|
| V1 | `id` unique dans tout le dépôt, format `^[A-Z0-9]{3}-[A-Z]{3}-[A-Z0-9]{3,}-\d{2}$` | traçabilité des résultats historiques |
| V2 | `nodeCpsId` existe dans le CPS compilé du niveau visé | pas de nœud orphelin |
| V3 | `difficulty ∈ {1,2,3}` | pondération de la spec 02 §5 |
| V4 | 2 items minimum par nœud couvert, 6 maximum | un nœud à 1 item ne permet aucun profilage fiable |
| V5 | `QCM_SIMPLE` : 4 options, exactement 1 correcte | |
| V6 | `QCM_MULTIPLE` : 4 ou 5 options, 2 ou 3 correctes | |
| V7 | `NUMERIC` : `tolerance` présent et `>= 0` | |
| V8 | `SHORT_TEXT` : au moins 1 forme acceptée, toutes normalisées distinctes | |
| V9 | `shortCorrection` non vide, ≤ 320 caractères | réemployée telle quelle dans le bilan élève |
| V10 | aucun terme de `lexique-interdit.json` dans `statement`, `options`, `shortCorrection` | AGENTS.md |
| V11 | Σ `targetTimeSec` ≤ `targetDurationMin × 60` | cohérence de la durée annoncée |
| V12 | aucun nom propre d'enseignant, aucune marque tierce | |

## §3. Règles de conception (non bloquantes, revue humaine)

- **Un item teste un seul prérequis.** Un item qui échoue pour deux raisons possibles est ininterprétable.
- Les distracteurs d'un QCM correspondent à des **erreurs réelles observées**, pas à des options absurdes.
  C'est ce qui rend `ERREUR_CONFIANTE` diagnostique plutôt que décorative.
- Un item ne doit pas dépendre d'une notion enseignée **après** le nœud visé.
- Doctrine pédagogique Nexus : les items portent sur l'**intersection année N-1 / année N** —
  les nœuds sans lesquels les premières semaines de l'année N sont inaccessibles.
  Ni révision générale de l'année écoulée, ni anticipation du programme complet.
- Longueur cible : 18 à 24 items par test, 20 à 30 minutes.

## §4. Format YAML

Voir le gabarit complet et commenté : `data/positionnement/seconde.maths.v1.yaml`.
Schéma machine : `data/positionnement/item.schema.json`.

Squelette :

```yaml
slug: seconde-maths-v1
level: SECONDE
subject: MATHS
version: 1
status: DRAFT
targetDurationMin: 25
items:
  - id: SEC-MAT-N03-01
    nodeCpsId: sec.maths.calcul-litteral.developpement
    type: QCM_SIMPLE
    difficulty: 2
    targetTimeSec: 60
    statement: "..."
    options:
      - { key: A, label: "...", correct: false }
      - { key: B, label: "...", correct: true }
    shortCorrection: "..."
    tags: [calcul-litteral]
```

## §5. Versionnement

- Tant que `status: DRAFT`, le fichier est librement modifiable.
- Au passage en `PUBLISHED`, le fichier est **gelé**. Toute correction ⇒ `v<N+1>`,
  l'ancien fichier passe en `status: ARCHIVED` et reste dans le dépôt.
- Un `id` d'item retiré n'est **jamais** réattribué à un autre contenu : les résultats
  historiques y font référence.

## §6. Couverture minimale par niveau (jalon L2)

| Niveau | Matières prioritaires | Motif |
|---|---|---|
| 3e | Maths, Français | offre Brevet Complet, volume le plus large |
| Seconde | Maths | pivot des parcours Sciences et Fondations |
| Première | Maths, Français (EAF) | Cap EAF et Maths anticipées |
| Terminale | Maths, Maths expertes, PC, SVT, NSI, Philosophie | contrainte de blocs à respecter |
| 4e | Maths, Français | ouverture à partir de 4 élèves |

**Point de vigilance à remonter** : la production d'items Terminale NSI dépend du recrutement
de l'intervenant NSI dédié, lui-même lié au conflit de blocs Fenêtre 2. Ne pas bloquer L2 dessus :
livrer NSI en dernier.
