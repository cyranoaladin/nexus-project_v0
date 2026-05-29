# Déploiement P0-004 Lot 2F — Stages reservations public hardening — 2026-05-29

## Résumé
- Commit avant prod : `9e00e27cecdc22b6aa82264ee293e6ef873501f4`
- Commit après prod : `6237a6be3c8c166eab425e5faac61bd8996d565f`
- Commit déployé :
  - `6237a6be3 fix(security): harden stage reservation access`
- Migration DB : non
- Prisma : non modifié
- Nginx : non modifié
- Firewall : non modifié
- Docker : non modifié
- Secrets : non modifiés

## CI GitHub
- Run : `26651571313`
- SHA : `6237a6be3c8c166eab425e5faac61bd8996d565f`
- Conclusion : `success`
- URL : `https://github.com/cyranoaladin/nexus-project_v0/actions/runs/26651571313`

## Préflight production
- Serveur : `korrigo`
- Branche : `main`
- HEAD avant : `9e00e27c`
- Git : worktree propre
- PM2 : `nexus-prod` online
- Port : `127.0.0.1:3001`
- Health before :
  - `site=200`
  - `dashboard_no_auth=307`
  - `api_health=200`
  - `stages_public=200`
  - `stages_inscrire_get=405`
  - `stages_reservations_no_auth=401`

## Validation serveur
- `npm run typecheck` : OK
- Tests ciblés Lot 2F : 8 suites, 61 tests OK
- `NODE_ENV=production npm run build` : OK, `BUILD_EXIT=0`
- PM2 reload : OK, `nexus-prod` online après reload

## Smoke tests
- `site` : 200
- `dashboard_no_auth` : 307
- `api_health` : 200
- `stages_public` : 200
- `stage_detail_public` : 200
- `reservations_no_auth` : 401
- `inscrire_get` : 405
- `submit_diagnostic_get` : 405
- Payload extra fields inscription : refusé par validation, pas de `201`
- Diagnostic malformed : refusé avec erreur contrôlée, pas de 500 bavard
- Logs : aucun crash PM2 ni erreur critique nouvelle; seulement un ancien événement `unauthorized_access` ARIA filtré

## Backup
- Répertoire : `/root/nexus-backups/deploy-p0-004-lot2f-stages-20260529195031`
- HEAD avant : `9e00e27cecdc22b6aa82264ee293e6ef873501f4`
- Rollback prévu : retour au HEAD backup, build production, reload PM2, smoke public/health
- Rollback exécuté : non

## Verdict
- Lot 2F : corrigé, testé, CI verte et déployé production le 2026-05-29
- Go-live large : toujours NON autorisé
- Bêta contrôlée : maintenue
