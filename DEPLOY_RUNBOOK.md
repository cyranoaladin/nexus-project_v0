# DEPLOY RUNBOOK — Pré-rentrée SVT (`feat/svt-integration-final`)

> **AUCUN déploiement sans GO écrit de la direction (D5).** Ce runbook décrit la procédure ; il ne l'exécute pas.

## Modèle de production (constaté)
- Serveur : `root@88.99.254.59` (hôte `korrigo`, mutualisé avec 7+ apps — blast radius élevé).
- App servie par **pm2** `nexus-prod` via `/usr/local/libexec/nexus-prod-launcher`, build **Next.js standalone**, `PORT=3001`, derrière nginx.
- Releases : `/var/www/nexus-releases/<sha>/` ; symlink courant `/var/www/nexus-project_v0 → <release>`.
- ⚠️ Les scripts `scripts/deploy-production-safe.sh` du dépôt sont **périmés** (modèle docker-compose `/opt/nexus`) — ne pas les utiliser tels quels.

## Pré-requis avant tout déploiement
1. GO écrit de la direction (D5).
2. Toutes les dettes **bloquantes** de `DEBTS.md` levées (noms SVT, DRAFT D2, programmes 5a/5e/5f).
3. PR verte (voir dette N-2 sur le test provenance).
4. Sauvegarde/point de restauration DB confirmé.

## Procédure (release atomique + rollback)
1. Merger la PR sur `main` (après revue).
2. Build standalone : `npm ci && npm run build` (env prod, sans `.env.local` e2e).
3. Créer la release : copier le build vers `/var/www/nexus-releases/<nouveau-sha>/` (inclure `.next/standalone`, `.next/static`, `public`).
4. Basculer le symlink : `ln -sfn /var/www/nexus-releases/<nouveau-sha> /var/www/nexus-project_v0`.
5. Redémarrer : `pm2 restart nexus-prod`.
6. Healthcheck : `curl -sI https://nexusreussite.academy/stages/pre-rentree-2026` (200) + vérifier « SVT » présent.

## Rollback (immédiat)
- Repointer le symlink sur la release précédente (`/var/www/nexus-releases/0ff219dd…`) puis `pm2 restart nexus-prod`. Le modèle release+symlink rend le rollback atomique.

## Vérifications post-déploiement
- Page `/stages/pre-rentree-2026` : SVT visible en Première/Terminale, grille sans créneau du soir, FAQ SVT présente.
- Configurateur : sélection plafonnée à 4 matières, aucun crash à la 5ᵉ.
