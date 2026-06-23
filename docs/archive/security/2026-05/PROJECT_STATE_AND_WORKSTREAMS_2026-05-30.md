# État projet et gouvernance des flux — 2026-05-30

## Résumé exécutif
- Production : stable sur P1-A runtime `69f0e1435a07a96495b8c918dd8c4b4b56cf69b2`.
- P1-A-bis : code Redis local et correctif tests prêts localement, non déployés.
- CI : GitHub Actions non exploitable, runs en failure sans runner ni steps.
- Repo principal : dirty avec plusieurs chantiers mélangés; interdit pour déploiement sécurité.
- Feature STMG : en cours localement, non versionnée proprement.
- Prisma/TOTP : diff schema non migré, à traiter dans un lot DB séparé.
- Go-live : go-live large non recommandé; bêta contrôlée maintenue; bêta élargie bloquée.

## Matrice des flux
| Flux | État | Dossier/branche/worktree | Bloquant | Prochaine action | Priorité |
|---|---|---|---|---|---|
| Production | stable P1-A | `/var/www/nexus-project_v0` | aucun immédiat | ne pas toucher | P0 hygiene |
| P1-A-bis Redis | prêt local, non déployé | `/home/alaeddine/Bureau/nexus-deploy-clean-p1a-bis` | CI billing/actions | résoudre CI puis déployer depuis zéro | P1 |
| STMG dashboard | en cours local | repo principal dirty | chantiers non suivis et config test locale | feature branch dédiée | P1/P2 |
| Prisma/TOTP | diff schema non migré | repo principal | bloque QA et ne doit pas être mélangé | décision migration/revert dans lot DB séparé | P1 |
| GitHub Actions | bloqué | GitHub | billing/actions, jobs sans runner/steps | intervention humaine | P0 ops |
| Go-live global | non recommandé | docs sécurité | P1 restants et CI non fiable | audit ops après CI | P1 |

## Production
- HEAD : `69f0e1435a07a96495b8c918dd8c4b4b56cf69b2`.
- Worktree : propre.
- PM2 : `nexus-prod` online.
- Health : `api_health=200`.
- Rate-limit : `REDIS_URL=present`, Upstash missing/missing, `RATE_LIMIT_DISABLE_1=absent`.
- Runtime actif : P1-A, pas P1-A-bis.
- Décision : aucune action production tant que P1-A-bis n'a pas une CI verte.

## Cartographie Git
| Zone | HEAD | État | Usage | Problème | Décision |
|---|---|---|---|---|---|
| Production | `69f0e143` | stable | runtime | aucun | ne pas toucher |
| Repo principal | `67ac3a326` | dirty | dev local | chantiers mélangés | ne pas déployer depuis ici |
| Worktree P1-A-bis | `18008c14` | propre | reprise P1-A-bis | CI bloquée | conserver |
| `origin/main` | `18008c14` | CI rouge | source distante | GitHub billing/actions | attendre résolution |

## Chantiers locaux
| Élément | Type | Probable chantier | Risque | Décision |
|---|---|---|---|---|
| `.gitignore` | tracked dirty | STMG/protection données locales | modification infra repo mélangée | feature/ops commit séparé après audit |
| `app/dashboard/eleve/page.tsx` | tracked dirty | STMG dashboard | mélange avec production | feature branch dédiée |
| `jest.unit.config.js` | tracked dirty | STMG/test cleanup | mélange avec production | feature branch dédiée |
| `prisma/schema.prisma` | tracked dirty | TOTP schema | bloque QA et migration non décidée | lot DB séparé |
| `stage-eam-stmg/content` | untracked | feature STMG | non versionné | feature branch dédiée |
| `scripts/create-stmg-students.ts` | untracked | STMG provisioning | données/scripts de création élèves | refactor puis feature branch |
| `scripts/examples/stmg-students.example.json` | untracked | exemple provisioning STMG | possible confusion données réelles/exemple | auditer puis commit séparé si neutre |
| `__tests__/scripts/create-stmg-students.test.ts` | untracked | tests provisioning STMG | non versionné | feature branch dédiée |

## CI / GitHub Actions
- Dernier commit main : `18008c14d0192a60e7bad5f8e3bae96782431be7`.
- CI Pipeline : failure.
- Data Invariants : failure.
- Code exécuté : non prouvé; jobs sans runner ni steps.
- Cause probable : blocage GitHub Actions/billing.
- Action humaine : résoudre billing/actions puis relancer CI sur le dernier `origin/main`.

## Interdits actuels
- Pas de déploiement depuis repo principal dirty.
- Pas de P1-B tant que P1-A-bis n’est pas déployé ou formellement reporté.
- Pas de création élèves STMG tant que Prisma/TOTP n’est pas aligné.
- Pas de `db push`.
- Pas de commit mélangeant sécurité, STMG et Prisma.
- Pas de contournement CI pour déployer P1-A-bis.

## Stratégie de reprise recommandée
1. Résoudre GitHub Actions/billing.
2. Relancer CI sur dernier `origin/main`.
3. Si CI verte : déployer P1-A-bis depuis le worktree propre.
4. Ensuite traiter Prisma/TOTP dans un lot DB séparé.
5. Ensuite finaliser feature STMG dans une branche dédiée.
6. Ensuite seulement reprendre P1-B Logs/PII, sauf décision humaine de reporter formellement P1-A-bis.
