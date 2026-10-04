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
