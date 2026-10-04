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
