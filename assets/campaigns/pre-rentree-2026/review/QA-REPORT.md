# QA release candidate — Pré-rentrée 2026

## Identité

- PR : #74
- Branche : `feat/svt-integration-clean`
- SHA source inventorié : `25ce6e3d90039f74fb896afbab6310335bf63746`
- Date : 23 juillet 2026
- Statut maximal actuel : `READY_FOR_REVIEW`
- Verdict : `BLOCKED`

## Contrôles acquis

| Contrôle | Résultat |
|---|---:|
| Fondations maximum 6 / Premium maximum 5 | ✅ |
| Aucune SNT ou initiation informatique en Seconde | ✅ |
| NSI en Première et Terminale | ✅ |
| 15 modules × 5 séances = 75 séances | ✅ |
| Acompte + solde = prix canonique | ✅ |
| Modules Maths marqués PROPOSITION | ✅ |
| Programmes SVT filigranés DRAFT | ✅ |
| Formulation enseignants prudente | ✅ |
| Positionnement/bilan parent non validés masqués | ✅ |
| Calendrier J1…J29 sans date inventée | ✅ |
| 3 grilles dans le HTML initial | ✅ |
| Planning JSON ↔ PDF | ✅ |
| PDF rasterisés et planche contact inspectée | ✅ |
| Six téléchargements publics candidats synchronisés | ✅ |
| Scan détails d'infrastructure dans l'arbre courant | ✅ |
| Gate serveur fail-closed | ✅ |
| Site, API, téléchargements, SEO et préinscription masqués hors `PUBLIC_READY` | ✅ |
| Homepage et navigation sans lien vers la campagne fermée | ✅ |
| Tarification client dérivée du référentiel canonique | ✅ |

## Inventaire documentaire

- Semaine 1 : 91 assets.
- Campagne complète : 347 assets.
- Documents finaux : 9 PDF, 28 pages.
- Téléchargements publics candidats : 6.
- Inventaire public candidat : 317 fichiers, empreinte agrégée dans `release-inventory.json`.
- Sources, dossiers enseignants, QA, rendus intermédiaires et éléments internes : classés hors kit public.

## Contrôle visuel

La planche contact des 28 pages PDF a été inspectée : pas de page blanche, pas de débordement manifeste, tarifs sur une page, filigranes SVT visibles, drapeau PROPOSITION visible sur les modules Maths, coordonnées et marque lisibles. Les planches des publications, carrousels, Stories, Reels et calendriers ont été régénérées.

## Vérifications locales exécutées

Les contrôles suivants ont été exécutés sur un clone Git propre au SHA
`2b6abaa9a5f35aefdba42e55d41db5310a50c5b7`, puis les tests E2E d'état ont
été corrigés et rejoués au SHA `25ce6e3d90039f74fb896afbab6310335bf63746`.

| Commande | Résultat exact |
|---|---|
| `npm ci` | ✅ 1 272 paquets installés |
| `npm audit --omit=dev --audit-level=high` | ✅ 0 vulnérabilité |
| `npm run lint` | ✅ code 0 ; avertissements historiques, aucune erreur |
| `npm run typecheck` | ✅ code 0 |
| `npm test -- --runInBand` | ✅ 575 suites réussies, 1 ignorée ; 7 025 tests réussis, 4 ignorés ; 7 snapshots |
| `PLAYWRIGHT_BROWSERS_PATH=… npm run pre-rentree:ci` | ✅ 40 suites / 256 tests TypeScript ; 96 tests Python ; sécurité, build, audit, package et verify réussis |
| Reproductibilité documentaire | ✅ 33 fichiers comparés, 0 divergence |
| `npm run db:generate && npm run build` | ✅ Next.js 15.5.21 ; 144 pages statiques ; 4 416 fichiers standalone ; 534 fichiers statiques identiques |
| Validation standalone | ✅ empreinte source/standalone `7b936d6c0c123a29aea8cf690be718b7779760811e23acf35075b32b3d69d40e` |
| `npx playwright test` | ✅ 207 tests réussis en 5,3 min |
| `npm run test:e2e:teardown` | ✅ conteneur et réseau E2E supprimés |

Le premier passage Python sans `PLAYWRIGHT_BROWSERS_PATH` a produit
`95 passed, 1 failed` parce que Chromium n'était pas visible depuis le clone
propre. Le relancement complet avec l'exécutable déjà installé a produit
`96 passed` sans skip ni waiver.

Le premier passage Playwright complet a produit `202 passed, 8 failed` :
sept assertions exigeaient encore l'exposition de la campagne fermée et une
assertion tarifaire codait la capacité en dur. Après correction des tests
d'état et dérivation depuis le pricing canonique, le passage complet a produit
`207 passed`.

## Sorties documentaires vérifiées

- Package parents : 33 fichiers, 4 974 356 octets, SHA-256
  `4e222d50691d84731048f0b60619849674f0bbea50abfa6bc373e976c251f616`.
- Package revue : 312 fichiers, 42 837 326 octets, SHA-256
  `8a83313f12ee82ba5cf11828a7a1ff76788dbb1ef7b905fb4d3de5426896aefa`.
- Manifeste de revue : SHA-256
  `5e421d2fa33e05a77df582085ce144ea46d2ce96c90ba79e369f6d830fba9251`.
- Accessibilité navigateur documentaire : PASS.
- Secrets, chemins privés et copies de sources interdites : 0 finding.
- Distribution publique : non autorisée.

## Contrôles externes encore requis

- Push normal des commits locaux sur la branche de PR.
- Workflows GitHub verts sur le SHA poussé.
- Résolution des trois fils de revue après mise à disposition des correctifs.
- Relectures humaines et autorisation propriétaire ci-dessous.

## Gates humains ouverts

- Validation pédagogique Maths et SVT.
- Affectations et disponibilités des enseignants.
- Salles.
- Qualifications.
- Paiement et reçu.
- Annulation et remboursement.
- Confidentialité et rétention.
- Téléchargements.
- Téléphones, WhatsApp et formulaires.
- Manuels et remise annuelle.
- Autorisation écrite de publication par le propriétaire.

La date de lancement, la revue marketing/commerciale et le runbook
privé/rollback staging restent également à confirmer avant toute opération.

Un résultat technique vert ne transforme pas ce document en GO commercial.
