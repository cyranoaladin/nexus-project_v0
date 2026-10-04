# Attribution des annulations ARIA dans le harnais navigateur

## Cause encore ouverte

Le SHA `7e59831b1a47dad91a5b46cb4d87bd31809e3e13` a reçu HTTP 200 puis `net::ERR_ABORTED` dans E025 et le scénario visuel E020. Les phases expurgées ne désignent pas l'appelant. Les artefacts publics de cette campagne ne contiennent ni trace ni capture exploitable. Aucune annulation API n'est ignorée.

## Instrumentation limitée aux tests

Un observateur est installé juste avant l'envoi canonique. Il restitue exactement la promesse native de fetch, sans lire le corps ni les en-têtes. Il relève réception des en-têtes, rejet de fetch, annulation du signal et trois booléens DOM (dialogue, activation du composer, présence d'alerte). Les métadonnées de l'échec apparaissent comme phases fixes dans le rapport. Le signal est désabonné et fetch restauré en fin d'observation. Aucun code de production, nouveau feature flag ou traitement de contenu.

Ces métadonnées doivent distinguer une annulation cliente d'une coupure sans annulation du signal ; elles ne prouvent pas encore pourquoi l'application annule, ni pourquoi le réseau échoue.

## Vérifications

- Parseur natif isolé dans Chromium : 20 flux terminés, 20 événements requestfinished, zéro requestfailed.
- Observateur ajouté : 20 flux normaux préservés et une annulation volontaire détectée, sur serveur HTTP synthétique loopback. Aucun compte ni provider réel.
- Typecheck global et lint ciblé, dont analyse explicite du helper E2E : code de sortie 0.
- Scripts privés reproductibles : `.artifacts/recovery/aria-native-probe-diagnostic-v4.cjs`.
- Premier script : résolution de module incorrecte. Le chargement suivant par tsx a introduit un helper `__name` non disponible lors de la sérialisation navigateur ; le diagnostic utilise ensuite la transpilation TypeScript ES2022 sans helper externe. Ces essais échoués sont conservés et ne sont pas revendiqués comme tests réussis.

## Limites

Ces 20 répétitions sont un diagnostic du transport et de l'observateur. Elles ne remplacent pas les 20 répétitions du scénario mobile canonique, la matrice E018–E021, les sessions réelles de test ou les campagnes multi-navigateurs. Le prochain résultat CI doit être lié à son SHA exact.

## Fixture du contrat de requête

La première exécution des tests voisins a terminé avec 1 échec et 12 réussites : la page synthétique du test de Request n'exposait pas l'API navigateur de l'observateur. Le commit d'observation a été publié avant traitement de ce résultat ; il n'est pas revendiqué comme qualifié.

Le test de Request isole désormais le module d'observation, déjà exercé dans le diagnostic Chromium. Il conserve le budget de 32 microtâches, les requêtes concurrentes et toutes les assertions de nettoyage. Les assertions sont renforcées pour vérifier le message causal exact des échecs, l'absence d'erreur nominale et la libération de l'observateur. Après correction : 2 suites, 13 tests réussis (0,568 s), sans sleep ni augmentation de timeout. Journaux : `.artifacts/recovery/aria-probe-neighbor-tests.log` et `aria-probe-fixture-green.log`.

## CI colour-independent missing-header contract

On b575187d, the unit lane passed 2169 tests and failed one assertion; coverage failed on the same case (2501 passed). FORCE_COLOR=1 reproduced it locally: ANSI formatting splits the human-readable Jest matcher name. The transport harness now rejects missing headers with ARIA_CHAT_TRANSPORT_NO_HEADERS, and the fixture checks that exact code. No missing response or failed business request is ignored. Six targeted scenarios pass with colours forced; typecheck, ESLint and secret scan pass. Production transport code is unchanged.

## Published evidence allowlist correction

The b575 desktop campaign still fails E025 after HTTP 200 (40 passed, one failed, one did not run). The private publisher retained the aborted phase but discarded the ten new fixed-label probe phases. The allowlist now includes only those exact labels. A regression test fails before this change and all 22 qualification tests pass after it; arbitrary labels and suffix canaries remain excluded, and resealing is idempotent. No body/header/identity/error text is released. The missing probe observations cannot be recovered from the already sealed artifact; the next exact-SHA browser campaign must reproduce them.

## Reader completion attribution (4 October)

The c9381972 mobile campaign fails on RAG transport after HTTP headers without an AbortSignal abort; the dialog remains mounted, composer enabled and error alert present. Desktop and accessibility pass on that SHA. This is not yet a proven root cause.

An isolated loopback diagnostic used the immutable CI artifact for b575187d (temporary merge commit 0f4e9355, tree identical to b575187d). No artifact source was modified. Runtime Prisma engine selection used the embedded OpenSSL 3 engine through the supported environment setting. This is a diagnostic configuration, not a production release. Both a standalone RAG error and a normal turn/history/feedback followed by RAG error produced valid start, matching metadata and RAG_UNAVAILABLE frames, EOF, zero reader cancellations and zero read rejections. These two successes do not qualify the canonical mobile matrix or 20 repetitions. An earlier attempt to run canonical E025 failed in database setup, before any ARIA request; the same reset helper succeeds under tsx, so local harness qualification remains open.

The test-only observer now tracks the selected response reader's EOF and rejection without initiating reads, inspecting bytes or replacing returned read/fetch promises. Failed transports remain failures. Publication permits only four new fixed boolean labels, never arbitrary diagnostics. A publication regression failed before the allowlist update (1 failed, 21 passed), then all 22 passed. Three native-stream observer tests and six transport completion tests pass. Typecheck and targeted ESLint pass.

Chromium onboarding still fails its third logout navigation on c9381972: first two navigation phases take 49 ms and 32 ms, third times out after 45,281 ms. This rules out exhaustion of the whole 60-second test budget as the immediate cause. One isolated parent browser logout succeeds; it is not a substitute for the onboarding scenario.
