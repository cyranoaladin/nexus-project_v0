# Raccordement réel du shadow mode (mission recâblage §4)

Ce document répond point par point à ce que la mission demande de vérifier explicitement — pas seulement
« ça marche », mais quel chemin runtime réel, avec quelles garanties.

## Quelle route lit le flag, quelle route déclenche le shadow

- **`app/api/quotes/route.ts`** (`POST /api/quotes`, création d'un devis — le chemin public réel, appelé
  par le simulateur famille et par le workspace assistante existant) lit `isShadowModeEnabled()`
  (`lib/quotes/pipeline-flag.ts`) juste après avoir construit la recommandation legacy et avant la création
  du `Quote` contractuel (lignes ~166-180 du fichier).
- **`app/api/assistante/candidat-individuel/simulate/route.ts`** (nouveau, mission §5) lit
  `isActiveForInternalStaff()` — un état différent (`ACTIVE_INTERNAL` ou plus, jamais `SHADOW` seul) —
  pour autoriser un appel *direct*, visible, au nouveau moteur, réservé ADMIN/ASSISTANTE. Les deux chemins
  sont distincts par construction : le premier ne rend jamais le résultat du nouveau moteur visible à
  quiconque (famille ou staff), le second ne s'active que pour le staff autorisé et n'affecte jamais le
  chemin public.

## Conditions de déclenchement

`isShadowModeEnabled()` retourne `true` pour les états `SHADOW`, `ACTIVE_INTERNAL`,
`ACTIVE_PUBLIC_PERCENTAGE`, `ACTIVE_PUBLIC` — c'est-à-dire dès que l'état dépasse `OFF`. Aujourd'hui, l'état
réel (`pricing.candidatIndividuelPipeline.state`) est `OFF` par défaut (`getOverrideOr(..., 'OFF')`,
`lib/quotes/pipeline-flag.ts`) — donc le shadow mode ne s'exécute nulle part tant que la direction n'a pas
explicitement activé au moins `SHADOW` via `/api/admin/config` (ADMIN uniquement, audité).

## Où le rapport est persisté

`lib/quotes/shadow-persistence.server.ts::logShadowComparison` écrit une ligne `ShadowComparisonLog`
(`prisma/schema.prisma`, table `shadow_comparison_logs`) — le seul écrivain de cette table. Champs :
`situationChecksum` (SHA-256, pas de PII), `divergenceCategory`, `legacySummary`/`newSummary` (résumés
structurés — sujets, statut, prix agrégé, nombre d'avertissements — jamais un dump brut de la situation ou
du profil), `createdAt`. Indexé sur `(divergenceCategory, createdAt)` pour l'agrégation.

## Politique de rétention

**Aucune n'existe aujourd'hui** — pas de job de purge, pas de TTL, pas de politique documentée avant ce
constat. Vérifié par recherche : aucun cron/script ne référence `shadowComparisonLog`. **Constat honnête,
pas un oubli caché** : tant que le volume reste celui d'une phase de test interne (shadow mode jamais activé
en production à ce jour), ce n'est pas bloquant, mais une politique de rétention (ex. purge à 90 jours) doit
être définie avant une activation `SHADOW` prolongée en environnement réel — recommandation à la direction,
pas une décision technique unilatérale (elle dépend de combien de temps la comparaison doit rester
exploitable pour la décision d'activation publique).

## Absence de PII — vérifiée, pas seulement supposée

`computeSituationChecksum` (`lib/quotes/shadow-comparison.ts`) hache uniquement `level`, `examSession`,
`specialites` (triées), `specialiteAbandonnee`, `langueA`, `langueB` — aucun nom, email, téléphone. Les
résumés (`ComparisonSideSummary`) ne portent que `subjects`/`priceAnnualTnd`/`depositTnd`/
`installmentTnd`/`status`/`warningsCount`. Testé explicitement :
`__tests__/lib/quotes/shadow-comparison.test.ts` (« computeSituationChecksum — jamais de PII ») et
`__tests__/database/shadow-comparison-log.test.ts` (« persists a comparison record with no PII field »),
et `__tests__/api/quotes.create.route.test.ts`'s « SHADOW enabled » test vérifie explicitement que
l'enregistrement loggé n'a pas de `quoteId` (aucune liaison possible vers le devis contractuel).

## Comportement d'erreur

`runShadowComparison` ne lève jamais (toute erreur interne devient une catégorie `NEW_ENGINE_BUG` dans le
résultat). L'appel côté route est en plus entouré d'un `try/catch` isolé
(`app/api/quotes/route.ts` lignes ~171-180) : un échec de comparaison ou d'écriture est loggé
(`console.error`) et **n'affecte jamais** la réponse visible à la famille. Testé :
« SHADOW enabled but the comparison/log throws: the visible response still succeeds ».

## Timeout et impact performance — finding réel, corrigé dans ce lot

Avant ce lot, l'écriture (`await logShadowComparison(...)`) n'avait **aucune borne** — un `await` sans
timeout sur une vraie requête DB. Le contrat affiché par le code lui-même (« never blocks it ») n'était donc
vrai que pour les *échecs* (capturés), pas pour la *latence* : une écriture lente aurait ajouté sa durée
complète à la réponse de chaque famille, tant que le shadow mode est actif — une contradiction silencieuse
avec l'intention affichée. Corrigé : `logShadowComparisonWithTimeout` (nouveau,
`lib/quotes/shadow-persistence.server.ts`) borne l'écriture à `SHADOW_LOG_TIMEOUT_MS` (2000 ms) via
`Promise.race`, résolue par le même `try/catch` isolé déjà en place — un dépassement devient un échec
capturé, pas un défaut nouveau. `app/api/quotes/route.ts` appelle désormais cette version bornée. Testé :
`__tests__/lib/quotes/shadow-persistence-timeout.test.ts` (écriture rapide résout normalement ; écriture
qui ne se termine jamais rejette exactement au seuil, avec horloges factices — pas un test qui attend
réellement 2 secondes).

## Garantie : aucun second Quote n'est jamais persisté

`runShadowComparison`/`buildCandidateQuoteRecommendation` n'écrivent jamais en base — pure, aucun import
Prisma dans `lib/quotes/pipeline.ts` ni `lib/quotes/shadow-comparison.ts` en dehors du type
`ShadowComparisonRecord`. Seul `logShadowComparison` écrit, et uniquement dans `ShadowComparisonLog` — pas
`Quote`. Vérifié par lecture directe du code (aucun `prisma.quote.create` dans le chemin shadow) et par le
test explicite « no PII, no linkage to the contractual Quote » (`__tests__/api/quotes.create.route.test.ts`).

## Couverture de test sur la route réelle — les 3 états

Un simple test unitaire de la fonction shadow serait insuffisant (explicitement rejeté par la mission) — la
couverture existe sur la route réelle :

- **OFF** (`__tests__/api/quotes.create.route.test.ts`, « shadow mode » describe block) : le nouveau
  pipeline ne s'exécute jamais, jamais loggé, réponse identique au comportement historique. Plus un test de
  « preuve de rollback » : repasser de `SHADOW` à `OFF` arrête immédiatement le pipeline, aucun effet
  résiduel d'une requête précédente.
- **SHADOW** : legacy visible et inchangé, nouveau pipeline exécuté en parallèle, divergence loggée, aucune
  écriture contractuelle depuis le nouveau pipeline, un échec du shadow n'a aucun impact famille — 3 tests
  couvrant ces garanties séparément.
- **ACTIVE_INTERNAL** : couvert par `__tests__/api/assistante.candidat-individuel.route.test.ts` (mission
  §5) — le nouveau moteur n'est accessible (via `POST /api/assistante/candidat-individuel/simulate`) que
  pour ADMIN/ASSISTANTE **et** avec le flag à `ACTIVE_INTERNAL` ou plus ; un rôle non autorisé ou le flag à
  `OFF` renvoie 403 dans tous les cas, y compris pour un ADMIN quand le flag est OFF. « Un devis incomplet
  ne peut pas être envoyé » reste porté par le garde-fou d'émission déjà existant et testé
  (`lib/quotes/emission-guard.ts`/`regulatory-maturity.ts`) — inchangé par ce lot, `simulate` ne crée
  d'ailleurs jamais de `Quote` (voir `docs/candidat-individuel/assistante-workspace-surface.md`).
