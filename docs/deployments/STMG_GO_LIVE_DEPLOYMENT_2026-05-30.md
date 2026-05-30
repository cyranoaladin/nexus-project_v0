# Déploiement STMG — Préparation EAM voie technologique — 2026-05-30

## Résumé
- Objectif : finaliser le cockpit de préparation EAM voie technologique pour les élèves de Première STMG.
- Route dashboard : `/dashboard/eleve/stage-eam-stmg`.
- API ajoutée : `/api/programme/maths-1ere-stmg/stage-progress`.
- Persistance : sous-clé JSON `diagnosticResults.stage_eam_stmg` dans la progression programme existante, sans migration.
- Sujet blanc : format 2 h, sans calculatrice, 12 QCM pour 6 pts et exercices pour 14 pts.
- Tests : ciblés STMG, unitaires complets, typecheck, lint, build.
- E2E : parcours STMG local avec compte de test dédié.

## Corrections principales
- Route dédiée `stage-progress` : lecture et écriture limitées à l’état du stage.
- Préservation de `diagnosticResults.programme` et des autres clés JSON existantes.
- Garde anti-clobber : aucune écriture distante si le chargement serveur initial échoue.
- Statut de synchronisation UI : attente, serveur actif, local uniquement.
- Planning adaptatif sur 6 domaines, avec couverture du domaine restant en J5.
- Sujet blanc complet 2 h avec correction détaillée et auto-évaluation.
- File de reprise des erreurs issue des items ratés.
- Checklist de séance persistée dans l’état stage.
- Migration de lecture `algorithmique-information` vers `algorithmique-tableur`.

## Validation locale
- Tests ciblés STMG : OK, 10 suites, 39 tests.
- Typecheck : OK.
- Lint : OK avec warnings existants sous le seuil configuré.
- Build : OK, routes STMG générées.
- E2E STMG local : OK, 8 tests.
- Tests unitaires complets : OK, 467 suites, 6016 tests.

## Déploiement production
- Statut : commit de déploiement propre préparé depuis le HEAD production `f1bfbcc3f8d737cabedfbbd353c317cbf2d50292`.
- Stratégie : cherry-pick du commit minimal STMG uniquement, pas de cherry-pick de la pointe complète `integration/stmg-go-live-20260530`.
- Préflight attendu : production propre, PM2 `nexus-prod` online, site/API OK.
- HEAD avant : à renseigner au déploiement.
- HEAD après : à renseigner au déploiement.
- Backup : à renseigner au déploiement.
- E2E production : à exécuter avec les variables temporaires fournies, sans journaliser les mots de passe.

## Rollback
- Revenir au HEAD sauvegardé dans le backup de déploiement :
  `git reset --hard <HEAD_BEFORE> && npm ci --prefer-offline && NODE_ENV=production npm run build && pm2 reload nexus-prod --update-env`.

## Garanties
- Pas de modification Prisma.
- Pas de migration.
- Pas de modification `.env`.
- Pas de P1-A-bis.
- Pas de secret ajouté.
- Pas de compte modifié.
- Pas de doublon, zombie ou orphelin STMG volontaire.
