# Annulations navigateur : classification étroite

## Défaut reproduit

captureBrowserFailures omettait tout net::ERR_ABORTED, y compris une API métier. Le scénario visuel acceptait ensuite des chemins GET sans preuve de type ou de phase. Sept tests ont reproduit la perte d’erreur sur 40c4bae6a : API, document, fetch dashboard ordinaire, RSC sans prefetch, prefetch sans RSC et API munie de headers prefetch. Aucun sleep, retry ou projet désactivé.

## Contrat corrigé

Toutes les requêtes annulées sont classées. Seul un GET same-origin, type fetch, vers une route explicitement répertoriée, muni de RSC=1 ET d’un marqueur prefetch est reconnu comme préchargement Next. Le POST exact de chat peut être reconnu uniquement si le test a marqué cette même requête déjà active avant le clic Arrêter. Zéro ou plusieurs chats actifs empêchent cette déclaration. La fin ou l’échec retire l’intention ; aucune requête suivante n’en hérite. Les API tierces, documents, erreurs réseau différentes, HTTP500, console.error et pageerror restent des échecs.

Le scénario visuel marque la requête de chat avant annulation, vérifie l’état UI arrêté puis attend zéro stream fournisseur actif par polling. Son assertion finale vérifie les erreurs simples et les diagnostics structurés, au lieu d’une liste de chemins qui pouvait couvrir une requête métier. Les valeurs de query et les headers ne sont pas conservés ; seuls pathname/type/méthode, marqueurs booléens et disposition le sont.

## Tests

Avant correction : 7 échecs attendus. Après correction : 2 suites et 35 tests réussis, dont 18 tests de diagnostic couvrant prefetch, origine étrangère, requête A versus B, panne HTTP500 pendant annulation, fin de requête et annulation ambiguë. Typecheck et ESLint ciblé réussis. Logs privés .artifacts/recovery/browser-diagnostics-*.log.

Les 20 répétitions mobiles et les nouvelles lanes navigateur réelles n’ont pas encore été exécutées sur ce code : aucune qualification E2E revendiquée par ces tests unitaires. Le build local reste contraint par le plancher de disque ; la CI officielle fournit le builder séparé.

## Rollback

Aucune donnée ni schéma modifiés. Le retour applicatif ne nécessite pas de migration inverse. Ne jamais revenir à l’omission globale des annulations pour obtenir du vert.
