# Déploiement P0-004 Lot 2D + E2E navbar fix — 2026-05-29

## Résumé
- Commit avant prod : `6d7677ba6c5fd5f6bccc276e5c27290b5b79c5af`
- Commit après prod : `499d5d3bbcb1a5593efe61a30d090fdc302b78ed`
- Commits inclus :
  - `499d5d3bb test(e2e): harden homepage navbar dropdown checks`
  - `ae31a8a77 fix(security): tighten message projection hardening`
  - `fa4355b61 fix(security): harden message and conversation access`
  - `affe801cc docs(security): mark P0 API IDOR lot 2C deployed`
- Migration DB : non
- Prisma : non modifié
- Nginx : non modifié
- Firewall : non modifié
- Docker : non modifié
- Secrets : non modifiés

## CI GitHub
- Run : `26625334072` (`CI Pipeline`)
- SHA : `499d5d3bbcb1a5593efe61a30d090fdc302b78ed`
- Status : `completed`
- Conclusion : `success`
- URL : `https://github.com/cyranoaladin/nexus-project_v0/actions/runs/26625334072`

## Préflight production
- Serveur : `korrigo`
- Date serveur : `2026-05-29T10:22:23+02:00`
- Branche : `main`
- HEAD avant : `6d7677ba`
- Git : worktree propre avant pull
- PM2 : `nexus-prod` online
- Port applicatif : `127.0.0.1:3001`
- Health before :
  - `site`: `200`
  - `dashboard_no_auth`: `307`
  - `api_health`: `200`
  - `aria_no_auth`: `405`

## Pull production
- Méthode : `git pull --ff-only origin main`
- Résultat : fast-forward `6d7677ba..499d5d3b`
- Vérifications commit :
  - `499d5d3bb` présent
  - `ae31a8a77` présent
  - `fa4355b61` présent

## Validation serveur
- `npm run typecheck` : OK
- Tests ciblés demandés :
  - `__tests__/api/messages.send.route.test.ts`
  - `__tests__/security/idor.test.ts`
  - `__tests__/api/aria.chat.route.test.ts`
  - Résultat exécuté par Jest : 2 suites, 13 tests OK.
  - Note : `__tests__/security/idor.test.ts` a été fourni au matcher mais n'a pas produit de suite exécutée dans cette commande.
- Tests ciblés complémentaires Lot 2D :
  - `__tests__/api/messages.conversations.route.test.ts`
  - `__tests__/lib/security/message-access.test.ts`
  - Résultat : 2 suites, 8 tests OK.
- Warnings connus : mocks dupliqués Jest dans `.next/standalone`, non traités dans ce lot.
- Build : `NODE_ENV=production npm run build` OK, `BUILD_EXIT=0`.
- PM2 reload : `pm2 reload nexus-prod --update-env`
- PM2 après reload : `nexus-prod` online.

## Smoke tests
- `site` : `200`
- `dashboard_no_auth` : `307`
- `api_health` : `200`
- `aria_no_auth` : `405`
- `messages_no_auth` : `405`
- Routes Lot 2D découvertes :
  - `app/api/messages/send/route.ts`
  - `app/api/messages/conversations/route.ts`
  - `app/api/aria/conversations/route.ts`
- Smoke spécifique sans auth :
  - `GET /api/messages/send` : `405`
  - `GET /api/aria/conversations` : `401`
  - `GET /api/aria/chat` : `405`
- Logs filtrés : aucune nouvelle erreur critique applicative détectée; sortie limitée à l'en-tête du fichier `nexus-prod-error-19.log`.

## Backup
- Répertoire : `/root/nexus-backups/deploy-p0-004-lot2d-navbar-20260529102234`
- HEAD avant : `6d7677ba6c5fd5f6bccc276e5c27290b5b79c5af`
- Rollback prévu : `git reset --hard 6d7677ba6c5fd5f6bccc276e5c27290b5b79c5af`, `npm run typecheck`, build production, puis `pm2 reload nexus-prod --update-env`.
- Rollback exécuté : non.

## Verdict
- Lot 2D : déployé production et validé par smoke tests.
- E2E navbar fix : CI verte et commit inclus en production.
- Go-live large : toujours non autorisé, P0-004 global reste ouvert.
- Bêta contrôlée : maintenue sous surveillance.
