# 06 — Plan de tests

Outils existants : Jest 29 (unitaire, intégration), Playwright 1.58 (e2e),
GitHub Actions (7 jobs : lint, typecheck, unit, integration, e2e, security, build).
Aucun nouvel outil n'est introduit.

## §1. Unitaire — `lib/positionnement/scoring.ts`

Cible : **100 % de branches** sur ce fichier. C'est le seul fichier du chantier soumis à ce niveau.

### 1.1 Cas dorés

`tests/positionnement/fixtures/golden-cases.json` : 6 cas entrée→sortie complets.

| Cas | Objet |
|---|---|
| `all-correct-confident` | plafond, `MAITRISE` partout, calibration 100 |
| `all-wrong-confident` | plancher, `ERREUR_CONFIANTE` partout, calibration 0, drapeaux levés |
| `all-wrong-unsure` | `LACUNE_CONSCIENTE`, calibration 100 malgré score 0 — dissocie niveau et calibration |
| `mixed-realistic` | cas représentatif, vérifie l'ordre de priorisation |
| `empty-attempt` | aucune réponse : score 0, couverture 0, `calibrationIndex = null` |
| `partial-coverage` | 50 % traité, lève `COUVERTURE_INSUFFISANTE` |

Ces fichiers sont **contractuels**. Une modification exige une bascule d'`engineVersion`
et une justification en ADR. Un diff sur ces fichiers dans une PR déclenche une revue obligatoire.

### 1.2 Tests unitaires ciblés

- Réussite par type d'item, y compris crédit partiel `QCM_MULTIPLE` et arrondi au quart
- Frontière `SUCCESS_THRESHOLD` : `0.74` échoue, `0.75` réussit
- Frontière `CONFIDENCE_THRESHOLD` : `2` bas, `3` haut
- Matrice complète des 4 profils + `NON_TRAITE`
- Les 3 règles de profil de nœud, y compris leurs égalités exactes
  (`m_EC == m_LC`, `m_M == m_MF`, `m_NT / W == 0.5`)
- Chaque bande de `groupBand` à ses bornes exactes : 39.9 / 40 / 64.9 / 65 / 84.9 / 85
- Chaque drapeau, levé et non levé
- Priorisation : tie-break `nodeId` vérifié en injectant deux nœuds strictement équivalents
- Normalisation `SHORT_TEXT` : accents, casse, espaces multiples, ponctuation terminale

### 1.3 Tests de propriété

- **Monotonie** — passer une réponse de fausse à juste ne diminue jamais `globalScore` ni `nodeScore`
- **Bornes** — `globalScore`, `nodeScore`, `coverage`, `calibrationIndex` ∈ [0, 100]
- **Déterminisme** — 100 exécutions sur la même entrée produisent des sorties strictement égales
- **Invariance à l'ordre** — permuter le tableau `answers` ne change pas la sortie
- **Absence de réseau** — le module ne doit importer ni `fetch`, ni client HTTP, ni SDK modèle.
  Vérifié par un test statique sur les imports.

## §2. Intégration — routes API

Base de test dédiée, migrations appliquées, jeu de données réinitialisé entre tests.

- **Idempotence de `submit`** — 2 appels concurrents ⇒ 1 seul `PositioningResult`, même contenu
- **Idempotence des réponses** — 2 `PUT` sur le même `itemId` ⇒ 1 seule ligne, la dernière gagne
- **Non-fuite** — `GET /attempts/current` ne contient jamais `answerKey`, `shortCorrection`,
  `nodeCpsId`. Test par inspection récursive de la réponse sérialisée, pas par assertion de champ.
- **Anti-énumération** — `POST /attempts` avec un e-mail connu et un e-mail inconnu :
  codes identiques, corps identiques, écart de latence sous seuil
- **Aucune création de `User`** — comptage de `User` avant/après un parcours public complet : inchangé
- **Contrainte `leadId XOR userId`** — les deux cas invalides sont rejetés
- **Matrice RBAC** — pour chaque route staff × chacun des 5 rôles, code attendu.
  Table exhaustive, pas d'échantillon.
- **États** — répondre sur une passation `SUBMITTED` ⇒ `409` ; sur `EXPIRED` ⇒ `410`
- **Limitation de débit** — dépassement ⇒ `429`

## §3. E2E Playwright

| Scénario | Assertions |
|---|---|
| Parcours complet lead → test → soumission → restitution élève | aucun score brut visible dans le DOM ; aucun compte créé |
| Reprise de passation après rechargement | réponses conservées, chronomètre cohérent |
| Lien parent expiré | message clair, aucune donnée exposée |
| Bilan parent non revu | inaccessible |
| Mobile 375 px sur chaque écran de passation | aucun débordement horizontal, cibles tactiles ≥ 44 px |
| Navigation clavier complète | test entièrement réalisable sans souris |

## §4. Garde éditoriale

`__tests__/bilans/lexique-interdit.test.ts` : génère les bilans des 6 cas dorés pour les trois
audiences et vérifie qu'aucune chaîne produite ne contient un terme de
`data/positionnement/lexique-interdit.json`. Vérifie aussi qu'un bilan `PARENT` ne contient
aucune séquence numérique interprétable comme un score (`\d{1,3}\s*(%|\/\s*20|\/\s*100)`).

## §5. Intégration CI

Étendre les jobs existants, ne pas en créer de nouveaux :

- `unit` : ajouter le chemin `tests/positionnement/**`, seuil de couverture spécifique
  à 100 % de branches sur `lib/positionnement/scoring.ts`
- `typecheck` : exécuter `scripts/positionnement/compile-bank.ts` **avant**, en mode strict
- `security` : ajouter la vérification statique d'absence d'import réseau dans `lib/positionnement/**`
- `e2e` : ajouter le projet Playwright `positionnement`

## §6. Critères de sortie du chantier

Aucun lot n'est déclaré terminé si l'un de ces points est rouge :

1. Les 6 cas dorés passent, sans modification depuis leur validation
2. Couverture de branches à 100 % sur le moteur
3. Matrice RBAC exhaustive verte
4. Zéro création de `User` sur le parcours public, prouvé par test
5. Zéro terme du lexique interdit dans une sortie générée
6. `lint`, `typecheck`, `test`, `build` verts
7. Aucun débordement horizontal mobile sur les écrans publics touchés
