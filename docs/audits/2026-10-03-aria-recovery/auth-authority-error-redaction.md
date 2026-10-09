# Erreurs contrôlées de l'autorité d'authentification

## Critères et défaut

Une indisponibilité Core doit refuser l'authentification, la résolution,
la révocation et la validation des sessions. Elle ne doit jamais propager le
message brut du pilote : ce diagnostic peut contenir des credentials de
connexion. Une configuration invalide doit être refusée sans afficher sa valeur.

Six tests RED reproduisent la propagation d'un marqueur privé synthétique
dans ces cinq chemins et dans l'erreur de mode rollout.

## Correction et vérification

L'erreur CoreV2AuthorityUnavailableError conserve son type, un message constant
et le code CORE_V2_AUTHORITY_UNAVAILABLE. Aucun message ni cause brute du pilote
n'est recopié. Le mode reste strictement validé contre son enum, mais sa valeur
invalide n'est plus interpolée. Aucun fallback d'authentification n'est ajouté.

Les six nouveaux tests et les parcours voisins passent : cinq suites, 40 tests.
Les assertions sont booléennes pour ne pas exposer le diagnostic synthétique
lors d'un échec. Aucune donnée, migration ou configuration de production changée.

## Limite

Ce lot couvre la construction de l'erreur d'acquisition du client Core et le
mode rollout. Il ne constitue pas une preuve globale de redaction de tous les
logs ou des erreurs provenant de chaque requête métier ; cet audit reste requis.
