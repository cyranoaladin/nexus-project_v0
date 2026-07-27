# P1-A-bis — État de gel et reprise contrôlée

## Résumé
- P1-A-bis code : `67ac3a326` et correctif tests `024721f92` poussés sur `main`, validations locales OK.
- Production : stable sur P1-A runtime `69f0e1435a07a96495b8c918dd8c4b4b56cf69b2`.
- CI : GitHub Actions bloquée; runs sans runner ni steps exploitables.
- Worktree : `/home/alaeddine/Bureau/nexus-deploy-clean-p1a-bis`, conservé pour reprise.
- Décision : gel P1-A-bis jusqu'à résolution GitHub Actions/billing et CI verte.

## État production
| Élément | État |
|---|---|
| HEAD | `69f0e1435a07a96495b8c918dd8c4b4b56cf69b2` |
| Worktree | propre |
| PM2 | `<PROCESS_NAME>` online |
| Health | `api_health=200` |
| Rate-limit env | `REDIS_URL=present`, Upstash missing/missing, `RATE_LIMIT_DISABLE_1=absent` |
| Runtime P1-A-bis | non actif |
| Divergence disque/runtime | non |

## État Git
| Zone | HEAD | État | Rôle |
|---|---|---|---|
| Repo principal | `67ac3a326` | dirty hors périmètre | développement local, interdit pour déploiement sécurité |
| Worktree P1-A-bis | `ad9cee21f` | propre | reprise CI/déploiement après résolution Actions |
| `origin/main` | `ad9cee21f` | CI bloquée | source distante à valider après résolution GitHub |
| Production | `69f0e143` | stable | runtime P1-A validé |

## État CI
| Run | Commit | Conclusion | Cause |
|---|---|---|---|
| `26665528428` CI Pipeline | `024721f92` | failure | jobs sans runner ni steps, blocage Actions/billing |
| `26665528472` Data Invariants | `024721f92` | failure | job sans runner ni steps, blocage Actions/billing |
| `26665775804` CI Pipeline | `ad9cee21f` | failure | jobs sans runner ni steps, blocage Actions/billing |
| `26665775798` Data Invariants | `ad9cee21f` | failure | job sans runner ni steps, blocage Actions/billing |

## Chantiers locaux hors périmètre
| Élément | État | Action |
|---|---|---|
| `app/dashboard/eleve/page.tsx` | dirty | hors déploiement |
| `jest.unit.config.js` | dirty | hors déploiement |
| `prisma/schema.prisma` | dirty | hors déploiement |
| `stage-eam-stmg/content` | non suivis | feature future |
| `scripts/create-stmg-students.ts` | non suivi | hors déploiement |
| `__tests__/scripts/create-stmg-students.test.ts` | non suivi | hors déploiement |

## Décision
- P1-A-bis : prêt localement mais non déployé.
- Production : stable.
- Bêta contrôlée : maintenue.
- Bêta élargie : bloquée.
- Go-live large : non recommandé.

## Protocole de reprise après résolution CI
1. Résoudre GitHub Actions/billing.
2. Relancer CI sur `ad9cee21f` ou dernier `origin/main`.
3. Attendre CI Pipeline + Data Invariants en success.
4. Depuis le worktree propre, refaire préflight.
5. Déployer P1-A-bis depuis zéro.
6. Vérifier `npm ci`, tests, build, reload PM2, smokes.
7. Documenter le déploiement.

## Interdits
- Pas de déploiement sans CI verte.
- Pas de déploiement depuis le repo principal dirty.
- Pas de P1-B avant décision P1-A-bis.
- Pas de modification `.env`, Prisma, PM2, Nginx, UFW ou Docker dans cet état de gel.
