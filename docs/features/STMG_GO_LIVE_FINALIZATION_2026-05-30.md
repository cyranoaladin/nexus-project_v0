# Finalisation go-live — Dashboard élève Première STMG

Date : 2026-05-30
Branche : `integration/stmg-go-live-20260530`

## Alignement Git / production

Stratégie retenue : branche d'intégration depuis `origin/main`, puis réintégration ciblée des fichiers réellement déployés STMG/EAM depuis `origin/deploy/eam-premiere-canonical-20260530`.

Motif : `origin/deploy/stmg-ui-production-20260530` part d'un socle antérieur à P1-A-bis. Un merge direct dans `main` aurait régressé `lib/rate-limit`, `package*.json` et plusieurs docs P1-A. La branche d'intégration conserve donc `origin/main` comme base et ajoute uniquement les surfaces dashboard déployées.

État `prisma/schema.prisma` : non modifié dans cette branche. Le diff local dirty du repo principal reste hors lot et doit être traité dans un lot Prisma/TOTP séparé.

## Cartographie STMG

| Zone | Fichiers | Rôle | État | Risque |
|---|---|---|---|---|
| Entrée dashboard | `app/dashboard/eleve/page.tsx`, `components/stage-eam-stmg/StageEntryCard.tsx` | Point d'entrée stage pour Première STMG | Conservé | Quick fix : vérifier visuellement l'absence de double carte avec comptes Fares/Lamis |
| Programme année | `app/programme/maths-1ere-stmg/page.tsx`, `app/api/programme/maths-1ere-stmg/progress/route.ts`, `lib/diagnostics/definitions/*stmg*`, `programmes/*stmg*` | Référentiel annuel, RAG, progression serveur | Conservé | Refactor : la page publique redirige vers le programme dashboard |
| Livret STMG général | `components/programme/livret-stmg/LivretStmg.tsx`, `app/(platform)/outils/livret-stmg/page.tsx` | Livret programme annuel | Conservé | Amélioration pédagogique : différencier clairement livret annuel et livret stage |
| Stage intensif | `app/dashboard/eleve/stage-eam-stmg/**`, `components/stage-eam-stmg/**`, `content/stage-eam-stmg/**`, `hooks/stage-eam-stmg/useStageProgress.ts` | Cockpit intensif EAM STMG 10 h | Enrichi | Refactor : progression maintenant synchronisée via payload programme existant |

## Actions classées

| Classe | Action |
|---|---|
| merge-release | Création de `integration/stmg-go-live-20260530` depuis `origin/main` et réintégration ciblée du déployé STMG/EAM sans régression P1-A-bis |
| amélioration pédagogique | Retrait du discriminant et du réflexe `-b/2a` ; ajout des formes factorisée/canonique, degré 3 et racine cubique |
| amélioration pédagogique | Ajout du domaine `Dérivation` : tangente, nombre dérivé, dérivées de polynômes de degré au plus 3, variations, coût marginal |
| amélioration pédagogique | Suites recentrées sur récurrence, tableur, seuils et sommes ; terme général fermé dé-emphasé |
| amélioration pédagogique | Statistiques complétées par tableaux croisés, fréquences marginales et conditionnelles |
| amélioration pédagogique | Probabilités complétées par conditionnelle via tableau, Bernoulli jusqu'à deux essais dans le stage, variable aléatoire et espérance |
| amélioration pédagogique | Algorithmique renommée `Algorithmique & tableur` avec compteur, accumulateur, listes/formules à étirer |
| refactor technique | Progression du stage stockée dans `diagnostic_results.stage_eam_stmg` via `/api/programme/maths-1ere-stmg/progress`, sans nouvelle table ni migration |
| tests | Tests STMG étendus pour taxonomie 6 domaines et round-trip dans le payload serveur |

## Doublons / zombies

- Aucun nouveau dashboard STMG parallèle n'a été créé.
- Les routes `stage-eam-stmg` restent le cockpit intensif ; `/programme/maths-1ere-stmg` reste le suivi annuel.
- La persistance locale du stage n'est plus la seule source : `localStorage` reste cache immédiat, la source distante réutilise le mécanisme serveur existant.

## Validations locales

- `npm test -- --runTestsByPath __tests__/stage-eam-stmg/core.test.ts __tests__/stage-eam-stmg/eligibility.test.ts __tests__/stage-eam-stmg/progress-state.test.ts` : OK, 3 suites / 21 tests.
- `npm test -- --runTestsByPath __tests__/api/programme.maths-1ere-stmg.progress.test.ts __tests__/api/student.dashboard.stmg.test.ts __tests__/components/dashboard/eleve/TrackContentSTMG.test.tsx __tests__/lib/assessments/questions/maths-premiere-stmg.test.ts __tests__/lib/diagnostics/definitions/stmg.test.ts` : OK, 5 suites / 11 tests.
- `npm run typecheck` : OK.
- `npm run lint` : OK avec warnings préexistants.
- `NODE_ENV=production npm run build` : OK.

## E2E

Le smoke local `next start` sur port dédié a été bloqué par l'absence d'env de production dans le worktree (`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`). Aucune lecture ni copie de `.env` n'a été faite.

E2E connecté Fares/Lamis non exécuté dans cette passe : les mots de passe ne sont pas disponibles dans ce contexte, et la consigne interdit de modifier/réinitialiser les comptes.

## Non effectué

- Aucun changement Prisma.
- Aucune migration.
- Aucun `prisma db push`.
- Aucun changement `.env`.
- Aucun compte élève modifié.
- Aucun déploiement.
- Aucun changement P1-A-bis Redis.

## Recommandation

La branche d'intégration est le socle propre pour audit Claude Opus et prochaine revue humaine. Le déploiement go-live de ces corrections pédagogiques doit attendre une validation connectée Fares/Lamis ou la fourniture contrôlée des mots de passe de QA existants, sans réinitialisation.
