# Déploiement P1-A — Anti-abus public et rate limiting distribué — 2026-05-29

## Résumé
- Commit avant prod : `802acb9112d90ddcd04adb8699367da2ac664ae3`
- Commit après prod : `69f0e1435a07a96495b8c918dd8c4b4b56cf69b2`
- Commit déployé :
  - `69f0e1435 fix(security): harden public anti-abuse rate limiting`
- Migration DB : non
- Prisma : non modifié
- Nginx : non modifié
- Firewall : non modifié
- Docker : non modifié
- Secrets : non modifiés

## CI GitHub
- Run : `26659083757`
- SHA : `69f0e1435a07a96495b8c918dd8c4b4b56cf69b2`
- Conclusion : `success`
- URL : https://github.com/cyranoaladin/nexus-project_v0/actions/runs/26659083757

## Configuration production anti-abus
- `UPSTASH_REDIS_REST_URL` : missing
- `UPSTASH_REDIS_REST_TOKEN` : missing
- `RATE_LIMIT_DISABLE_1` : absent
- Mode attendu : fallback mémoire
- Impact bêta élargie : bêta élargie non conditionnelle impossible tant que le backend distribué Upstash n'est pas configuré et validé en production.

## Préflight production
- Serveur : `korrigo`
- Branche : `main`
- HEAD avant : `802acb91`
- Git : worktree propre
- PM2 : `<PROCESS_NAME>` online
- Port : app sur `127.0.0.1:3001`, Nginx sur `80/443`
- Health before :
  - `site=200`
  - `dashboard_no_auth=307`
  - `api_health=200`

## Validation serveur
- typecheck : OK
- tests ciblés P1-A : OK, 9 suites / 50 tests
- build : OK, `BUILD_EXIT=0`
- PM2 reload : OK, `<PROCESS_NAME>` online après reload

## Smoke tests
- `site` : 200
- `dashboard_no_auth` : 307
- `api_health` : 200
- public routes GET :
  - `contact_get=405`
  - `bilan_gratuit_get=405`
  - `assessments_submit_get=405`
  - `stage_inscrire_get=405`
  - `stage_submit_diagnostic_get=405`
- contact smoke : `{"ok":true}`
- public invalid payloads :
  - assessments invalid : refus validation propre
  - stage diagnostic invalid : refus validation propre
  - reset password invalid-ish : refus CSRF/origin propre
- `api_health_after_public_smoke` : 200
- logs : pas de crash; warning attendu `[rate-limit] Running in memory-only mode (no Redis/Upstash configured).`

## Backup
- Répertoire : `/root/nexus-backups/deploy-p1-a-anti-abuse-rate-limit-20260529221733`
- HEAD avant : `802acb9112d90ddcd04adb8699367da2ac664ae3`
- Rollback prévu : reset sur le HEAD sauvegardé puis build/reload contrôlé si nécessaire
- Rollback exécuté : non

## Verdict
- P1-A : déployé production
- Mode distribué : non actif, variables Upstash absentes
- Bêta contrôlée : maintenue
- Bêta élargie : conditionnelle à la configuration Upstash et validation humaine produit/ops/RGPD/monitoring
- Go-live large : toujours NON recommandé automatiquement
