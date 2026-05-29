# Déploiement P0-004 Lot 2E — Assessments submit/test — 2026-05-29

## Résumé
- Commit avant prod : `499d5d3bbcb1a5593efe61a30d090fdc302b78ed`
- Commit après prod : `9e00e27cecdc22b6aa82264ee293e6ef873501f4`
- Commits déployés :
  - `5f1d25965 fix(security): harden assessment access controls`
  - `9e00e27ce test(integration): align predict ownership with hardened contract`
- Migration DB : non
- Prisma : non modifié
- Nginx : non modifié
- Firewall : non modifié
- Docker : non modifié
- Secrets : non modifiés

## CI GitHub
- Run : `26628271864`
- SHA : `9e00e27cecdc22b6aa82264ee293e6ef873501f4`
- Conclusion : `success`
- URL : `https://github.com/cyranoaladin/nexus-project_v0/actions/runs/26628271864`

## Préflight production
- Serveur : `korrigo`
- Branche : `main`
- HEAD avant : `499d5d3b`
- Git : worktree propre
- PM2 : `nexus-prod` online
- Port : `127.0.0.1:3001`
- Health before :
  - `site=200`
  - `dashboard_no_auth=307`
  - `api_health=200`
  - `assessments_test_no_auth=200` avant déploiement, corrigé par Lot 2E
  - `assessments_predict_no_auth=405`

## Validation serveur
- `npm run typecheck` : OK
- Tests ciblés Lot 2E : OK, 6 suites, 56 tests
- `NODE_ENV=production npm run build` : OK, `BUILD_EXIT=0`
- PM2 reload : OK, `nexus-prod` online après reload

## Smoke tests
- `site=200`
- `dashboard_no_auth=307`
- `api_health=200`
- `assessments_test_no_auth=401`
- `assessments_predict_no_auth=405`
- `assessments_submit_get=405`
- `predict POST no-auth=401`
- `assessmentVersion="../secret"` : refus contrôlé `Validation failed`, sans 500 ni message interne
- Logs : pas de crash ni erreur critique nouvelle détectée; ligne historique `unauthorized_access` ARIA observée hors Lot 2E

## Backup
- Répertoire : `/root/nexus-backups/deploy-p0-004-lot2e-assessments-20260529165122`
- HEAD avant : `499d5d3bbcb1a5593efe61a30d090fdc302b78ed`
- Rollback prévu : retour au HEAD sauvegardé, build, reload PM2, health checks
- Rollback exécuté : non

## Verdict
- Lot 2E : déployé et validé production
- Go-live large : toujours NON autorisé tant que P0-004 global n'est pas clôturé
- Bêta contrôlée : maintenue sous surveillance
