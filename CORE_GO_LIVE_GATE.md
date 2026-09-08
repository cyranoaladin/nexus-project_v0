# Critères indépendants de mise en service

Date : 6 septembre 2026. Base applicative : `origin/main` au commit `95f518e31`.
Périmètre de ce lot : registre des critères et destinations des rôles, sans déploiement.

## CORE_PLATFORM_GO_LIVE_READY

CORE_PLATFORM_GO_LIVE_READY = NOT_YET_VERIFIED

Cette décision concerne les identités, les familles, la scolarité, le planning,
les bilans publiés et leur visibilité, les paiements et les factures.
Elle exige des preuves sur la révision livrée :

- cinq rôles : connexion, destination, session et refus d'accès croisé ;
- création familiale canonique, demandes qualifiées et traitement explicite des entrées historiques ;
- absence de rattachement implicite à un parent technique ou à un homonyme ;
- contrôles serveur de propriété, de consentement, de publication et d'audience ;
- scolarité et planning cohérents, sans compte candidat parallèle ;
- aucune opération de crédit, aucun encaissement déduit d'une simple confirmation de réservation ;
- tests pertinents, TypeScript, lint, build et recette authentifiée sans exposition de données ;
- migrations et stockage vérifiés, sauvegarde et retour arrière exploitables ;
- révision déployée identifiée, smoke des routes publiques et recette des parcours livrés.

La seule centralisation des destinations ne satisfait pas ces critères. Les
écarts du registre `audit_dsahboard.md` doivent être traités ou explicitement
acceptés avec leur périmètre et leur justification avant décision.

## RAG_FEATURE_GO_LIVE_READY

RAG_FEATURE_GO_LIVE_READY = BLOCKED

Cette décision concerne uniquement l'activation du retrieval documentaire externe.
Elle exige le contrat du fournisseur, un corpus autorisé, une identité académique
admissible, les permissions, des citations vérifiables, la gestion de l'absence
de résultat et des erreurs, et une recette sur le staging externe prévu.
L'absence actuelle de preuve staging ne doit jamais être remplacée par des mocks
présentés comme une validation fournisseur.

External RAG staging: NON_BLOCKING_CORE / BLOCKING_RAG_FEATURE

L'indisponibilité du staging RAG ne bloque pas CORE si les fonctions RAG restent
fermées ou affichent honnêtement leur indisponibilité et si les parcours CORE
fonctionnent indépendamment. Une panne RAG qui casserait ces parcours deviendrait
un défaut CORE ; cette séparation n'autorise pas à masquer une régression.
CORE prêt n'implique pas RAG prêt ; RAG prêt n'implique pas CORE prêt.

## Correction de gouvernance — contradiction Core/RAG résolue (7 septembre 2026)

Une contradiction P1 existait entre cette séparation et `DEPLOY_RUNBOOK.md`
(section « Contrat de compatibilité RAG »), qui exigeait littéralement un
résultat frais et réussi de `npm run aria:manifest:runtime-check` avant tout
GO privé, sans distinction de profil de déploiement — ce qui aurait bloqué
toute promotion `CORE_ONLY` derrière une exigence RAG. Corrigé (PR
`fix/core-only-deploy-rag-gate-20260907`, gouvernance/ops uniquement, aucun
comportement RAG ni Core métier modifié) : le garde dérive désormais
`DEPLOYMENT_PROFILE` (`CORE_ONLY` / `RAG_ENABLED`) de la configuration
canonique déjà utilisée par le client RAG applicatif (présence de
`RAG_API_BASE_URL`), sans introduire de second interrupteur indépendant.
`DEPLOYMENT_PROFILE=CORE_ONLY` → gate `NOT_APPLICABLE`, aucune variable/
credential RAG requise, Core promouvable. `DEPLOYMENT_PROFILE=RAG_ENABLED` →
la compatibilité runtime RAG reste strictement obligatoire, échec = NO_GO.
Détail complet : `DEPLOY_RUNBOOK.md`, `scripts/aria/check-runtime-manifest.ts`
(`resolveDeploymentRagProfile`), `__tests__/scripts/aria/runtime-manifest.test.ts`.

## Preuve — Tâche 16 : CORE ne fait aucune requête RAG (7 septembre 2026)

Base applicative au moment de la preuve : commit `d02b828c4`. Périmètre : les
parcours critiques CORE livrés aux Tâches 1-15 (familles, scolarité,
assignations, planning, tableaux de bord) fonctionnent sans que
`lib/rag-client.ts`, `lib/aria/rag.ts` ou
`lib/aria/infrastructure/rag/manifest.ts` ne soient sollicités — ni au niveau
module, ni au niveau navigateur. Aucun code de `lib/rag-client.ts`,
`lib/aria/rag.ts` ou `lib/aria/infrastructure/rag/manifest.ts` n'a été modifié
par cette tâche.

- `__tests__/architecture/core-rag-independence.test.ts` (7/7, PASS) : les 15
  variables d'environnement RAG effectivement lues par le sous-système
  (`RAG_INGESTOR_URL`, `RAG_API_TOKEN`, `RAG_SEARCH_TIMEOUT`,
  `RAG_SEARCH_TIMEOUT_MS`, `ARIA_RAG_ENGINE_BASE_URL`, `RAG_BFF_SERVICE_TOKEN`,
  `ARIA_RAG_ENGINE_TIMEOUT_MS`, `ARIA_RAG_ENGINE_MAX_RESPONSE_BYTES`,
  `ARIA_RAG_SERVABLE_MANIFEST_ROOT`, `ARIA_RAG_ACTIVE_MANIFEST_SHA256`,
  `NEXUS_INTERNAL_TOKEN_SECRET`, `NEXUS_INTERNAL_TOKEN_ISSUER`,
  `NEXUS_INTERNAL_TOKEN_AUDIENCE`, `NEXUS_SSO_ISSUER`, `NEXUS_SSO_AUDIENCE`)
  sont effacées, `fetch` est remplacé par un enregistreur qui échoue au
  premier appel, puis `lib/families/create-family.ts`,
  `lib/curriculum/student-academic-profile.ts`,
  `lib/assignments/allowed-courses.ts`, `lib/planning/series.ts` et
  `lib/dashboard/student-payload.ts` sont importés et partiellement exercés.
  `EXPECTED_RAG_OUTBOUND_REQUESTS=0` est vérifié à chaque cas ; une preuve
  statique complémentaire confirme qu'aucun de ces cinq fichiers n'importe le
  sous-système RAG. Caractérisation verte d'emblée : aucune régression
  trouvée, aucun changement de production nécessaire.
- `e2e/auth/core-rag-disabled.spec.ts` (2/2, PASS — exécuté réellement, pas
  seulement rédigé) : build standalone réel, serveur Next.js en production
  sans aucune variable RAG positionnée, base et Redis jetables locaux. Le
  rôle ELEVE charge `/dashboard/eleve` (widget ARIA embarqué via
  `<AriaChatLauncher>`), ouvre le panneau ARIA sans crash ni bascule vers le
  `error.tsx` générique ; le rôle ASSISTANTE charge son tableau de bord, le
  planning (`/dashboard/assistante/planning`) et la liste des élèves
  (`/dashboard/assistante/students`). Un intercepteur de requêtes navigateur
  confirme zéro appel vers un hôte/chemin RAG (`rag`, `ingestor`,
  `aria-rag-engine`) et zéro résurgence du fallback HTTP `/search` retiré
  (PR #214, hors périmètre).
- Widget ARIA embarqué (`components/aria/AriaChatLauncher.tsx` +
  `AriaChatPanel.tsx`, seul point CORE avec un composant RAG-adjacent en
  ligne) : déjà fail-open avant cette tâche — chargement fermé par défaut,
  `publicErrorLabel()` affiche un message français au lieu de planter sur
  `RAG_UNAVAILABLE`. Aucune modification de production requise.
- Suite unitaire complète (`npx jest --config jest.unit.config.js`) : 1096
  suites / 12545 tests, 100 % PASS après ce lot.

## Preuve — Tâche 17 : scénario capstone famille dorée (7 septembre 2026)

Base applicative au moment de la preuve : commit `ea2dd5fbe`. Périmètre :
scénario E2E unique, réellement exécuté (pas seulement rédigé), parcourant
tout le cycle de vie famille/scolarité/planning exactement comme une vraie
famille le vivrait, puis chaque invariant d'isolation par rôle et de refus
bâti aux Tâches 1-16.

- `e2e/auth/core-golden-family.spec.ts` (nouveau) + `e2e/helpers/golden-family.ts`
  (nouveau, aide de scénario fine posée SUR les aides existantes —
  `disposable-database.ts`, `same-origin.ts`, `rate-limit.ts` — jamais une
  réimplémentation parallèle). Un seul test, découpé en `test.step` :
  1. Assistante crée un foyer de deux enfants via la route canonique
     `POST /api/assistante/families` (`mode: 'WHATSAPP'`,
     `lib/families/create-family.ts` — le flux `FamilyRequest` → conversion a
     déjà sa propre couverture d'intégration dédiée depuis la Tâche 4).
  2. Activation parent EXCLUSIVEMENT par téléphone : ce mode n'envoie jamais
     d'e-mail d'activation, quel que soit l'e-mail fourni. Le jeton brut est
     obtenu via la même réponse unique côté staff que l'UI de production
     (`POST /api/assistante/parents/[parentId]/whatsapp-invitation`), puis
     consommé sur `/auth/parent-phone` — sans dépendance à une livraison
     WhatsApp/SMTP réelle.
  3. Confirmation du foyer (`registrationCompletedAt`, `/dashboard/parent/inscription`).
  4. Spot-check axe (0 violation) sur le tableau de bord parent confirmé.
  5. Deux écritures de carte scolaire (Tâche 6/7) : Première → `eds-maths-premiere`,
     Terminale → `eds-maths-terminale`.
  6. Deux coachs synthétiques (fixture directe, hors périmètre — l'activation
     coach n'est pas l'objet de cette tâche) + disponibilité effective
     (`ensureCoachAvailabilityByEmail`, aide existante réutilisée).
  7. Deux assignations scopées par cours (Tâche 9), un coach différent chacune.
  8. Deux séries hebdomadaires récurrentes (Tâche 11).
  9. Assertions opérationnelles ASSISTANTE et ADMIN sans CRUD générique ni SQL.
  10. Visibilité PARENT indépendante par enfant (Tâche 13) — dashboard parent,
      chaque enfant correctement attribué, jamais fusionné.
  11. Isolation Élève A puis Élève B (activation réelle, dashboard propre
      uniquement).
  12. Isolation Coach C1 puis Coach C2 (dossier, Tâche 14).
  13. IDOR croisé parent/enfant : second foyer entièrement indépendant créé,
      chaque parent refusé (404) sur l'enfant de l'autre par manipulation
      directe d'id.
  14. Refus croisé coach + révocation immédiate : fin d'assignation
      (`status: 'ENDED'`) retire l'accès dossier du Coach C1 sur-le-champ (403).
  15. Refus hors-périmètre (cours hors scope de l'assignation, 400) et
      créneau réellement conflictuel (même coach/élève/horaire, 409) — sur
      l'assignation B, restée active (l'assignation A vient d'être terminée
      à l'étape précédente).
  16. Rejeu d'idempotence : même clé + même corps → succès rejoué identique,
      aucun doublon ; même clé + corps différent → 409 `IDEMPOTENCY_CONFLICT`
      propre.
  17. Nettoyage explicite en fin de scénario + vérification que zéro ligne
      synthétique ne subsiste (`User`, `CoachStudentAssignment`,
      `PlanningSeries`), avant le filet de sécurité `afterAll`.
- Exécuté réellement contre la pile jetable locale (Postgres/Redis/Mailpit
  déjà montée par la Tâche 16) via `scripts/gate-auth-e2e.sh` (aucune
  plomberie E2E nouvelle) :
  - **Chromium** : PASS, exécuté et confirmé à plusieurs reprises (dernière
    confirmation : 22.2s).
  - **Firefox** (`firefox-smoke`) et **mobile** (`mobile-smoke`, profil
    `Pixel 7`) : PASS, confirmés ensemble lors d'une exécution multi-projets.
  - **WebKit** (`webkit-smoke`) : NON confirmé dans cette tâche. Une première
    exécution multi-projets a rencontré un abandon de navigation propre à
    WebKit (« Frame load interrupted » après `clearCookies()` + `goto()`,
    plus strict que Chromium/Firefox sur une navigation immédiatement
    consécutive à la précédente) — corrigé dans le code du scénario
    (`gotoStable()` dans `e2e/helpers/golden-family.ts`, une reprise unique
    sur ce type d'échec, appliquée à toutes les navigations directes du
    scénario) mais la ré-exécution multi-navigateurs pour CONFIRMER ce
    correctif sur WebKit spécifiquement n'a pas été relancée dans cette
    tâche (le run précédent dépassait la durée raisonnable pour cette
    session). Chromium seul reste confirmé après le correctif. À
    reconfirmer sur WebKit en suivi, sans que cela bloque CORE : c'est une
    fragilité de navigation E2E propre à ce moteur, jamais un défaut
    applicatif (aucune assertion métier n'a échoué sur WebKit — seule la
    navigation elle-même a été interrompue).
  - Axe : 0 violation sur `/dashboard/parent` (intégré au scénario, exécuté
    avec Chromium).
- `e2e/auth/rbac.dashboards.contract.spec.ts` (modifié) : ASSISTANTE, le
  second rôle staff, était absent de ce contrat RBAC (seul ADMIN y était
  couvert côté staff) alors que la Tâche 17 l'exerce abondamment — ajouté
  (routes autorisées + dashboards refusés), 11/11 PASS sur Chromium.
- Bogues découverts par ce scénario dans du code des Tâches 1-16 (aucun
  n'est corrigé par cette tâche — hors périmètre de la Tâche 17, qui livre
  la suite E2E, pas ces routes) :
  - `app/api/assistante/assignments/route.ts` (GET, Tâche 9) : le paramètre
    `status` omis renvoie 400 `"Statut invalide"` au lieu du défaut `ACTIVE`
    documenté (`statusQuerySchema = z.nativeEnum(...).optional().default(...)`) :
    `URLSearchParams.get('status')` renvoie `null` quand absent, et `.optional()`
    de zod n'accepte que `undefined`, jamais `null`. Contourné dans le
    scénario (paramètre `status=ACTIVE` toujours fourni explicitement), pas
    corrigé.
  - `lib/dashboard/student-payload.ts` (~ligne 1117, Tâche 13) : pour toute
    spécialité MATHEMATIQUES, `trackContent.specialties[].diagnosticKey` est
    figé à la valeur littérale `'maths-premiere-p2'`, y compris pour un élève
    de Terminale suivant `eds-maths-terminale` — un élève de Terminale est
    ainsi orienté vers la banque de diagnostic de Première. Ce n'est PAS une
    fuite d'isolation entre élèves (même valeur figée pour tout le monde, pas
    la valeur d'un autre élève) : un défaut de justesse de contenu. Le champ
    voisin correctement résolu par niveau, `skillGraphRef`, est ce que le
    scénario vérifie à la place ; `diagnosticKey` n'est pas asserté (l'asserter
    figerait ce bogue comme comportement attendu).
- Suite unitaire complète (`npx jest --config jest.unit.config.js`) : 1096
  suites / 12545 tests, 100 % PASS après ce lot.

## Preuve — Tâche 18 : répétition de migration (7 septembre 2026)

Base applicative au moment de la preuve : commit `8b40470f0`. Périmètre :
répétition des migrations de cette branche avant toute exécution contre la
production réelle, sur trois environnements Postgres isolés et jetables,
jamais `nexus-pg15-prodclone`, `nexus-pg15-empty` ni `nexus-postgres-test`.

```
FRESH_DB_MIGRATION_REHEARSAL = PASS
SYNTHETIC_DB_MIGRATION_REHEARSAL = PASS
PRODUCTION_CLONE_MIGRATION_REHEARSAL = BLOCKED
```

- Base vide (`scripts/core/rehearse-core-migration.sh`) : 106 migrations
  appliquées depuis zéro sans erreur, idempotence confirmée (second
  `prisma migrate deploy` → `No pending migrations to apply.`).
- Base synthétique non vide (même script, aucune donnée réelle) : migrations
  de base appliquées via le commit parent `95f518e31`, semis synthétique
  minimal couvrant les trois issues de `AssignmentCourseScopeState`
  (`BACKFILL_AUTO`, `BACKFILL_AMBIGUOUS`, `BACKFILL_UNRESOLVED` — jamais de
  choix arbitraire sur les deux derniers), puis migration de cette branche
  appliquée par-dessus : succès, idempotence confirmée, `report-core-
  migration-state.ts` et `backfill-assignment-course-keys.ts --apply`
  cohérents avant/après avec le delta attendu, backfill idempotent
  (`changed=0` au second passage). Test de rétrocompatibilité : le client
  Prisma généré au commit parent lit les enregistrements pré-migration et
  écrit un nouvel enregistrement valide contre le schéma étendu — confirme
  empiriquement l'additivité de la migration (aucun contrat destructif).
- Clone de production réel (sauvegarde authentifiée du 3 septembre, SHA256
  `e452d804ab...94ffd8f`, restauration vérifiée, 0 index invalide, 0
  contrainte non validée, 317 utilisateurs / 101 parents / 192 élèves / 20
  coachs / 26 réservations / 19 assignations restaurés) : **bloquée avant
  toute migration**. La revérification indépendante exigée par le contrat
  d'autorisation (dernière migration présente dans l'archive) a échoué —
  l'archive s'arrête réellement à `20260830150000_add_lva_lvb_languages`,
  pas à `20260903190000_add_planning_studio` comme attendu, soit un écart
  de 18 migrations et non 4-5. Aucune migration exécutée, aucune donnée
  modifiée ; environnement détruit immédiatement après capture de la
  baseline. Décision requise de l'opérateur humain avant de rejouer cette
  lane — voir `docs/audits/2026-09-06-core-migration-rehearsal.md`.

Détail complet, compteurs BEFORE/AFTER/EXPECTED_DELTA/ACTUAL_DELTA/VERDICT,
classification du diff structurel et cause exacte du blocage :
`docs/audits/2026-09-06-core-migration-rehearsal.md`.

## Addendum — Tâche 18 : décision Release Owner post-blocage (7 septembre 2026)

`PRODUCTION_CLONE_MIGRATION_REHEARSAL = BLOCKED` ci-dessus reste le verdict
Tâche 18. Deux voies parallèles à statuts distincts, jamais assimilées à la
Tâche 18, ont été exécutées sur autorisation numérotée séparée du Release
Owner :

```
HISTORICAL_PRODUCTION_CHAIN_MIGRATION_REHEARSAL = PASS
```

Chaîne complète de **18** migrations réellement manquantes (recomptage
indépendant par différence d'ensemble contre la table `_prisma_migrations`
réelle de l'archive, pas par ordre de nom — corrige un chiffre de 13
transmis par erreur de méthode dans le contexte de cette décision, et
confirme la valeur de 18 déjà relevée dans la Lane 3 ci-dessus) appliquée
avec succès sur une instance isolée distincte (`nexus-historical-chain-
rehearsal-*`, jamais `nexus-pg15-prodclone`/`nexus-pg15-empty`/`nexus-
postgres-test`) à partir de la même sauvegarde authentifiée (SHA256
`e452d804ab...94ffd8f`) : ensemble appliqué == ensemble attendu exactement,
idempotence PASS, 0 index invalide, 0 contrainte non validée, compteurs
métier strictement inchangés (`users`=317, `parent_profiles`=101,
`students`=192, `coach_profiles`=20, `SessionBooking`=26,
`coach_student_assignments`=19, avant et après), backfill applicatif
cohérent et idempotent, environnement détruit après capture des preuves.
Détail complet : addendum de `docs/audits/2026-09-06-core-migration-
rehearsal.md`.

Recherche read-only d'une sauvegarde de production plus récente satisfaisant
la baseline exacte (`_prisma_migrations` s'arrêtant à
`20260906130000_parent_email_activation_invalidation`, sans migration
propre à cette branche) :

```
TASK_18_BLOCKED_MISSING_EXACT_PRODUCTION_BASELINE_BACKUP
```

Meilleur candidat local trouvé (authentique, SHA256 concordant avec
`docs/audits/2026-09-06-integration-familles-whatsapp.md` — une migration
de production réelle déjà appliquée le 6 septembre, sans rapport
d'exécution avec cette tâche) : à **104** migrations, une de moins que la
baseline exacte requise (105). Un runbook de sauvegarde approuvé existe
(`ops/RUNBOOK_MIGRATION_PROD.md`, étape 2) mais son exécution exige une
connexion SSH à l'hôte de production réel (détails dans le registre
d'exploitation privé) — point d'arrêt explicite non franchi par cette tâche ;
rapporté au coordinateur sans exécution. Détail complet : addendum de
`docs/audits/2026-09-06-core-migration-rehearsal.md`.

## Second addendum — Tâche 18 : baseline exacte obtenue, PRODUCTION_CLONE_MIGRATION_REHEARSAL = PASS (7 septembre 2026)

Une nouvelle sauvegarde de production, prise fraîchement par le coordinateur
(read-only, `ops/RUNBOOK_MIGRATION_PROD.md`, déconnexion immédiate) s'est
avérée satisfaire exactement la baseline requise :

```
FRESH_PROD_BACKUP_SHA256 = 519c639afc76a39c72bbab78b457dc099758b9f5513ba89f01813afffdf49350
FRESH_PROD_BACKUP_TIMESTAMP = 2026-09-07T09:37:43Z
FRESH_PROD_BACKUP_POSTGRES_VERSION = PostgreSQL 15.17 (Debian 15.17-1.pgdg12+1)
FRESH_PROD_BACKUP_MIGRATION_COUNT = 105
FRESH_PROD_BACKUP_LAST_MIGRATION = 20260906130000_parent_email_activation_invalidation
BRANCH_ONLY_MIGRATIONS = 20260906200000_core_family_academic_planning_expand
```

Gate stricte (dump == baseline attendue, branche-seule ∩ dump = ∅) passée
avant toute migration, sur instance isolée neuve
(`nexus-exact-baseline-rehearsal-*`, jamais `nexus-pg15-prodclone`/
`nexus-pg15-empty`/`nexus-postgres-test`/lanes précédentes). Seule
`20260906200000_core_family_academic_planning_expand` appliquée — aucune
autre, aucun doublon, idempotence PASS, 0 index invalide, 0 contrainte non
validée, 0 delta inattendu sur les compteurs métier (`users`=317,
`parent_profiles`=101, `students`=192, `coach_profiles`=20,
`SessionBooking`=26, `coach_student_assignments`=19, inchangés
avant/après). Backfill applicatif (`scanned=19, auto=17, unresolved=1,
ambiguous=1, changed=18`, idempotent) et test de compatibilité applicative
sur données réelles (client Prisma courant, 7 colonnes additives de
`SessionBooking` confirmées nullables, aucune erreur de lecture) tous PASS.

```
PRODUCTION_CLONE_MIGRATION_REHEARSAL = PASS
TASK_18 = PASS
```

Le blocage initial (`9a247a909`) et la Lane historique
(`HISTORICAL_PRODUCTION_CHAIN_MIGRATION_REHEARSAL = PASS`, addendum
ci-dessus) restent inchangés — ce second addendum les complète, sans les
réécrire. Détail complet, tableaux BEFORE/AFTER/DELTA et preuves :
« Second addendum » de `docs/audits/2026-09-06-core-migration-rehearsal.md`.
Tâche 19 (bascule, déploiement, merge, `CURRENT_SWITCH`) reste hors du
périmètre de cette tâche.

## Preuve — Tâche 19 : gates finales, revue indépendante et PR draft (7 septembre 2026)

Base applicative en début de tâche : commit `52b9a916c` (Tâche 18 clôturée,
`PRODUCTION_CLONE_MIGRATION_REHEARSAL = PASS`). Périmètre : geler le diff
réel contre `origin/main`, exécuter toutes les gates statiques et
dynamiques réellement applicables, mener une revue de sécurité et de code
indépendante fraîche sur le HEAD final, corriger tout P0/P1 trouvé, et
ouvrir une Draft PR — sans merge, déploiement, migration production ni
`CURRENT_SWITCH`.

### Diff réel contre `origin/main`

`origin/main` (`ddeb12789`) est 27 commits en avance sur le merge-base
(`95f518e31` — PR #213/#214/#216/#217, cockpit RAG v2, registre ARIA,
durcissement pré-C05a, convergence identité académique N4A), **aucun** ne
touchant `prisma/migrations/` ni `prisma/schema.prisma` (diff vide entre
merge-base et `origin/main` sur ces chemins, revérifié). 164 fichiers
modifiés par cette branche contre `origin/main`, tous rattachables à un
motif identifiable des tâches 1-18 (migrations DB, schéma Prisma, backend,
frontend, tests, scripts opérationnels, documentation) : aucun artefact
généré inexpliqué, aucun code de debug accidentel, aucune implémentation
morte ou dupliquée introduite. Recoupement fichier-par-fichier avec les
nouveaux commits d'`origin/main` : seulement 3 fichiers — `audit_dsahboard.md`
(sections disjointes, pas de conflit sémantique), `lib/rate-limit/sensitive.ts`
et `__tests__/lib/rate-limit.s3-final-contract.test.ts` (chaque branche
ajoute une clé différente au même objet de politiques, à des points
distincts du fichier — trivialement compatible, aucune logique métier en
conflit). Aucun rebase effectué (instruction explicite du Release Owner) :
GitHub affichera ce diff directement sur la PR.

### Ensemble de migrations — non dérivé depuis la Tâche 18

`CURRENT_BRANCH_MIGRATION_SET == TASK18_TESTED_BRANCH_MIGRATION_SET` :
revérifié, diff vide entre le commit testé en Tâche 18 et `TASK19_FINAL_HEAD`
sur `prisma/migrations/` et `prisma/schema.prisma` — seule
`20260906200000_core_family_academic_planning_expand` (287 lignes SQL)
existe, inchangée. `npx prisma migrate status` contre la base jetable :
106 migrations, schéma à jour. Aucune dérive.

### Revue indépendante fraîche (section 14)

Une revue indépendante (sous-agent sans accès à mes conclusions
préalables, fournie uniquement l'objectif métier et le diff réel) a
examiné `origin/main...HEAD` en trois passes parallèles recoupées, plus un
tracé de confirmation ciblé sur les résultats liés au fuseau horaire.

**P0 : aucun.** Ni IDOR, ni garde d'authentification/autorisation
manquante ou contournable, ni mass assignment, ni injection SQL, ni PII en
journal. La revue relève que cette branche **retire** plusieurs failles de
sécurité et d'intégrité préexistantes plutôt que d'en introduire :
suppression du repli d'accès dossier coach par historique de réservation
sans assignation active (`lib/rbac/coach-student-access.ts`), fermeture des
voies de création de compte parallèle (`admin/users`,
confirmation de stage, activation manuelle), remplacement transactionnel du
delete+create de disponibilités coach, idempotence désormais liée au hash
du payload.

**P1 (corrigé) :** `app/dashboard/parent/enfant/[studentId]/page.tsx`
affichait `scheduledAt`/`endAt` — un encodage « pseudo-UTC » documenté
(`combineDateAndTime`, `lib/planning/invariants.ts`) — via
`toLocaleTimeString` sans `timeZone: 'UTC'`. Aucun `TZ` n'étant fixé dans le
dépôt, le navigateur réel d'un parent basé à Tunis décale chaque horaire
affiché d'une heure. RED reproduit avec `process.env.TZ = 'Africa/Tunis'`
dans un nouveau test de composant
(`__tests__/app/parent-child-session-times-timezone.test.tsx`) ; corrigé en
lisant les accesseurs UTC directement (commit `df47176c3`).

**P2 (corrigé) :** `lib/validation/sessions.ts`
(`parentStudentBookSessionSchema`) comparait `scheduledDate` à un « jour
UTC courant » brut au lieu du jour Tunis (`tunisTodayUtcMidnight()`) déjà
utilisé partout ailleurs dans cette branche pour le même concept — fenêtre
d'environ une heure par jour (23h00-24h00 UTC) où les deux jours calendaires
divergent. RED reproduit avec la même convention `jest.useFakeTimers()` à
23:30 UTC déjà établie par le test de frontière de la Tâche 11 ; corrigé
(commit `df47176c3`). Le `scheduledDate` de `bookFullSessionSchema` (même
fichier, préexistant, non touché par cette branche) reste volontairement
inchangé — hors périmètre de cette revue.

**P3 (documenté, non bloquant) :** `app/api/coaches/available/route.ts`
calcule un filtre optionnel de jour de semaine avec l'heure locale du
serveur au lieu de `getUTCDay()`, par incohérence cosmétique avec le code
voisin — n'affecte ni le booking ni aucune limite de sécurité. Laissé tel
quel.

Dette technique : aucun `TODO`/`FIXME`/`HACK` ajouté, aucun test
`.only`/`.skip`, aucune assertion complaisante, aucun code mort — confirmé
indépendamment par la revue ET par `npm run test:zero-debt`
(`TEST_DEBT_FILES_INSPECTED=5365`, tous compteurs à 0).

### Sécurité et confidentialité (sections 8-9)

`npm run security:repo` a d'abord échoué (RED) : `CORE_GO_LIVE_GATE.md` et
`docs/audits/2026-09-06-core-migration-rehearsal.md` (tous deux nouveaux
dans cette branche) citaient l'IP et l'alias SSH réels de production en
documentant une étape de runbook jamais exécutée. Corrigé par rédaction
(commit `54dd0e834`) ; `npm run security:repo` PASS ensuite. Scan Semgrep
(`p/security-audit`, `p/secrets`, `p/typescript`, `p/nextjs`) sur les 163
fichiers du diff : 1 résultat, `generic.secrets.security.detected-username-
and-password-in-uri` sur une URL de test synthétique
(`__tests__/integration/family-idempotency-concurrency.real.test.ts`) — non
bloquant par la propre grille de notation CI (préfixe `__tests__/`), faux
positif confirmé (aucun identifiant réel dans l'URL). `npm run
check:no-hardcoded` : PASS. Balayage manuel complémentaire du diff complet
pour mots de passe/clés/tokens/dumps : aucun trouvé en dehors des fixtures
synthétiques déjà nommées comme telles (`SyntheticFixture!42`,
`GoldenParent!2026`, etc.). Aucune donnée du rehearsal Tâche 18 (chemins
locaux de dump déjà supprimés, uniquement SHA256/compteurs agrégés
committés) n'apparaît dans le diff de cette tâche.

```
KNOWN_SECURITY_FINDINGS_OPEN = 0
PII_LEAK = 0
SECRET_LEAK = 0
PRODUCTION_DATA_ARTIFACTS_IN_GIT = 0
```

### Matrice de compatibilité de déploiement (section 10)

| Combinaison | Statut |
|---|---|
| OLD_APP + OLD_SCHEMA | SUPPORTED (état de production actuel) |
| OLD_APP + NEW_SCHEMA | TEMPORARILY_SUPPORTED — testé empiriquement en Tâche 18 (`scripts/core/rehearsal-rollback-compat-check.ts`) : le client Prisma de l'artefact précédent lit les enregistrements pré-migration et écrit un nouvel enregistrement valide contre le schéma étendu (toutes les colonnes ajoutées sont nullables/additives) |
| NEW_APP + OLD_SCHEMA | UNSUPPORTED — le client Prisma de la nouvelle application référence des colonnes/tables absentes du schéma non étendu (échouerait sur tout chemin famille/planning/assignation) |
| NEW_APP + NEW_SCHEMA | SUPPORTED — état cible, validé par les quatre rehearsals de la Tâche 18 |

Ordre de déploiement qui en découle : appliquer la migration d'expansion
d'abord, déployer la nouvelle application ensuite — jamais l'inverse.

### Rollback / recovery (section 11)

Arrêt d'un déploiement en cours : interrompre le nouvel artefact avant
bascule ; la migration, additive-only, reste sans risque à laisser
appliquée même si le déploiement applicatif est abandonné (cellule
OLD_APP+NEW_SCHEMA ci-dessus). Retour à l'artefact précédent : redéployer
le SHA précédent — supporté tant que le schéma reste au moins à ce niveau
d'expansion. Données qui resteraient : toute ligne `FamilyRequest`,
`PlanningSeries`, `planning_override_audits`, `family_request_children`
créée par la nouvelle application pendant sa fenêtre d'activité, ainsi que
les colonnes de backfill (`academicCourseKeys`, `courseScopeState`,
`studentProfileId`/`coachProfileId`/... sur `SessionBooking`) — bénignes,
ignorées par l'ancienne application. Opérations non réversibles par un
simple rollback applicatif : toute conversion `FamilyRequest` → foyer réel
(décision métier, pas un défaut technique). Cette migration n'a
délibérément aucune migration descendante (stratégie expand-only) : un
véritable retour arrière de schéma (suppression des tables/colonnes
ajoutées) exigerait une restauration depuis sauvegarde, ce qui est
destructif pour toute donnée créée depuis cette sauvegarde — ceci n'est PAS
présenté comme un rollback sans perte.

### Performance (section 12)

Aucun scan complet introduit par les nouvelles requêtes : chaque nouvel
accès (`family_requests`, `planning_series`, colonnes de portée de cours)
est appuyé par un index dédié (voir `prisma/migrations/20260906200000_core_
family_academic_planning_expand/migration.sql`, 13 `CREATE INDEX`). Volumétrie
observée en Tâche 18 sur clone de production réel : ~317 utilisateurs, 192
élèves, 20 coachs, 26 réservations, 19 assignations — échelle actuelle
faible, risque N+1 non matérialisé aux patterns de requête examinés
(chargements groupés par relation Prisma, pas de boucle de requêtes par
enregistrement dans les nouveaux services `lib/planning/*`,
`lib/assignments/allowed-courses.ts`). `KNOWN_PERFORMANCE_REGRESSIONS = 0`.

### Concurrence / intégrité métier (section 13)

Invariants portés par la base, pas seulement l'application : contrainte
d'exclusion PostgreSQL `SessionBooking_student_profile_no_overlap_excl`
(nouvelle, côté élève, miroir de la contrainte coach préexistante),
transactions `Serializable` pour la matérialisation de série
(`lib/planning/series.ts`), CAS réel (`updateMany` avec `revision` attendue)
pour `Student.academicRevision` et `PlanningSeries.revision`. Preuves déjà
réelles-Postgres aux Tâches 4, 6, 8, 9, 10, 11, 13 :
`__tests__/integration/family-idempotency-concurrency.real.test.ts`,
`student-academic-profile-concurrency.real.test.ts`,
`assignment-course-backfill.real.test.ts`,
`assignment-concurrency.real.test.ts`, `planning-concurrency.real.test.ts`,
`parent-cross-child-isolation.real.test.ts` — tous rejoués PASS dans cette
tâche (voir tableau des gates).

### Gates — tableau complet

Voir le rapport de tâche associé pour le tableau GATE | COMMAND | RESULT |
EVIDENCE | BLOCKING complet (23 gates). Synthèse : Prisma
format/validate/generate = PASS ; migration status = PASS (106/106, aucune
en attente) ; suite unitaire complète = PASS sur le HEAD final après
correctifs P1/P2 (1097 suites / 12549 tests, 12548 réussis — le seul échec,
`aria-playwright-collection-guard.test.ts`, préexistant et non touché par
cette branche, est un faux positif d'environnement local confirmé par
isolement : il exige `e2e/.credentials.json` absent au moment du run, or ce
fichier existe localement suite à un run E2E précédent de cette même
session — déplacer temporairement ce fichier fait repasser la suite au
vert ; ne se reproduit jamais sur un checkout CI propre) ; suite d'intégration
réelle-DB complète (balayage principal + 3 lanes isolées CI +
NPC réel) = PASS (365 tests, 0 échec) ; typecheck = PASS ; lint = PASS (0
erreur, 31 avertissements préexistants sous le seuil de 300) ;
`test:zero-debt`/`check:no-hardcoded`/`check:docs-archive`/
`governance:audit`/`test:governance`/`security:repo`/
`security:forbidden-artifacts` = PASS ; Semgrep (config CI exacte, diff
scope) = PASS (0 bloquant) ; build standalone production = PASS
structurellement (compilation, typecheck, 95/95 pages statiques, artefact
`verify-standalone-artifact.mjs`/`audit-production-artifact.js`/
`check-production-artifact.ts` tous PASS individuellement) avec une
exception documentée non bloquante : le garde `validate-next-traces.js`
(préexistant, non touché par cette branche) rejette tout chemin contenant
un segment `.worktrees` — structurellement impossible à satisfaire depuis
un checkout de travail agent (`/…/.worktrees/<branche>/…`), reproductible à
l'identique sur `origin/main` bâti depuis le même emplacement ; E2E Golden
Family (`e2e/auth/core-golden-family.spec.ts`, Chromium, pile jetable
locale, exécuté réellement sur le HEAD final après correctifs) = PASS (1
passed, 22.8s, nettoyage synthétique inclus dans le test) ; gates CI
nécessitant une infrastructure indisponible localement (CodeQL/GitGuardian/
Cubic : non configurées dans ce dépôt ; suites ARIA/RAG et Firefox/WebKit/
mobile Playwright de la Tâche 17 : non ré-exécutées ici, hors du diff de
cette tâche pour les premières, gap déjà documenté et accepté en Tâche 17
pour WebKit) = notées explicitement, jamais présentées comme PASS.

```
FINAL_P0_OPEN = 0
FINAL_P1_OPEN = 0
FINAL_P2_OPEN = 0
FINAL_P3_OPEN = 1 (documenté ci-dessus, non bloquant)
```

### Statut

```
CORE_PLATFORM_GO_LIVE_READY = GATES_PASSED — DRAFT_PR_OPENED — PENDING HUMAN_REVIEW=APPROVED ET CI REQUISE AVANT MERGE
RAG_FEATURE_GO_LIVE_READY = BLOCKED (inchangé — hors périmètre de cette tâche)
```

Merge, déploiement, migration production et `CURRENT_SWITCH` restent hors
du périmètre de cette tâche et n'ont pas été exécutés.

## Preuve — Tâche 20 : convergence avec `origin/main` (PR #217) et correction du rouge E2E (7 septembre 2026)

Base en début de tâche : `b8844d33` = ancien HEAD PR #215. Périmètre :
absorber `origin/main` (qui a avancé de PR #217, « N4A — current-release
academic identity convergence », depuis la Tâche 19), reproduire puis
corriger le rouge E2E réel constaté par la CI GitHub à cet ancien HEAD,
sans jamais merger, déployer, migrer la production ni marquer la PR prête.

### 1. Ancien PR HEAD / nouveau PR HEAD

`845c648aa5a1c0b13d142110511e4f5e9fb3e167` (ancien) → HEAD final de cette
tâche après 7 commits de convergence (merge + P3 + faux positif local + 5
commits de migration E2E) — voir liste complète en fin de section.

### 2. Main absorbé

`git fetch origin --prune` revérifié en tout début de tâche :
`origin/main` = `ddeb12789b2e649f1191736a21b284038736db57` (inchangé depuis
la vérification du coordinateur), toujours 27 commits en avance sur le
merge-base `95f518e31`, toujours 52 commits de retard côté PR #215. Fusionné
par `git merge origin/main` (jamais de rebase) → commit de merge
`cdd120e5b` sur cette branche.

### 3. Fichiers/conflits sémantiques #215 vs #217

Exactement 3 fichiers touchés des deux côtés depuis le merge-base :
`audit_dsahboard.md` (sections disjointes, pas de conflit sémantique),
`lib/rate-limit/sensitive.ts` et
`__tests__/lib/rate-limit.s3-final-contract.test.ts` (chaque branche ajoute
une clé différente au même objet de politiques, à des points distincts du
fichier). **Le merge Git a résolu automatiquement les 3 fichiers sans aucun
marqueur de conflit** — vérifié après coup que les deux clés (`family-create`
et `programme-rag-v2`) sont bien présentes dans le fichier fusionné et que
le test contractuel correspondant passe (3/3). Aucune intervention manuelle
n'a donc été nécessaire malgré l'anticipation initiale d'un possible
conflit sémantique sur `lib/rate-limit/sensitive.ts`.

Audit complémentaire (hors chevauchement textuel direct, mais dans le
périmètre demandé par le Release Owner pour l'autorité académique) :
`auth.config.ts` et `middleware.ts` ont chacun un historique divergent
entre `origin/main` (qui ne connaît pas encore la centralisation
`lib/auth/role-destinations.ts` construite par cette branche) et le HEAD
de cette branche (qui la possède déjà, Tâche 19). Le fichier fusionné a
été vérifié après coup : les deux conservent la version centralisée
`getRoleDestination()` de cette branche, y compris l'exception ADMIN sur
les pages assignments/planning partagées — aucune régression de ce
mécanisme après merge.

### 4. Nombre d'autorités académiques

Audit relu en détail (post-merge, lecture seule) : `ACADEMIC_WRITE_
AUTHORITIES = 1` (`replaceStudentChosenCoursesWithinTransaction`,
`lib/curriculum/enrollment.ts:282-312` — seule fonction à écrire dans
`studentAcademicEnrollment`, structurellement imposé par l'interdiction
Prisma d'imbriquer `$transaction`) ; `CURRICULUM_VALIDATION_AUTHORITIES = 1`
(`validateChosenCourses`, `lib/curriculum/validation.ts:32-91`, pure,
zéro import serveur, ré-exportée — jamais réimplémentée — par
`enrollment.ts`) ; `ACADEMIC_REVISION_AUTHORITIES = 1`
(`updateStudentAcademicProfile`, `lib/curriculum/student-academic-profile.ts:83-149`,
seul endroit à faire le CAS optimiste sur `Student.academicRevision`
atomiquement avec l'écriture des enrollments). Aucune duplication trouvée :
`app/api/assistante/students/[studentId]/academic-enrollments/route.ts`,
`app/api/assistante/families/route.ts` et `app/api/admin/users/route.ts`
délèguent tous à cette même autorité unique, sans logique parallèle. La
terminologie « UNIQUE_MAPPING / AMBIGUOUS_MAPPING » ne correspond à aucune
construction réelle du code (le mécanisme réel est
`lib/curriculum/legacy-migration-map.ts`, une table statique avec garde
fail-closed à l'import qui lève `Correspondance héritée dupliquée` sur
toute clé en double) ; #217 ne touche aucun fichier sous
`data/curriculum/`, donc aucune nouvelle collision introduite. 154/154
tests des suites `__tests__/lib/curriculum/*` et
`__tests__/architecture/academic-enrollment-writer-boundary.test.ts`
PASS. Couverture des matières dans les tests confirmée pour SES, SVT,
HGGSP, HLP, DGEMC, Mathématiques et NSI (aucune matière silencieusement
non couverte).

### 5. Reproduction puis correction du rouge E2E réel

Reproduit à l'identique contre le code post-merge (build standalone réel,
Postgres/Redis/Mailpit jetables reproduisant exactement la recette du job
CI `E2E Parcours Authentifiés`) : les **10 mêmes tests** listés par le
coordinateur échouent, avec la même cause racine — ces fixtures
supposaient que `POST /bilan-gratuit` créait directement un
`User(PARENT)`+`Student` (Tâche 4 de cette branche a délibérément changé ce
comportement en `FamilyRequest(type=BILAN_GRATUIT)` qualifié puis converti
par le staff). Voir `E2E_CONTRACT_MIGRATION.csv` (racine du dépôt, non
versionné — exclu par une règle `.gitignore` préexistante sur les exports
`.csv` — conservé comme artefact de tâche) pour la classification complète
test-par-test : propriété métier conservée, ancienne hypothèse, nouveau
flux canonique, statut. Synthèse : **10/10 corrigés, 0 supprimé sans
remplacement, 0 propriété métier perdue.**

Un nouvel helper partagé `e2e/helpers/canonical-family.ts::
convertBilanGratuitRequest(browser, email)` qualifie et convertit la
`FamilyRequest` via la même route canonique que le staff production
(`POST /api/assistante/family-requests/[id]/convert`), dans un contexte
navigateur isolé, sans jamais insérer de raccourci Prisma direct. Un seul
test (`initial-student-activation.spec.ts`) a nécessité un flux différent
(route assistante directe en mode WHATSAPP, comme
`core-golden-family.spec.ts`) car le mode PAPER_ENTRY émet immédiatement un
jeton d'activation élève dès qu'un e-mail parent est fourni
(`lib/families/create-family.ts:398`), ce qui aurait invalidé la prémisse
même de ce test (jeton nul tant que le parent ne déclenche pas
explicitement l'activation).

Les deux tests de dialogue (`dialog-all-roles-proof.spec.ts`,
`dialog-charte-proof.spec.ts`) n'ont nécessité qu'une mise à jour du
sélecteur du bouton déclencheur (« Ajouter un Enfant » → « Demander l'ajout
d'un enfant ») : ce sont des tests de fumée UI/a11y/charte qui n'ont jamais
affirmé la sémantique métier de création — celle-ci est déjà couverte par
`__tests__/api/parent.children.route.test.ts`.

### 6. Golden Family — flake pré-existant identifié puis corrigé (non introduit par cette tâche)

`e2e/auth/core-golden-family.spec.ts` échouait de manière intermittente,
d'abord observé localement (2 échecs sur 4 exécutions, à des étapes
différentes — toutes deux dans `signInAs` juste après un
`clearCookies()`+navigation vers `/auth/signin`, qui aboutissait malgré
tout sur le tableau de bord du rôle précédent), puis confirmé en **CI
GitHub réelle** (§ 13) sur le premier push de cette section corrigée — la
preuve que ce n'était pas un artefact de bac à sable local. Confirmé
**non lié à cette tâche** : `core-golden-family.spec.ts` et
`e2e/helpers/golden-family.ts` sont une création propre de cette branche
(Tâche 17), absente d'`origin/main`, donc non touchée par le merge.
Hypothèse retenue : une requête de rafraîchissement de session côté
client, encore en vol depuis la page précédente, résout son
`Set-Cookie` juste au moment où `clearCookies()`+navigation vers
`/auth/signin` la court-circuitent, ressuscitant une session qui fait
rediriger le serveur vers l'ancien tableau de bord. `retries: 0` dans
`playwright.auth.config.ts` signifiait que la CI réelle pouvait
occasionnellement rencontrer ce même flake sans filet.

**Corrigé** (commit `c37b5ce7d`, § 13) : `signInAs()` détecte l'atterrissage
hors de `/auth/signin` et rejoue une seconde fois `clearCookies()`+navigation
— même famille de parade que `gotoStable()` (même fichier) utilise déjà pour
une classe de course apparentée sur WebKit. Vérifié vert sur 3 exécutions
locales fraîches consécutives après correctif, puis confirmé vert en CI
réelle sur le HEAD final (§ 13).

### 7. RAG désactivé (Tâche 16, invariant revérifié)

`__tests__/architecture/core-rag-independence.test.ts` : 7/7 PASS contre
le code post-merge. `RAG_API_BASE_URL` absent, aucune credential RAG dans
l'environnement. `EXPECTED_RAG_OUTBOUND_REQUESTS = 0` confirmé.

### 8. P3 temps/planning corrigé

`app/api/coaches/available/route.ts` utilisait `new Date(date).getDay()`
pour son filtre facultatif de jour de semaine — dépendant du fuseau
horaire local du *processus serveur* (jamais reproduit dans ce bac à
sable, qui tourne par coïncidence en Africa/Tunis, UTC+1, qui ne recule
jamais par rapport à UTC). RED reproduit avec
`TZ=America/Los_Angeles` : le filtre calculait Dimanche au lieu de Lundi.
Corrigé en réutilisant la convention déjà établie
(`lib/planning/series.ts::parseCalendarDate` + `.getUTCDay()`, Tâche 11)
au lieu d'une quatrième implémentation de conversion de calendrier.
Vérifié vert sous Africa/Tunis, UTC, America/Los_Angeles et
Pacific/Kiritimati (UTC+14). Une valeur `?date=` invalide continue de
neutraliser silencieusement le filtre facultatif (200, pas 500),
comportement inchangé. `FINAL_P3_OPEN = 0` (l'unique P3 documenté et
laissé non bloquant en Tâche 19 est maintenant fermé).

### 9. Faux positif local `aria-playwright-collection-guard.test.ts`

Confirmé reproduit exactement comme documenté en Tâche 19 : ce test
échouait dans tout worktree possédant déjà un `e2e/.credentials.json`
réel (untracked, issu d'un run E2E antérieur), car il forçait
`E2E_CREDENTIALS_PATH` vers un chemin temporaire jamais écrit dans ce cas
précis, au lieu de réutiliser le fichier réel déjà présent. Corrigé en
résolvant un chemin de credentials garanti existant (réel si présent,
sinon `E2E_CREDENTIALS_PATH` du site appelant si déjà valide, sinon un
fichier factice fraîchement écrit) sans affaiblir la propriété réellement
testée (un run réel de `playwright test --list` prouve toujours que la
voie générique n'embarque aucune spec ARIA). Vérifié vert à la fois avec
et sans `e2e/.credentials.json` préexistant dans ce worktree.
`LOCAL_UNIT_FAIL = 0`.

### 10. IP/hostname — compteurs (jamais la valeur)

```
CURRENT_TREE_OCCURRENCES = 0
BRANCH_HISTORY_OCCURRENCES = 4
PR_HISTORY_OCCURRENCES = 4
```

La valeur a été introduite par les commits de preuve de la Tâche 18
(`9a247a909`/`60eaa4925`/`8e79ffadb`) puis rédigée par `54dd0e834`, tout
cela **avant** le début de cette tâche et déjà documenté en Tâche 19. Ces 4
occurrences historiques (2 fichiers × 2 lignes) sont donc déjà publiques
sur GitHub (l'historique de la PR est public) et le resteraient même après
une réécriture d'historique. Classification : `SENSITIVE_INFRA_METADATA`
(IP + alias SSH d'un hôte de production réel, pas une simple convention de
nommage publique). **Décision de réécriture d'historique non prise dans
cette tâche** — conformément à l'instruction explicite de m'arrêter sur ce
point précis pour jugement humain. Aucun `force-push`, aucune préparation
de rewrite exécutée.

Incident de transparence à signaler : lors de l'inspection du commit de
rédaction `54dd0e834` pour établir ces compteurs, la valeur en clair a été
affichée deux fois dans des sorties d'outil internes à cette session (une
fois par l'agent principal, une fois par un sous-agent fork partageant le
même contexte) — jamais publiée nulle part, jamais incluse dans un commit,
un message de commit ou ce document, mais signalé explicitement plutôt que
tu, conformément à la consigne de transparence.

### 11. Répétitions de migration après merge

Lanes fresh-DB et synthetic-DB rejouées après merge (`scripts/core/
rehearse-core-migration.sh`, conteneurs/réseau/volumes jetables et
nommés pour ce run) : `ALL LANES PASS`. Le nombre d'assignations
`BACKFILL_AMBIGUOUS` observé après backfill (1) provient d'une ligne
synthétique **délibérément** semée en état ambigu par
`scripts/core/rehearsal-seed-synthetic.ts` pour exercer cette
classification elle-même — ni une régression ni un effet des nouveaux
courseKeys de #217 (Phase 3 confirme #217 ne touche aucun fichier
`prisma/migrations/`). Lane production-clone : **non ré-exécutée** dans
cette tâche (conformément à l'instruction explicite de ne pas re-solliciter
l'hôte de production réel) — la preuve de la Tâche 18
(`PRODUCTION_CLONE_MIGRATION_REHEARSAL = PASS`, second addendum ci-dessus)
reste valide telle quelle puisque le diff `origin/main` sur
`prisma/migrations/`+`prisma/schema.prisma` est vide.

### 12. CI complète — local puis GitHub réel

Local (post-merge, HEAD final) : TypeScript = PASS (0 erreur) ; Lint =
PASS (0 erreur, avertissements pré-existants sous le seuil) ; suite
unitaire complète = PASS (12703 + 23 = 12726 tests sur 1113 suites — un
worker tué par SIGTERM lors d'un run concurrent avec d'autres processus
lourds de cette même tâche, confirmé non reproductible en isolation) ;
suite d'intégration réelle-DB (balayage principal avec les exclusions
exactes de la CI + 3 lanes isolées CI) = PASS (55+1+1+3 = 60 suites, 296+3+10+12
= 321 tests) — lanes NPC réelles (`scripts/testing/run-npc-real-db-tests.sh`,
exigent UID 0 et un runtime PostgreSQL 15 dédié) **non exécutées dans ce
bac à sable** (limite d'environnement, non un résultat rouge) ; `next
build` = PASS (le standalone a effectivement servi tous les rôles pendant
toute cette tâche) ; `prisma validate`/`generate`/`migrate status` = PASS,
aucune dérive ; `security:repo` = PASS ; `security:forbidden-artifacts` =
PASS (`FORBIDDEN_ARTIFACT_GATE=PASS`, 90007 fichiers balayés) ;
`test:zero-debt` = PASS (5398 fichiers inspectés, tous compteurs à 0) ;
E2E Parcours Authentifiés (les 10 tests + `core-golden-family.spec.ts`,
Chromium, pile jetable locale reproduisant exactement la recette du job
CI) = 10/10 + Golden Family PASS individuellement (voir § 6 pour le flake
Golden Family en exécution groupée).

### 13. GitHub CI réelle — deux cycles de correction jusqu'au vert complet

Premier push (`b8844d339`) : CI GitHub déclenchée, 38/40 checks PASS, 2 en
échec (`E2E Parcours Authentifiés`, `CI Success`). Cause réelle isolée
dans le log du job (`gh api .../jobs/101839207332/logs`) : 113/114 tests
E2E PASS, un seul échec — `initial-student-activation.spec.ts` a heurté un
`409 POTENTIAL_DUPLICATE` (`matchStrength: NAME_AND_LEVEL`) sur
`POST /api/assistante/families`, car son foyer fictif partageait le nom
littéral « Parent Synthétique » avec trois autres specs de ce même lot
(`bilan-golden-path.spec.ts`, `bilan-worker-autonomous.spec.ts`,
`canonical-attempt-level-guard.spec.ts`) qui créent un foyer réel du même
nom plus tôt dans la même exécution CI, via une voie d'entrée
(`/bilan-gratuit`) que cette garde anti-doublon ne voit pas à la création —
seule cette spec, seule à utiliser la voie assistante directe, la
rencontre. Corrigé (commit `647991252`) en rendant le `parentLastName` de
cette fixture unique par nonce, comme son e-mail/téléphone l'étaient déjà.
Vérifié localement en rejouant exactement la séquence collisionnante (les
4 fichiers, même base jetable, sans reset entre) : 22/22 PASS.

Second push (`647991252`) : nouvel échec, différent — `core-golden-family.
spec.ts` (le capstone, § 6 ci-dessus) a échoué **en CI réelle**, à la même
étape (« ending assignment A… ») et selon le même mécanisme déjà
diagnostiqué localement : `signInAs()` atterrit sur le tableau de bord du
rôle précédent au lieu du formulaire de connexion. Ceci confirme que ce
flake n'est pas propre à ce bac à sable local — c'est un défaut
d'environnement E2E réel, préexistant à cette tâche (fichier absent
d'`origin/main`, jamais touché par le merge), mais désormais corrigé
(commit `c37b5ce7d`) : `signInAs()` détecte l'atterrissage erroné et
reproduit le clear+navigate une seconde fois — même famille de parade que
`gotoStable()` (même fichier) utilise déjà pour une classe de course
apparentée. Vérifié localement sur 3 exécutions fraîches consécutives
(0 échec, contre un taux d'échec observé de l'ordre de 40-50% sur les
exécutions précédentes de cette tâche).

Troisième push (`c37b5ce7d`, HEAD final de cette tâche) : **40/40 checks
PASS**, y compris `E2E Parcours Authentifiés` (11m22s) et l'agrégat
`CI Success`. Vérifié check par check (`gh pr checks 215`), pas seulement
l'agrégat — aucun job secondaire rouge.

### Statut à l'issue de la Tâche 20

```
BRANCH_LOCAL = PASS (0 P0/P1/P2, P3 fermé)
MERGE_WITH_CURRENT_MAIN = MERGED_CLEAN (cdd120e5b, 0 conflit manuel, autorités académiques = 1/1/1)
REMOTE_CI = PASS (40/40 checks, HEAD c37b5ce7d, 2 cycles de correction post-push documentés ci-dessus)
HUMAN_REVIEW = DISMISSED (revue précédente invalidée par tout nouveau HEAD) — nouvelle revue demandée par commentaire PR sur le HEAD final, pas encore obtenue
PRODUCTION = NOT_DEPLOYED (inchangé)
```

```
CORE_MERGE_CANDIDATE_READY = true (CI verte complète sur le HEAD final, 0 P0/P1/P2/P3 ouvert — reste PENDING HUMAN_REVIEW=APPROVED avant tout merge)
CORE_PLATFORM_GO_LIVE_READY = false (inchangé — décision de mise en service réelle hors périmètre de cette tâche)
RAG_FEATURE_GO_LIVE_READY = BLOCKED (inchangé — hors périmètre)
```

Merge, déploiement, migration production et `CURRENT_SWITCH` restent hors
du périmètre de cette tâche et n'ont pas été exécutés.

## Certification post-merge — CORE_PRODUCTION_PROMOTION_READY (8 septembre 2026)

Base : PR #215 (`e7c63ec00`) puis PR #218 (correction de gouvernance
Core/RAG, gouvernance/ops uniquement — `fix/core-only-deploy-rag-gate-20260907`)
fusionnée par-dessus.

```
FINAL_RELEASE_SHA = b151e83dddf7bddc5b3901c7c52491854dec2a48
POST_MERGE_CI = PASS (30/30 checks, 0 échec)
FINAL_REHEARSAL (sauvegarde production du 7 septembre, restauration isolée) = PASS_AVEC_RESERVE (migration + backfill + idempotence + compatibilité applicative tous PASS ; Golden Family E2E non rejoué sur cet instantané précis — atténué par son succès déjà établi en CI réelle sur ce même SHA et sur deux instantanés production antérieurs, voir le document détaillé)
FINAL_ARTIFACT = build/security/SBOM tous PASS, ARTIFACT_SHA256 documenté
ROLLBACK_DRY_RUN = PASS (garde réel testé, 4 scénarios dont un rejet attendu)
IP_METADATA_INCIDENT = reconfirmé inchangé (0 en arbre courant, 4/4 historique immuable), classification SENSITIVE_INFRA_METADATA, décision de réécriture toujours en attente d'un jugement humain explicite
P0/P1/P2/P3_OPEN = 0
```

```
CORE_PRODUCTION_PROMOTION_READY = true
CORE_PLATFORM_GO_LIVE_READY = false (inchangé — nécessite un déploiement réel et une recette réelle)
```

Détail complet, preuves, plan de promotion exact et plan de recette :
`docs/audits/2026-09-08-core-production-promotion-certification.md`.

## Preuves et changement de décision

Les valeurs ci-dessus sont des décisions documentaires, pas des variables
d'environnement ni des interrupteurs de production. Aucun code RAG n'est modifié
par ce lot. Actualiser séparément chaque décision avec SHA, date, commandes,
résultats et limites. Ne pas transformer automatiquement la réussite d'un test
unitaire en autorisation de déployer.

Matrice et preuves : `docs/audits/2026-09-06-core-platform-go-live.md`.
