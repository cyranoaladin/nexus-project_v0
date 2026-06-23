# Déploiement P0-004 Lot 2F-bis — Admin stages — 2026-05-29

## Résumé
- Commit avant prod : `dd1e519b661e581555f92fedf1f2c414be726f15`
- Commit après prod : `802acb91`
- Commit déployé :
  - `802acb911 fix(security): harden admin stage access`
- Migration DB : non
- Prisma : non modifié
- Nginx : non modifié
- Firewall : non modifié
- Docker : non modifié
- Secrets : non modifiés

## CI GitHub
- Run : `26656051489`
- SHA : `802acb9112d90ddcd04adb8699367da2ac664ae3`
- Conclusion : `success`
- URL : https://github.com/cyranoaladin/nexus-project_v0/actions/runs/26656051489

## Préflight production
- Serveur : `korrigo`
- Branche : `main`
- HEAD avant : `dd1e519b`
- Git : worktree propre
- PM2 : `nexus-prod` online
- Port : applicatif sur `127.0.0.1:3001`
- Health before :
  - `site=200`
  - `dashboard_no_auth=307`
  - `api_health=200`
  - `admin_stage_detail_no_auth=401`
  - `admin_stage_coaches_no_auth=401`
  - `admin_stage_sessions_no_auth=401`
  - `admin_stage_session_item_no_auth=405`

## Validation serveur
- `npm run typecheck` : OK
- Tests ciblés Lot 2F-bis : 5 suites, 35 tests OK
- `NODE_ENV=production npm run build` : OK, `BUILD_EXIT=0`
- PM2 reload : `nexus-prod` online après reload

## Smoke tests
- `site=200`
- `dashboard_no_auth=307`
- `api_health=200`
- `admin_stage_detail_no_auth=401`
- `admin_stage_coaches_no_auth=401`
- `admin_stage_sessions_no_auth=401`
- `admin_stage_session_item_no_auth=405`
- Invalid POST session no-auth : refusé par auth, sans mutation
- Invalid PATCH session item no-auth : refusé par auth, sans mutation
- Logs : aucun crash PM2 ni nouvelle erreur critique liée au lot; un ancien événement `unauthorized_access` ARIA filtré est hors périmètre

## Backup
- Répertoire : `/root/nexus-backups/deploy-p0-004-lot2f-bis-admin-stages-20260529210803`
- HEAD avant : `dd1e519b661e581555f92fedf1f2c414be726f15`
- Rollback prévu : reset Git vers le HEAD sauvegardé, typecheck, build production, reload PM2, health checks
- Rollback exécuté : non

## Verdict
- Lot 2F-bis : corrigé, testé, CI verte et déployé production
- Go-live large : toujours NON autorisé jusqu'à audit global de clôture P0-004
- Bêta contrôlée : maintenue
