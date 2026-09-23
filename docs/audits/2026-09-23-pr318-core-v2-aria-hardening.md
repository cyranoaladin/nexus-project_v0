# PR #318 — qualification Core v2 ARIA foundation

## Date

23 septembre 2026.

## Contexte

La PR #318 introduit le cockpit ARIA natif Core v2 sans porter encore le moteur conversationnel natif. La qualification demandée ferme les findings précédents sur les droits, les scopes de cours, les options réellement suivies, l'honnêteté des capacités UI et l'absence d'appel au chat legacy depuis une session Core v2.

Ce rapport consigne les décisions et preuves locales de la branche. Le SHA qualifié est toujours celui observé sur la PR au moment du handoff, après vérification de l'égalité local/distant et terminaison des checks GitHub ; le document ne présume donc pas lui-même d'un head final.

Cette PR reste un état intermédiaire : `capabilities.chat = false` pour `CORE_V2`, tandis que V1 conserve son launcher et son chat. Le GO-LIVE ARIA reste bloqué par la PR C, qui devra réutiliser le moteur conversationnel existant avec persistance, routes, recovery et wiring Core v2 natifs. Aucun contournement legacy n'est autorisé entre-temps.

## Problèmes observés

- Le modèle Core v2 ne portait pas initialement un tier ARIA non nul et complet.
- Les grants Core v2 risquaient de devenir un second moteur de droits, distinct du kernel canonique.
- Les scopes de cours pouvaient être aplatis en simples feature keys.
- Les options théoriquement présentes au catalogue pouvaient être pinnées sans inscription académique réelle.
- Le cockpit Core v2 pouvait présenter le chat legacy et des états vides comme si les capacités avaient été réellement calculées.
- Le harness E2E Core v2 ne protégeait pas assez strictement la cible de base jetable et n'était pas répétable sur une même stack.
- La revue finale a détecté une sur-lecture de PII dans le contexte étudiant ARIA et un 404 qui exposait l'identifiant utilisateur interne.
- Le premier cycle CI du rapport a détecté que le second `User.upsert` ajouté au seeder E2E n'était pas classé dans l'inventaire exhaustif des mutations de sécurité.
- Le cycle CI suivant a révélé une régression V1 dans la lane ARIA desktop : trois parcours historiques ne pouvaient plus ouvrir une matière académiquement suivie mais hors sélection commerciale.
- La revue automatisée fraîche sur `f068596e39ebc0a1f7201b021aae0d90e8b9a0c4` a détecté un autre chemin legacy : ouvrir un workspace Core v2 déclenchait encore mastery, next-best-action et workshops sous `/api/aria/**`.

## Décisions prises

- `CoreV2AriaTier` est non nul avec `ARIA_AUTONOMIE` par défaut ; les valeurs supportées sont `ARIA_AUTONOMIE`, `ARIA_SUIVI` et `ARIA_ACCOMPAGNEE`.
- Les grants sont adaptés en `AriaEntitlementRecord`, puis résolus exclusivement par `buildCanonicalAriaEntitlementContext` et `resolveAriaCapabilities`. Aucun ranking, filtre temporel ou capability matrix parallèle n'a été créé.
- `featureKey`, `ariaTier` et `courseScopes` restent trois dimensions distinctes. Les contexts par feature gouvernent l'accès aux cours ; le contexte agrégé gouverne les capacités de formule.
- Un scope vide signifie `GLOBAL`; un scope non vide reste limité aux cours explicitement listés.
- Les pins Core v2 reposent sur les `StudentCourseEnrollment` réelles, plus les cours core/track obligatoires. Les pins devenues stale sont filtrées à la lecture.
- Le bootstrap V1 reste inchangé : les options théoriquement sélectionnables restent proposées sous `LEGACY_FEATURES`. Cette décision produit explicite est couverte par les tests V1 ; elle ne rouvre pas le chemin Core v2, qui reste enrollment-backed.
- `chat` est une capability de déploiement explicite : V1 `true`, Core v2 `false`. Aucune route `/api/aria/**` n'est appelée par la session Core v2.
- `courseWorkspace` est également une capability de déploiement explicite : V1 `true`, Core v2 `false`. Quand elle est fausse, le cockpit ne transmet aucun callback d'ouverture, n'affiche aucun bouton `Ouvrir` et ne peut donc monter ni les effets mastery/NBA ni le composant workshops legacy. Les routes natives correspondantes restent volontairement hors périmètre jusqu'à la PR C.
- Les capacités indisponibles rendent un état neutre unique, distinct de `AVAILABLE_EMPTY`.
- Le seeder E2E refuse toute cible qui n'est pas exactement la base `core_v2_e2e` sur les hôtes/ports locaux ou compose autorisés, même si le marker jetable est présent. Les erreurs ne journalisent jamais l'URL ou les credentials.
- Le contexte étudiant ARIA possède désormais une projection dédiée minimale : identifiants et noms nécessaires, au plus deux inscriptions `ACTIVE` de l'année `CURRENT`, champs scolaires utiles et clés/types de cours. Email, téléphone, date de naissance, household, parents, statut de compte et timestamps ne sont ni sélectionnés ni retournés.
- Le 404 ARIA Core v2 est générique et ne sérialise ni `userId` ni `details` sensibles.
- Les deux `User.upsert` du seeder E2E (persona ARIA et comptes staff/coach) sont inventoriés comme mutations sensibles. Un reseed qui réécrit leurs credentials incrémente `sessionVersion` et révoque ainsi toute session Core v2 existante.
- L'action de consultation `Ouvrir` reste disponible pour une matière académiquement pertinente et supportée, y compris hors sélection commerciale, conformément au comportement V1. Le mode sélection exige toujours le droit commercial, et aucune action `Ouvrir`/`Ajouter` n'est exposée pour une option Core v2 non enrollée ou hors scope.

## TDD et preuves RED/GREEN

- Grants/scopes : tests RED sur tier, statut/dates, GLOBAL/COURSE, grants expirés/révoqués et highest tier ; GREEN via l'adapter canonique.
- Pins/options : RED sur options non enrollées et pin stale ; GREEN avec validation et filtre de lecture fondés sur les enrollments.
- UI/chat : RED sur launcher Core v2 et faux états vides ; GREEN avec `chat=false`, callbacks gated et composant d'indisponibilité partagé.
- E2E hardening : RED sur guard de cible, reset absent et option hors scope non observable ; GREEN avec guard exact, reset transactionnel et option visible mais non actionnable.
- IPv6 : RED 1/13, car `[::1]` était refusé ; GREEN 13/13 avec `[::1]` exact et `[::2]` toujours refusé.
- PII/erreur : RED 2/2, car la requête passait par le read model étendu et le 404 exposait `userId`; GREEN 26/26 sur le test exact de projection/erreur et la route native Core v2.
- Inventaire de révocation CI : RED 1/18 sur `session-revocation-boundary`, car `seed-e2e-staff-actors.ts:upsert#2` était absent de l'inventaire ; GREEN 18/18 après classification des deux upserts et ajout de l'incrément `sessionVersion` au reseed du persona ARIA.
- Actionnabilité V1/Core v2 : RED 1/9 sur la carte de cours, reproduisant l'absence de `Ouvrir` pour une matière V1 pertinente mais commercialement locked ; GREEN 9/9 après séparation des règles consultation/sélection, avec les contre-épreuves Core v2 non pertinentes toujours non actionnables.
- Workspace legacy Core v2 : RED sur les tests shell/page, qui trouvaient encore six boutons `Ouvrir`; GREEN après ajout de `courseWorkspace=false`, suppression des callbacks d'ouverture et extension de la denylist Core v2 à toute route `/api/aria/**`. La contre-épreuve V1 conserve le launcher et ouvre réellement le workspace.

## Fichiers modifiés

- Modèle/migration Core v2 : `core-v2/prisma/schema.prisma`, migration `0018_core_v2_aria_foundation`.
- Grants et contexte étudiant : `lib/core-v2/aria/access-grants.ts`, `lib/core-v2/aria/student-context.ts`.
- Curriculum et pins : resolver, mapping migration, profil cockpit et routes `/api/v2/aria/cockpit/**`.
- Contrats et composants cockpit : capabilities, chat gating, états indisponibles, wizard/cartes de cours.
- Tests unitaires, DB, route, composants et architecture sous `__tests__/`.
- Harness/browser : `e2e/auth/core-v2-aria-foundation.spec.ts`, helpers, seeders, Dockerfile Playwright et compose E2E.

## Tests exécutés

- Ciblés Tasks 2/4 : 2 suites, 37 tests passés.
- Ciblés resolver/page/composants Tasks 5/6 : 5 suites, 61 tests passés.
- Projection PII + routes natives après correction : 2 suites, 26 tests passés.
- `npm run test:aria:unit` : 138 suites, 2 069 tests passés.
- `npm run test:aria:api` : 24 suites, 206 tests passés.
- `npm run test:aria:integration` : 9 suites, 27 tests passés.
- `npm run test:aria:sse` : 1 suite, 36 tests passés.
- Suite Core v2 complète sur `nexus_pr318_test` : 52 suites passées, 476 tests passés, 3 tests explicitement skipped.
- Architecture ARIA : 16 suites, 62 tests passés.
- Guards Core v2 : 2 suites, 58 tests passés.
- `npx prisma generate` et `prisma validate` sur le schéma Core v2 : passés.
- Base `nexus_pr318_test` recréée depuis un schéma vide : 18 migrations appliquées, status up-to-date, drift `-- This is an empty migration.`
- `npm run typecheck` : passé après la correction PII.
- `npm run lint` : passé.
- `npm run check:e2e-ownership` : 128 specs suivies, 128 attribuées, 0 orpheline.
- `npm run check:e2e-syntax` : passé, aucune quarantaine/focus.
- Gates sécurité/dette/enums/docs : passées (`security:repo`, `test:zero-debt`, `check:no-hardcoded`, confidentialité, archive, `enums:check`).
- Gates ARIA statiques : passées (`typecheck:aria-scripts`, sécurité, manifest, performance, reachability, integrity, evaluation contract, source artifact).
- `npm run build:base` : passé, 95 pages générées.
- Playwright Chromium réel sur stack jetable : 2/2 passés, puis 2/2 passés une seconde fois sur la même stack sans reseed manuel. Le second passage prouve la répétabilité du reset transactionnel.
- Correctif du finding CI : garde `session-revocation-boundary` 18/18, guards/persona de seed Core v2 14/14, `npm run typecheck` et ESLint ciblé passés.
- Correctif de la régression navigateur : test composant de carte 9/9, dont l'ouverture V1 locked et l'absence d'actions pour les options Core v2 non pertinentes.
- Correctif de la revue fraîche workspace : page/shell/carte 19/19, route Core v2 native 24/24, suite ARIA unitaire 2 070/2 070, architecture ARIA 62/62, `npm run typecheck`, ESLint ciblé, ownership et syntax E2E passés. Le test E2E bloque désormais toute requête legacy `/api/aria/**`, vérifie l'absence de `Ouvrir` en Core v2 et l'ouverture du workspace en V1.

## Résultats

- Les semantics de tier, validité et capabilities commerciales restent centralisées dans le kernel canonique.
- Les scopes de cours sont appliqués par feature sans grant global accidentel.
- Une option Core v2 non enrollée ou hors scope n'est jamais pinnable ni actionnable.
- Les surfaces V1 conservent le comportement de bootstrap et le launcher/chat existants.
- Core v2 n'affiche aucun contrôle chat ou workspace actif et la denylist réseau de toute la surface `/api/aria/**` reste vide.
- Les capacités non déployées sont présentées comme indisponibles, jamais comme des résultats calculés vides.
- La minimisation PII est vérifiée sur le `select` Prisma exact et le payload construit.
- La revue indépendante du diff complet n'a trouvé aucun modèle/route conversationnelle de PR C. Son finding V1 a été rejeté car contraire à l'exigence explicite de préserver le bootstrap V1 ; ses deux findings PII ont été corrigés et testés.

## Écarts et avertissements non bloquants

- `npm run lint` signale 27 warnings `no-explicit-any` préexistants hors du diff PR #318 ; la commande termine avec succès et aucun warning ne vise les fichiers ajoutés ici.
- Prisma 6.19.3 signale la dépréciation de `package.json#prisma`; ce warning est préexistant.
- Le build signale l'utilisation de `CompressionStream`/`DecompressionStream` de `jose` dans l'Edge Runtime ; warning préexistant, compilation réussie.
- `aria:manifest:check` retourne `NOT_CONFIGURED / SERVABLE_INDEX_NOT_PROMOTED` avec exit 0, état attendu de l'environnement local et non une activation RAG de PR C.
- `aria:evaluate:check` conserve `PENDING_HUMAN_REVIEW` avec exit 0 ; aucune revue humaine n'est demandée à ce stade.

## CI et revue fraîche

- CI GitHub sur `f068596e39ebc0a1f7201b021aae0d90e8b9a0c4` : complète et verte, y compris `CI Success`, les quatre lanes ARIA Browser et les lanes E2E Auth.
- Revue automatisée fraîche sur ce même SHA : terminée et applicable ; elle a produit le finding P1 workspace legacy décrit ci-dessus. Le correctif impose un nouveau SHA, une nouvelle CI complète verte puis une nouvelle revue automatisée applicable avant de déclarer la PR review-ready.
- Revue humaine : non demandée et non conservée avant fermeture de ces deux gates.

## Risques restants

- `CORE_V2` n'a volontairement aucun chat natif dans cette PR.
- Conversation, turns, history, feedback, recovery, provider/RAG réel et E2E conversationnel restent une hard dependency de PR C après merge de #318 depuis le nouveau `main`.
- Aucun déploiement, aucune migration de production et aucune activation GO-LIVE ne sont autorisés par cette qualification.

## Rollback

- Avant merge : fermer la PR ou supprimer la branche suffit ; aucune donnée de production n'a été modifiée.
- Après merge mais avant déploiement : revert des commits PR #318 en ordre inverse. La migration ARIA est additive ; ne pas supprimer l'enum/colonne dans une migration de rollback improvisée.
- Après application d'une migration sur un environnement autorisé : conserver le schéma additif, désactiver l'autorité Core v2/ARIA par configuration, puis préparer un rollback applicatif revu. Ne jamais supprimer des grants ou profils sans sauvegarde et plan de recovery.
