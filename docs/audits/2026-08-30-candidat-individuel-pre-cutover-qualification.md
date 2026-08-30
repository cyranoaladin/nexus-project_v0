# Qualification pre-cutover - candidat individuel

## Date

2026-08-30 (Africa/Tunis)

## Provenance

- SOURCE_SHA: `66516243d02226661bdf9f322349ebc8b066d371`
- QUALIFICATION_TEST_SHA: `608fdfad7eeed4b7ee715110472e8926a7091016`
- PRODUCTION_BASE_SHA: `ca2b86efa0c552277bc3a98c03c3944be8459835`
- Branche: `fix/candidat-individuel-contextual-student-workflow`
- Migration Prisma: 88 avant, 0 ajoutee, 88 apres
- Production modifiee: non

## Environnements

- Qualification locale: Node.js `22.22.0`, npm `10.9.8`
- Build et E2E Docker: Node.js `22.23.1`, npm `10.9.8`
- PostgreSQL jetable: `15.15`
- Next.js: `15.5.21`
- Prisma: `6.19.3`
- Playwright Docker: `1.58.2`, Chromium

## Resultats

| Gate | Resultat |
| --- | --- |
| TypeScript | PASS |
| Lint | PASS, aucune nouvelle erreur; warnings candidat-libre preexistants |
| Unit complet | PASS, 939 suites / 10 402 tests / 29 snapshots |
| Composants et helpers cibles | PASS, 95 tests |
| DB | PASS, 12 suites / 203 tests sur deux bases fraiches |
| Integration | PASS, 45 suites / 318 tests |
| Syntaxe et quarantaine E2E | PASS, 2 697 fichiers, aucun focus/quarantaine inconditionnelle |
| E2E candidat individuel | PASS, 29 / 29 |
| E2E prod-shaped | PASS |
| R1 / R2 | PASS |
| Family link / rotation / PDF | PASS |
| V1 freeze / deferred | PASS |
| Securite PR180 source | PASS, 88 529 fichiers, 0 artefact interdit |
| Build production standalone | PASS |
| Audit artefact | PASS, 588 fichiers statiques/standalone, 0 artefact interdit |
| Console navigateur applicative | PASS, 0 erreur application, 0 HTTP inattendu, 0 echec reseau inattendu |

Le runner DB complet partage un etat de schema entre suites et expose une contamination d'ordre preexistante sur les triggers canoniques. La qualification a donc execute la suite canonique (14 tests) et les autres suites DB (189 tests) sur deux bases PostgreSQL fraiches, soit 203 tests passes sans masquer ni ignorer de test.

## Commandes de qualification

```text
npm run typecheck
npm run lint
npm run test -- --runInBand
npm run check:e2e-syntax
npm run security:repo
tests DB sur deux bases PostgreSQL 15 fraiches, 88 migrations appliquees
tests integration sur une base PostgreSQL 15 fraiche
npm run build
audit de l'artefact standalone et scanner d'artefacts interdits
PLAYWRIGHT_ARGS='e2e/auth/candidat-individuel-pipeline.spec.ts --project=chromium' npm run test:e2e:ephemeral
```

## Artefact qualifie

- Build ID: `yD7lcgBgu309tsqicOUjc`
- RELEASE_SHA embarque: `66516243d02226661bdf9f322349ebc8b066d371`
- Empreinte SHA-256 de l'arbre standalone/statique: `e6c8289d3abd68431159858caa1e3684531cda87d78dfe50224c8ad782110b19`
- Standalone attendu: `.next/standalone/server.js` present

## Confidentialite du transit eleve

- Aucun `Student.id` dans l'URL du workflow candidat individuel.
- Aucun `Student.id` observe dans Google Analytics/dataLayer, les en-tetes, le referrer ou la console.
- Le handoff same-tab utilise `sessionStorage`, est consomme et supprime avant resolution autoritative.
- L'API `identity/resolve` recoit l'identifiant uniquement dans le corps POST; aucun log applicatif ne l'enregistre.

## Risques restants

- P1-A reste ouvert et doit etre trace dans le Chrome reel de la direction sur la production `ca2b86efa...` avant cutover.
- P1-B est corrige dans le RC, pas encore ferme en production.
- Le bruit tiers/annulations Chromium est classe separement; les compteurs applicatifs inattendus sont a zero.

## Rollback

Aucun cutover n'a ete effectue. La production et sa cible de rollback restent inchangees.
