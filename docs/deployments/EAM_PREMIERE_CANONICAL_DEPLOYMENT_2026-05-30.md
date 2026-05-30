# Déploiement EAM Première générale canonique — 2026-05-30

## Résumé
- Route canonique : `/dashboard/eleve/eam`.
- Objectif : intégrer le Sprint EAM 10h dans le dashboard EAM existant, sans route parallèle.
- Déploiement : exceptionnel contrôlé, GitHub Actions non exploitable.
- Déploiement depuis `main` : non.
- Déploiement P1-A-bis Redis : non.
- Prisma / migrations / DB : non modifiés.
- STMG : non modifié.

## Production
- HEAD avant : `d0e1b5d72ab1871c69e8b3642a9233e4dca20720`.
- HEAD après : `f1bfbcc3f8d737cabedfbbd353c317cbf2d50292`.
- Commit source : `faaf2b7f797d1cfbb233cd0a84a5bd5ce7a2fdf2`.
- Branche source : `deploy/eam-premiere-canonical-20260530`.
- Backup : `/root/nexus-backups/deploy-eam-premiere-canonical-20260530115935`.
- PM2 reload : exécuté sur `nexus-prod`.

## Fichiers intégrés
- `components/EAMPrep/StagePanel.tsx`
- `components/EAMPrep/Livret.tsx`
- `components/EAMPrep/index.tsx`
- `components/EAMPrep/data.ts`
- `components/EAMPrep/types.ts`
- `components/EAMPrep/PlanTimeline.tsx`
- `components/dashboard/eleve/EAMCockpitSummary.tsx`
- `app/dashboard/eleve/page.tsx`
- Tests EAM et anti-doublon.
- Documentation pédagogique EAM.

## Routes
- Route gardée : `/dashboard/eleve/eam`.
- Routes parallèles `/dashboard/eleve/eam-premiere/**` : absentes du disque et du build.
- Composants parallèles `components/eam-premiere-generale/**` : absents.
- Contenus parallèles `content/eam-premiere-generale/**` : absents.

## Validations serveur
- `npm ci --prefer-offline` : OK, warnings npm/audit existants.
- Tests ciblés : OK, 5 suites / 14 tests.
- `npm run typecheck` : OK.
- `npm run lint` : OK, warnings existants.
- `NODE_ENV=production npm run build` : OK, `BUILD_EXIT=0`.
- Artefacts build : `/dashboard/eleve/eam` présent, aucune route `/dashboard/eleve/eam-premiere`.

## Smoke production
- `site=200`.
- `dashboard_no_auth=307`.
- `eam_no_auth=307`.
- `eam_premiere_no_auth=307`.
- `api_health=200`.
- `stmg_no_auth=307`.
- PM2 `nexus-prod` : online.

## E2E no-auth
- Playwright headless exécuté sur production.
- `/dashboard/eleve` : redirection auth, pas de 500.
- `/dashboard/eleve/eam` : redirection auth, pas de 500.
- `/dashboard/eleve/eam-premiere` : redirection auth, pas de dashboard public concurrent.
- E2E connecté : non exécuté faute d'identifiants de test Première générale non-STMG disponibles.
- Console : erreurs CSP Google Analytics observées, hors périmètre EAM et sans impact dashboard.

## Logs
- Après reload, deux erreurs transitoires `Failed to find Server Action` observées, compatibles avec une requête ancienne pendant changement de build.
- Après stabilisation, aucun crash ni erreur critique filtrée EAM / Prisma / TOTP / STMG.

## Rollback
```bash
cd /var/www/nexus-project_v0
git reset --hard d0e1b5d72ab1871c69e8b3642a9233e4dca20720
npm ci --prefer-offline
NODE_ENV=production npm run build
pm2 reload nexus-prod --update-env
curl -so /dev/null -w "api_health:%{http_code}\n" http://127.0.0.1:3001/api/health
```

## Garantie anti-doublon
- Aucun second dashboard EAM n'est déployé.
- Le dashboard élève et `EAMCockpitSummary` pointent vers `/dashboard/eleve/eam`.
- Le flux Première générale ne modifie pas STMG.
- Aucun fichier Prisma, migration, `.env`, P1-A-bis ou rate limiting n'a été modifié.
