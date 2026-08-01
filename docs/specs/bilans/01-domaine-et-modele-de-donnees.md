# 01 — Domaine et modèle de données

## 1. Vocabulaire

| Terme | Définition |
|---|---|
| **Test** | Gabarit publié : un niveau, une matière, une version. Immuable une fois publié. |
| **Item** | Une question. Rattachée à exactement un **nœud CPS**. |
| **Nœud CPS** | Prérequis structurant issu du pipeline existant (Cartes des Prérequis Structurants). Source de vérité externe à ce chantier. |
| **Passation** (`Attempt`) | Une exécution d'un test par une personne, à un instant donné. |
| **Réponse** (`Answer`) | Réponse à un item + confiance déclarée + temps passé. |
| **Résultat** (`Result`) | Sortie du moteur de scoring. Purement dérivé, recalculable. |
| **Bilan** | Restitution rédigée pour une audience donnée (élève / parent / Nexus). |

## 2. Principe directeur

`Result` et `Bilan` sont **dérivés et reproductibles**. À versions de moteur et de test identiques,
rejouer le scoring sur les mêmes `Answer` doit produire un `Result` bit-à-bit identique.
On stocke le résultat pour la performance et la traçabilité, jamais comme source de vérité unique :
`Answer` + `engineVersion` + `testVersion` suffisent à tout reconstruire.

## 3. Rattachement de la personne — contrainte critique

Le tunnel « bilan gratuit » est **lead-capture-first**. Une passation existe donc **sans compte utilisateur**.

- `Attempt.leadId` **ou** `Attempt.userId` est renseigné, jamais les deux, jamais aucun des deux.
- Aucun endpoint public ne crée de `User`.
- Le rattachement d'un `Lead` à un `User` créé plus tard se fait par un job côté staff, pas par le formulaire public.

## 4. Cycle de vie d'une passation

```
CREATED ──start──> IN_PROGRESS ──submit──> SUBMITTED ──score──> SCORED
   │                    │                                          │
   │                    └──expire (TTL)──> EXPIRED                  └──publish──> RESTITUTED
   └──abandon──> ABANDONED
```

Règles :

- `submit` est **idempotent** : un second appel renvoie le même `Result`, ne recalcule pas, ne duplique pas.
- `EXPIRED` après `ATTEMPT_TTL_MINUTES` sans soumission (voir `constants.ts`). Une passation expirée
  reste scorable côté staff avec le drapeau `partial: true`.
- Une seule passation `IN_PROGRESS` par (personne, test). Une nouvelle création clôt la précédente en `ABANDONED`.
- `RESTITUTED` n'est atteint qu'après génération d'au moins un `Bilan` d'audience `ELEVE` ou `PARENT`.

## 5. Entités

### 5.1 `PositioningTest`

| Champ | Type | Note |
|---|---|---|
| `id` | cuid | |
| `slug` | string unique | ex. `seconde-maths-v1` |
| `level` | enum `QUATRIEME, TROISIEME, SECONDE, PREMIERE, TERMINALE` | |
| `subject` | enum `MATHS, NSI, PC, SVT, FRANCAIS, PHILOSOPHIE` | extensible |
| `version` | int | incrémenté à chaque publication |
| `status` | enum `DRAFT, PUBLISHED, ARCHIVED` | |
| `targetDurationMin` | int | affiché à l'élève, indicatif |
| `itemIds` | string[] | ordre canonique de référence |
| `publishedAt` | datetime? | |

Un test `PUBLISHED` est **immuable**. Toute correction ⇒ nouvelle version + `ARCHIVED` de l'ancienne.
Les passations existantes restent rattachées à la version qu'elles ont réellement passée.

### 5.2 `PositioningItem`

| Champ | Type | Note |
|---|---|---|
| `id` | string stable | ex. `SEC-MAT-N03-01` — jamais réattribué |
| `nodeCpsId` | string | doit exister dans le CPS compilé, vérifié au build |
| `type` | enum `QCM_SIMPLE, QCM_MULTIPLE, NUMERIC, SHORT_TEXT` | |
| `difficulty` | int 1..3 | sert de poids dans l'agrégation |
| `statement` | string | énoncé, Markdown restreint |
| `options` | Option[]? | requis pour les types QCM |
| `answerKey` | json | forme dépendante du type, voir spec 03 |
| `tolerance` | float? | `NUMERIC` uniquement |
| `targetTimeSec` | int | indicatif, non bloquant |
| `shortCorrection` | string | 1 à 3 phrases, réutilisées dans le bilan élève |
| `tags` | string[] | |

### 5.3 `PositioningAttempt`

`id`, `accessToken` (opaque, 32 octets, unique, indexé), `testId`, `testVersion`,
`leadId?`, `userId?`, `context` (`BILAN_GRATUIT, STAGE, RENTREE, INTERNE`),
`status`, `seed` (int, dérivé de `accessToken`, fige l'ordre des options),
`startedAt?`, `submittedAt?`, `expiresAt`, `createdAt`.

### 5.4 `PositioningAnswer`

`attemptId`, `itemId`, `rawAnswer` (json), `confidence` (int 1..4, nullable si non traité),
`elapsedMs`, `answeredAt`. Clé unique `(attemptId, itemId)` — l'écriture est un **upsert idempotent**.

### 5.5 `PositioningResult`

`attemptId` (unique), `engineVersion`, `globalScore` (0..100, une décimale),
`calibrationIndex` (0..100 ou null), `coverage` (0..100),
`nodes` (json : tableau `NodeResult`), `flags` (string[]),
`groupBand` (enum), `computedAt`.

### 5.6 `PositioningBilan`

`attemptId`, `audience` (`ELEVE, PARENT, NEXUS`), `payload` (json structuré, pas de HTML),
`renderVersion`, `pdfPath?`, `generatedAt`, `reviewedBy?`, `reviewedAt?`.

Contrainte : un bilan d'audience `PARENT` n'est diffusable qu'après `reviewedAt` non nul
si `REQUIRE_HUMAN_REVIEW_PARENT` vaut `true` (valeur par défaut : `true`).

## 6. Index et contraintes

- `PositioningAttempt.accessToken` unique, indexé — c'est le chemin d'accès public.
- `(attemptId, itemId)` unique sur `PositioningAnswer`.
- `attemptId` unique sur `PositioningResult` (1-1).
- `(attemptId, audience)` unique sur `PositioningBilan`.
- Contrainte applicative vérifiée en Zod **et** au niveau service : `leadId XOR userId`.
  Prisma ne l'exprime pas nativement ; ajouter un `CHECK` en migration SQL brute.

## 7. Ce qui n'est pas dans ce chantier

- Le pipeline CPS (déjà existant) — consommé, pas modifié.
- La génération PDF elle-même — réutilise la chaîne éditoriale unifiée existante (spec 05 §4).
- Toute logique tarifaire ou de réservation de place.
