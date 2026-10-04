# Gate de répétition mobile E019

Date : 4 octobre 2026. Base : 0d499dc99. Statut : NOT_READY.

## Exécution attendue

L'entrypoint de la lane aria-mobile exécute toujours E018–E021 au complet. Seulement après son succès, il exécute le même E019 canonique vingt fois, avec un worker, aucun retry et les timeouts existants, sur la même stack éphémère et le même artefact applicatif. Le second process utilise aria-mobile-repeat20 uniquement comme racine de rapport ; le projet Playwright exécuté reste aria-mobile, avec son scénario 768 × 1024 et ses huit états.

Le wrapper collecte les rapports dans des chemins distincts, les expurge, puis exige vingt identités d'exécution distinctes avec le titre canonique, le bon projet, un unique résultat passed, retry zéro, aucun skip/fixme/fail, erreur globale ou flakiness. La CI republie et qualifie ce rapport séparé sous l'artefact mobile ; une absence ou un échec bloque la lane et CI Success. Les quatre tests de la campagne visuelle complète ne sont ni remplacés ni affaiblis.

## Tests exécutés

- Neuf tests rouges ont précédé le validateur ; la première implémentation a correctement rejeté la signature sans préfixe E019, puis ce contrat de titre expurgé a été corrigé.
- Governance complète : 25 suites, 269 tests réussis.
- Deux suites de contrat/bootstrap : 33 tests réussis.
- Entrypoint exécuté avec des outils synthétiques isolés : trois tests réussis (ordre full puis repeat20, refus de poursuivre après échec initial, desktop inchangé).
- Parsing YAML, bash -n, node --check, lint ciblé et diff-check réussis.

La campagne réelle E019 ×20 n'est pas encore exécutée : elle doit produire sa preuve distante sur le prochain SHA. Les seuls tests de cette section valident la gate, pas la stabilité applicative.

## Complément de preuve SSE

Sur le parser du SHA de base, le micro-banc WebKit 26.0 exécute également 100/100 flux progressifs complets, 100 requestfinished et zéro requestfailed. Chromium 145.0.7632.6 avait le même résultat. Firefox local n'a pas démarré à cause d'un chemin lock absent dans le cache existant ; aucun verrou ou cache utilisateur n'a été supprimé. Ces micro-bancs synthétiques ne remplacent ni les parcours authentifiés ni la matrice des 31 capacités.

Aucun changement de données, de permission produit, de lockfile, de prix, de schéma ou de production. Rollback de l'infrastructure de test par retrait de cette exécution supplémentaire ; il ne constitue pas une permission d'ignorer la qualification mobile requise.

## Correction de collecte avant publication

Une collecte réelle --list a révélé que --project aria-mobile suivi du fichier est interprété comme une liste de projets : visual-a11y.spec.ts était rejeté comme projet inexistant. Le filtre ^E019 aurait également exclu le titre complet composé par Playwright. La commande utilise maintenant --project=aria-mobile et un motif canonique non ancré. Le CLI réel collecte exactement vingt tests dans un fichier, sans exécuter de navigateur ou requête DB. Un quatrième test d'entrypoint lance ce collecteur, en retirant les URLs de base de son environnement ; quatre tests réussissent. Le commit précédent est conservé, pas réécrit.
