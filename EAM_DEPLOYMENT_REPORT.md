# Rapport de déploiement EAM Première

Date : 2026-05-28 10:51 CET

## 1. Résumé exécutif

- Statut final : déploiement production effectué, rechargé et vérifié.
- URL : https://nexusreussite.academy
- Serveur : `root@88.99.254.59`
- Projet production : `/var/www/nexus-project_v0`
- Go-live ready : OUI.

Critères bloquants validés : français accentué, rendu mathématique KaTeX, workflow dashboard restructuré, build OK, E2E authentifié OK, persistance quiz/checklist vérifiée après rechargement, logs sans erreur EAM.

## 2. Stack production détectée

- Runtime : PM2 `nexus-prod`
- Script : `/var/www/nexus-project_v0/.next/standalone/server.js`
- Port applicatif : `3001`
- Proxy : Nginx vers `127.0.0.1:3001`
- DB : PostgreSQL, conteneur `nexus-postgres-db`
- Mode de déploiement utilisé : `rsync` ciblé des fichiers EAM modifiés, puis `npm test`, `npm run typecheck`, `npm run build`, `pm2 reload nexus-prod --update-env`
- Sauvegarde avant transfert : `/root/deploy-backups/nexus-eam-finish-20260528-113305`

## 3. Corrections effectuées

- Accents et français académique corrigés dans les contenus EAM : `Première`, `générale`, `spécialité`, `Épreuve Anticipée de Mathématiques`, `méthodes`, `corrigés`, etc.
- Formules converties en LaTeX propre et rendues avec KaTeX via `components/EAMPrep/MathFormula.tsx`.
- Syntaxes brutes supprimées du rendu élève : pas de `racine(Delta)`, `u_(n+1)`, `tau =`, `->`.
- Dashboard EAM restructuré : accueil, diagnostic, plan J-11, modules, fiches express, sujet blanc.
- Persistance renforcée : localStorage immédiat + POST API immédiat vers `/api/eam/progress`.
- Tests unitaires renforcés sur progression, normalisation, contenu des modules et qualité des formules.
- Test E2E Playwright authentifié ajouté et exécuté contre la production avec le compte élève réel fourni.

## 4. Fichiers modifiés ou ajoutés

- `app/dashboard/eleve/page.tsx`
- `app/globals.css`
- `components/EAMPrep/Checklist.tsx`
- `components/EAMPrep/Countdown.tsx`
- `components/EAMPrep/MathFormula.tsx`
- `components/EAMPrep/ModuleDetail.tsx`
- `components/EAMPrep/ModuleGrid.tsx`
- `components/EAMPrep/PlanTimeline.tsx`
- `components/EAMPrep/Quiz.tsx`
- `components/EAMPrep/RefsSheet.tsx`
- `components/EAMPrep/data.ts`
- `components/EAMPrep/index.tsx`
- `components/EAMPrep/types.ts`
- `hooks/useEAMProgress.ts`
- `__tests__/eam-progress-core.test.ts`
- `e2e/eam-premiere-student.spec.ts`

Contrôle off-limits : aucun fichier off-limits n’a été transféré ni modifié par cette passe de finition. Des modifications locales préexistantes restent visibles sur `lib/guards.ts`, `middleware.ts`, `prisma/schema.prisma` et des fichiers auth ; elles n’ont pas été touchées.

## 5. Base de données

- Table `eam_progress` présente : oui.
- Colonnes vérifiées : `id`, `user_id`, `checks`, `quiz`, `updated_at`, `created_at`.
- Migration appliquée pendant la passe précédente : oui, SQL direct.
- Aucune migration Prisma destructive.
- Aucun reset DB.
- Aucune suppression de données.
- Après test E2E : `1` ligne dans `eam_progress`.
- Vérification fonctionnelle DB : `auto_quiz_done_rows = 1`, `auto_check_rows = 1`.

## 6. Tests exécutés

- Local `npm test -- --runTestsByPath __tests__/eam-progress-core.test.ts` : OK, 7 tests passés.
- Local `npm run typecheck` : OK.
- Local `npm run build` : OK.
- Serveur `npm test -- --runTestsByPath __tests__/eam-progress-core.test.ts` : OK, 7 tests passés.
- Serveur `npm run typecheck` : OK.
- Serveur `npm run build` : OK.
- Reload : `pm2 reload nexus-prod --update-env` : OK.
- E2E production : `npx playwright test e2e/eam-premiere-student.spec.ts --project=chromium --retries=0 --trace=off` : OK, 1 test passé.
- Smoke HTTP accueil : `200`.
- Smoke dashboard sans session : `307` vers `/auth/signin`, puis page signin `200`.
- Smoke API sans session : `{"error":"Authentication required"}`, attendu.
- PM2 : `online`, `unstable restarts = 0`.

## 7. Test compte élève réel

- Compte utilisé : email masqué `zey***@gmail.com`.
- Mot de passe : jamais enregistré dans le code source ni dans le rapport.
- Connexion : OK.
- Dashboard élève : OK.
- Module EAM visible : OK.
- Textes accentués attendus visibles : OK.
- Chaînes non accentuées critiques absentes : OK.
- Formules rendues dans des éléments KaTeX : OK.
- Quiz répondu : OK.
- Checklist cochée : OK.
- Rechargement page : progression toujours visible.
- API authentifiée `/api/eam/progress` : OK.
- Persistance PostgreSQL : OK.

## 8. Warnings restants

- Warnings CSS build préexistants sur `.dashboard-soft .bg-gray-50\/50`, `.bg-white\/70`, `.bg-white\/80`. Non bloquants pour EAM.
- Warnings Jest préexistants : doublons de mocks dus à `.next/standalone`. Non bloquant.
- Log PM2 préexistant non lié EAM : erreur RAG `getaddrinfo EAI_AGAIN ingestor`.
- Variable paiement `CLICTOPAY_API_KEY` signalée précédemment comme manquante/non configurée selon environnement ; non bloquante pour EAM.

## 9. Rollback

- Sauvegarde : `/root/deploy-backups/nexus-eam-finish-20260528-113305`
- Rollback applicatif prudent :
  1. Restaurer les fichiers sauvegardés ou revenir au commit précédent selon la stratégie Git décidée.
  2. Rebuild : `npm run build`.
  3. Reload : `pm2 reload nexus-prod --update-env`.
- DB : ne pas supprimer `eam_progress` sans validation explicite, car elle contient maintenant une progression élève réelle.

## 10. Conclusion

GO-LIVE READY.

Le module EAM Première est disponible en production, intégré au dashboard élève, rendu en français correct, avec formules mathématiques visuelles, workflow clair, progression persistante localStorage + API/PostgreSQL, et vérification authentifiée réussie avec le compte élève réel fourni.

## Passe responsive et protection des données Zeyneb

Date : 2026-05-28 12:31 CET

- Statut : GO-LIVE READY — RESPONSIVE MINI PC — DONNÉES ÉLÈVE PRÉSERVÉES.
- Sauvegarde ciblée avant modification : `/root/deploy-backups/eam-responsive-20260528-122217`.
- Progression EAM de Zeyneb sauvegardée avant transfert : oui.
- Ligne `eam_progress` existante : oui.
- Nombre de lignes EAM avant passe responsive : `1`.
- Clés `checks` avant passe : `auto_0`, `auto_1`, `auto_2`, `auto_6`.
- Clés `quiz` avant passe : `auto`, `suites`.
- Aucun reset DB, aucune suppression, aucun `prisma migrate reset`.
- Clé localStorage conservée : `nexus_eam_progress_{userId}`.
- Format JSON `checks`/`quiz` inchangé et rétrocompatible.

Changements UX :

- Nouvelle route dédiée : `/dashboard/eleve/eam`.
- Le dashboard principal ne rend plus tout le module EAM dans une zone étroite.
- L’onglet `EAM Maths` affiche une carte d’entrée avec le bouton `Ouvrir EAM Maths`.
- La page dédiée affiche `<EAMPrep />` en pleine largeur utile.

Corrections responsive :

- Ajout d’un shell ciblé `.eam-shell`.
- Ajout de `min-w-0`, `max-w-full`, `overflow-hidden`, `break-words` sur les zones EAM sensibles.
- Les formules KaTeX sont enfermées dans un wrapper `overflow-x-auto` local.
- Règles CSS ciblées uniquement sous `.eam-shell`, sans règle globale agressive.

Tests exécutés :

- Local `npm test -- --runTestsByPath __tests__/eam-progress-core.test.ts` : OK, 10 tests passés.
- Local `npm run typecheck` : OK.
- Local `npm run build` : OK.
- Serveur `npm test -- --runTestsByPath __tests__/eam-progress-core.test.ts` : OK, 10 tests passés.
- Serveur `npm run typecheck` : OK.
- Serveur `npm run build` : OK.
- Reload : `pm2 reload nexus-prod --update-env` : OK.
- E2E read-only production `e2e/eam-premiere-responsive-readonly.spec.ts` : OK, 1 test passé.
- Viewports anti-overflow validés : `1024x600`, `1280x720`, `768x1024`, `390x844`.
- Test mutationnel `e2e/eam-premiere-student.spec.ts` : protégé par `ALLOW_EAM_MUTATION_E2E=true`, skipped par défaut.

Vérifications production :

- Accueil : HTTP `200`.
- Dashboard sans session : redirection signin attendue.
- `/dashboard/eleve/eam` sans session : redirection signin attendue.
- Logs PM2 : aucune erreur EAM/Prisma/NextAuth détectée ; log RAG `ingestor` préexistant et non lié.
- PM2 `nexus-prod` : online.

Observation données :

- Après la sauvegarde, un `POST /api/eam/progress` à `2026-05-28 12:25:13 +0200` a ajouté la clé quiz `second`.
- Ce POST est antérieur au test E2E read-only de cette passe, qui n’a généré que des `GET /api/eam/progress` vers `/dashboard/eleve/eam`.
- Aucune restauration automatique n’a été faite, conformément à la règle de ne pas supprimer ni réinitialiser la progression de Zeyneb.
- État final observé : ligne EAM présente, clés `checks` conservées `auto_0`, `auto_1`, `auto_2`, `auto_6`; clés `quiz` présentes `auto`, `deriv`, `expo`, `second`, `suites`. Les POST ayant ajouté `deriv`/`expo` proviennent du navigateur Chrome 148 référencé sur `/dashboard/eleve`, distinct du navigateur Playwright read-only Chrome 145 sur `/dashboard/eleve/eam`. Aucune suppression ni restauration automatique n’a été effectuée.

## Ajout du sujet blanc Nexus Réussite

Date : 2026-05-28 12:55 CET

- Statut : GO-LIVE READY.
- URL : `https://nexusreussite.academy/dashboard/eleve/eam`.
- Sauvegarde avant production : `/root/deploy-backups/eam-mock-exam-20260528-125055`.
- Sujet blanc intégré : oui, via l’onglet `Sujet blanc`.
- Titre : `Sujet blanc inédit — Nexus Réussite`.
- Durée : `2 heures`.
- Calculatrice interdite : oui.
- QCM : 12 questions, 4 choix par question.
- Exercices : 2 exercices, 7 points chacun.
- Total : 20 points.
- Rendu KaTeX : oui.
- Script Python Q11 visible et formaté : oui.
- Impression : bouton `Imprimer`, avec CSS print ciblé.
- Responsive : validé sur `1024x600`, `1280x720`, `768x1024`, `390x844`.

Fichiers ajoutés :

- `components/EAMPrep/mockExamData.ts`
- `components/EAMPrep/MockExam.tsx`
- `__tests__/eam-mock-exam.test.ts`

Fichiers modifiés :

- `components/EAMPrep/index.tsx`
- `app/globals.css`
- `e2e/eam-premiere-responsive-readonly.spec.ts`
- `EAM_DEPLOYMENT_REPORT.md`

Tests exécutés :

- Local `npm test -- --runTestsByPath __tests__/eam-progress-core.test.ts` : OK, 10 tests passés.
- Local `npm test -- --runTestsByPath __tests__/eam-mock-exam.test.ts` : OK, 4 tests passés.
- Local `npm run typecheck` : OK.
- Local `npm run build` : OK.
- Serveur `npm test -- --runTestsByPath __tests__/eam-progress-core.test.ts` : OK, 10 tests passés.
- Serveur `npm test -- --runTestsByPath __tests__/eam-mock-exam.test.ts` : OK, 4 tests passés.
- Serveur `npm run typecheck` : OK.
- Serveur `npm run build` : OK.
- Reload : `pm2 reload nexus-prod --update-env` : OK.
- E2E read-only production `e2e/eam-premiere-responsive-readonly.spec.ts` : OK, 1 test passé.

Protection des données :

- Aucun reset DB.
- Aucune suppression de ligne `eam_progress`.
- Aucune modification de `prisma/schema.prisma`.
- Aucune modification de la clé localStorage `nexus_eam_progress_{userId}`.
- Le composant `MockExam` n’appelle pas `/api/eam/progress` et n’écrit pas dans localStorage.
- Hash `checks` avant/après E2E read-only : inchangé.
- Hash `quiz` avant/après E2E read-only : inchangé.
- Logs d’accès pendant l’E2E read-only : GET uniquement sur `/api/eam/progress`, aucun POST lié au test.

Logs :

- PM2 `nexus-prod` : online, `unstable restarts = 0`.
- Pas d’erreur EAM/Prisma détectée.
- Warnings/logs non liés EAM observés : RAG `ingestor`, anciennes erreurs Auth/CredentialsSignin et Server Action issues de requêtes hors sujet blanc.

### Correctifs pédagogiques sujet blanc

Date : 2026-05-28 13:24 CET

- Sauvegarde avant correction : `/root/deploy-backups/eam-mock-exam-fixes-20260528-132428`.
- QCM 3 corrigé : suppression du doublon de réponse exacte ; la proposition `a` devient `{-1,5 ; -4}`.
- QCM 11 corrigé : ajout de l’aide avec les valeurs arrondies `u_0` à `u_7` pour évaluer la logique de boucle plutôt que les calculs décimaux.
- Exercice 2 question 4 corrigé : remplacement de l’affirmation fausse par `Étudier la position relative de la courbe Cf et de la droite d'équation y = 2 sur l'intervalle [-1 ; 4].`
- Tests renforcés : `__tests__/eam-mock-exam.test.ts` verrouille ces trois corrections.
- Local `npm test -- --runTestsByPath __tests__/eam-mock-exam.test.ts` : OK, 6 tests passés.
- Local `npm test -- --runTestsByPath __tests__/eam-progress-core.test.ts` : OK, 10 tests passés.
- Local `npm run typecheck` : OK.
- Local `npm run build` : OK.
- Serveur `npm test -- --runTestsByPath __tests__/eam-mock-exam.test.ts` : OK, 6 tests passés.
- Serveur `npm test -- --runTestsByPath __tests__/eam-progress-core.test.ts` : OK, 10 tests passés.
- Serveur `npm run typecheck` : OK.
- Serveur `npm run build` : OK.
- Reload : `pm2 reload nexus-prod --update-env` : OK.
- E2E read-only production : OK, 1 test passé.
- Hash `checks` avant/après E2E : inchangé.
- Hash `quiz` avant/après E2E : inchangé.
- Aucun fichier off-limits transféré ; aucune modification DB ; aucune modification volontaire de progression.
