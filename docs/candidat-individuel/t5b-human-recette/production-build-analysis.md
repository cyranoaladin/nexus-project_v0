# Analyse — `npm run build` (§18 preuve technique) sur la baseline `ea7a86d88`

## Résumé

- `next build` (l'étape de compilation elle-même) : **PASS** — `✓ Compiled successfully in 60s`, aucune
  erreur de type, `.next/standalone/server.js` produit, la route `family-link` T5R2 présente dans le
  bundle.
- La suite locale complète (`npm run build` = `check-production-build-env.js && next build &&
  copy-public-assets.js && validate-next-traces.js && audit-production-artifact.js &&
  verify-standalone-artifact.mjs`) échoue à ses deux dernières portes **pour des raisons entièrement
  préexistantes, non liées à T5B (aucun changement de code n'a été fait), et sans rapport avec la
  correction produit** — détaillé ci-dessous.
- Le pipeline de production **réel** (build Docker via `Dockerfile.e2e`/`Dockerfile.prod`, qui embarque
  explicitement le moteur Prisma via `COPY --from=builder .../node_modules/.prisma`) a été exécuté avec
  succès à plusieurs reprises pendant cette même session T5B (campagne E2E 62/62 tests passés contre
  l'application ainsi construite) — c'est la preuve de production équivalente réellement autoritaire.

## Détail — 1) `validate-next-traces.js` : faux positifs ".worktrees directory"

Ce script traite tout chemin résolu contenant le segment `/.worktrees/` comme une erreur bloquante
(`scripts/validate-next-traces.js`, motif ajouté en `707e50f26`, antérieur à toute la lignée T3A→T5R2).
Comme cette mission construit systématiquement depuis un worktree dédié
(`.worktrees/t5b-human-recette/`), **toute** référence tracée vers un fichier légitimement possédé par
CE worktree (ex. `.next/standalone/docs/archive/...`, `.next/package.json`) contient nécessairement ce
segment de chemin — le contrôle ne distingue pas "fichier d'un AUTRE worktree" (la fuite qu'il est censé
détecter) de "fichier du worktree courant, dont le chemin absolu contient par construction le nom du
dossier `.worktrees`".

Preuve : une copie de vérification (hardlinks, lecture seule, jamais committée) recréée à la même
profondeur relative (`<tmp>/.worktrees/<nom>/`) avec le vrai `node_modules` partagé du dépôt racine
reproduit **exactement** les mêmes 121 670 "erreurs", toutes de motif `.worktrees directory`, zéro autre
motif — confirmant qu'il s'agit uniquement d'une correspondance de sous-chaîne sur le chemin, pas d'un
contenu incorrect. Ce même contrôle aurait échoué de façon identique pour T4/T5A/T5R/T5R2 (le motif
existait déjà sur leur propre baseline) — observation, pas un `T5B_FINDING` produit (ce n'est pas un
défaut du produit candidat-individuel, c'est un gap de l'outil de validation de build vis-à-vis de la
convention worktree utilisée par l'ensemble de cette mission).

## Détail — 2) `audit-production-artifact.js` : moteur Prisma `debian-openssl-3.0.x` absent du standalone local

`prisma/schema.prisma` déclare `binaryTargets = ["native", "debian-openssl-3.0.x"]`. Le moteur existe
bien dans le `node_modules/.prisma/client` partagé du dépôt racine (confirmé, fichier présent), mais
n'est PAS copié dans `.next/standalone/node_modules/.prisma/` par `next build` lui-même — cette copie est
effectuée explicitement par les Dockerfiles de production (`Dockerfile`, `Dockerfile.prod`,
`Dockerfile.e2e`, ligne `COPY --from=builder /app/node_modules/.prisma ./.prisma` ou équivalent), jamais
par le script `npm run build` exécuté nu sur une machine de développement. C'est le comportement attendu
et documenté (`db205b49a`, suite à l'incident `docs/archive/audits/2026-08-03-incident-
authentification.md`) : la vérification est correcte, mais s'applique à un artefact `.next/standalone`
qui n'a jamais été destiné à tourner seul hors de l'image Docker qui l'enrichit.

## Conclusion

Aucun des deux échecs n'est un `T5B_FINDING` (ni un défaut produit, ni une régression introduite par ce
lot — T5B n'a modifié aucun fichier de code). La preuve de production autoritaire pour cette baseline
reste la construction Docker (`Dockerfile.e2e`), déjà exécutée avec succès plusieurs fois dans cette
session (campagne canonique 62/62), et le `next build` local confirmé compilant sans erreur.
