# Déploiement P0-004 Lot 2G — Bilans/reports visibility — 2026-05-29

## Résumé

- Commit avant prod : `6237a6be3c8c166eab425e5faac61bd8996d565f`
- Commit après prod : `dd1e519b661e581555f92fedf1f2c414be726f15`
- Commit déployé :
  - `dd1e519b6 fix(security): harden bilan and report visibility`
- Migration DB : non
- Prisma : non modifié
- Nginx : non modifié
- Firewall : non modifié
- Docker : non modifié
- Secrets : non modifiés

## CI GitHub

- Run : `26654623489`
- SHA : `dd1e519b661e581555f92fedf1f2c414be726f15`
- Conclusion : `success`
- URL : https://github.com/cyranoaladin/nexus-project_v0/actions/runs/26654623489

## Préflight production

- Serveur : `korrigo`
- Branche : `main`
- HEAD avant : `6237a6be`
- Git : worktree propre
- PM2 : `<PROCESS_NAME>` online
- Port : `127.0.0.1:3001`
- Health before :
  - `site=200`
  - `dashboard_no_auth=307`
  - `api_health=200`
  - `parent_bilan_pdf_no_auth=401`
  - `coach_session_report_no_auth=401`
  - `eaf_stage_report_no_auth=401`
  - `maths_stage_report_no_auth=401`

## Validation serveur

- `npm run typecheck` : OK
- Tests ciblés Lot 2G : 4 suites, 57 tests OK
- Régressions bilans/reports : 4 suites, 31 tests OK
- Build : `NODE_ENV=production npm run build`, `BUILD_EXIT=0`
- PM2 reload : `<PROCESS_NAME>` online après reload

## Smoke tests

- `site=200`
- `dashboard_no_auth=307`
- `api_health=200`
- `parent_bilan_pdf_no_auth=401`
- `coach_session_report_no_auth=401`
- `eaf_stage_report_no_auth=401`
- `maths_stage_report_no_auth=401`
- Invalid POST session report no-auth : `{"error":"Unauthorized"}`
- Logs : aucun crash, exception ou fatal nouveau; seulement un événement `unauthorized_access` attendu dans les logs filtrés.

## Backup

- Répertoire : `/root/nexus-backups/deploy-p0-004-lot2g-bilans-reports-20260529203030`
- HEAD avant : `6237a6be3c8c166eab425e5faac61bd8996d565f`
- Rollback prévu : retour au SHA sauvegardé, rebuild, reload PM2, health checks.
- Rollback exécuté : non

## Verdict

- Lot 2G : déployé et validé production.
- Go-live large : toujours NON autorisé.
- Bêta contrôlée : maintenue.
