# Convergence du Cockpit vers le RAG v2 externe

## Date

6 septembre 2026

## Contexte

Le Cockpit consommait un ancien client `POST /search` qui présentait ChromaDB,
un modèle d'embedding et une dimension comme vérités applicatives. Le service
RAG livré publie désormais `POST /search/v2`, `GET /taxonomy/v2`, des manifestes
de corpus et une authentification cumulative.

Le dépôt RAG a été consulté en lecture seule sur
`dd0ae3d9490703c0c180b12a7fce11f5c222427d`. Aucun fichier ni aucune PR de ce
dépôt n'a été modifié.

## Problèmes observés

- les routes Cockpit Maths appelaient `/search` avec un seul Bearer facultatif ;
- tout utilisateur authentifié pouvait appeler ces routes ;
- les interfaces affichaient des noms de moteurs de stockage ;
- les générateurs de bilans et le rapport EAF appelaient le même client sans
  manifeste ni identité académique signée ;
- la taxonomie v2 n'était pas importée ;
- le runtime de production ne déclarait pas le contrat de credentials v2 ;
- la documentation présentait ChromaDB et des dimensions d'embedding comme
  source de vérité produit.

## Décisions prises

- Le service externe et ses contrats importés font autorité.
- Le Cockpit EDS réutilise le contexte, les droits, le manifeste et le signataire
  de la chaîne ARIA ; seul un rôle `ELEVE` autorisé atteint le retrieval.
- Le client envoie simultanément le Bearer BFF, la clé `rag:search` et l'identité
  signée. Une configuration manquante ou un credential réutilisé échoue avant
  le réseau.
- Chaque résultat doit conserver citation, source et page et correspondre aux
  bindings du manifeste promu.
- Les hits dont le score est inférieur à `0,50` ne sont pas présentés comme
  sources vérifiées ; une liste entièrement sous le seuil devient `NO_RESULTS`.
- La route Cockpit est limitée par IP et par identité. L'action est masquée pour
  tous les rôles non élève tant qu'aucun élève cible autorisé ne peut être signé.
- STMG répond indisponible sans requête réseau tant qu'aucun corpus n'est promu.
- Les bilans et le rapport EAF restent fonctionnels sans retrieval externe. Leur
  ancien appel non gouverné est supprimé ; une réactivation exigera une
  capability v2 dédiée.
- La clé applicative `RAG_ENGINE_API_KEY` porte uniquement `rag:search`. La clé
  opératoire `RAG_MANIFEST_API_KEY` porte uniquement `rag:read-source` et reste
  hors du runtime Cockpit.
- Le healthcheck applicatif vérifie la configuration de production. Il ne forge
  pas d'identité et n'appelle pas le `/health` RAG, que les vhosts producteurs
  limitent explicitement au loopback.

## Fichiers modifiés

- client, identité, manifeste et adaptateur sous `lib/aria/**` et
  `lib/programme/**` ;
- routes `app/api/programme/maths-1ere*/rag/route.ts` ;
- composants Cockpit RAG ;
- import et lock de contrats sous `scripts/aria/**` et `data/aria/**` ;
- fixture E2E, compose et contrats d'environnement ;
- générateurs de bilans et rapport EAF ;
- documentation RAG et déploiement ;
- tests unitaires, API, architecture et scripts associés.

Le fichier `lib/rag-client.ts` et ses tests historiques sont supprimés.

## Tests exécutés

- cycles Red → Green ciblés pour l'import de taxonomie, le client v2, les trois
  credentials, les refus d'authentification, les citations, la fixture, le
  manifeste, les routes Cockpit et la commande staging ;
- revue indépendante : approuvée après correction de la conservation de
  `citation.page` et de `locator.page_start` dans l'adaptateur Cockpit ;
- `npm test -- --runInBand` : 1 069 suites, 12 175 tests et 7 snapshots réussis ;
- `npm run typecheck` et `npm run typecheck:aria-scripts` : réussis ;
- `npm run lint` : réussi avec uniquement les avertissements préexistants du
  domaine candidat individuel ;
- import exact des contrats depuis le commit RAG producteur : réussi ;
- scanners de sécurité, registre de ressources et contrôle de source de
  l'artefact ARIA : réussis ;
- qualification ARIA : 64 exigences critiques, 733 liens de preuve, 295 cas
  réussis et 32 preuves visuelles ;
- couverture ARIA : 97,51 % lignes, 97,85 % fonctions, 95,03 % branches,
  96,67 % instructions et 100 % sur les sources critiques ;
- Playwright Docker jetable : 21 scénarios bureau, 4 scénarios mobile,
  1 scénario accessibilité et 10 scénarios smoke artefact réussis ;
- build Next.js standalone depuis une copie du commit hors `.worktrees` :
  réussi. Le premier lancement dans `.worktrees` avait été rejeté uniquement
  par la règle de traçage interdisant cette chaîne dans les chemins absolus.

## Résultats

- `COCKPIT_RAG_V2_CLIENT=PASS` ;
- `COCKPIT_TO_RAG_STAGING=BLOCKED`.

La qualification navigateur a détecté puis permis de corriger deux écarts de
fixture : une réponse sans page exploitable, puis une page de citation absente
du schéma SSE fermé. Les tests de régression couvrent désormais la page portée
par `citation.page`, sa projection canonique et sa sérialisation jusqu'au
client. Le commit applicatif qualifié est
`14c72118bef2e8a96a22f2570c9fd532b623b061` et la livraison est suivie par la
PR Nexus #214.

La revue automatique de la PR a ensuite conduit à fermer les écarts restants :
contrat bilan qui acceptait des options RAG ignorées, attribution source/page
incomplète dans l'interface, taxonomie racine trop permissive, credentials avec
espaces périphériques, absence de limite de requêtes et résultats de faible
pertinence encore affichés.

### Reproductions transmises au propriétaire RAG

Ces trois écarts sont suivis dans
[`cyranoaladin/RAG#154`](https://github.com/cyranoaladin/RAG/issues/154), avec
les commandes de reproduction et leur impact consommateur :

1. Au commit producteur verrouillé, `services/rag-engine/infra/nginx/rag-v2.conf`
   autorise `/health` uniquement depuis `127.0.0.1` et `::1`. Un client externe
   ne peut donc pas utiliser cette route comme sonde de disponibilité. Attendu :
   publier dans l'OpenAPI un endpoint de readiness interservice authentifié ou
   confirmer que le gate de manifeste est la seule sonde distante autorisée.
2. Le schéma `taxonomy-v2-response.json` accepte un objet sans `version`,
   `collections` ni `dimensions`. Attendu : rendre ces trois champs obligatoires
   dans le contrat producteur. Nexus les exige déjà à sa frontière.
3. Le schéma de résultat permet une citation sans page. Attendu : garantir une
   page positive pour les corpus paginés ou formaliser les corpus qui ne peuvent
   pas la fournir. Nexus refuse actuellement toute réponse sans page afin de ne
   pas afficher une source invérifiable.

L'audit indépendant du dépôt RAG établit qu'aucune URL HTTPS de staging externe
officielle ni aucune remise de credentials n'est disponible. Le statut RAG
versionné reste `GO_LIVE_READY=false`, `RAG_PRODUCTION_DEPLOYED=false` et
`GO_LIVE: NO_GO`. Le fichier `.env` Nexus ne contient aucune des variables v2.

La commande `npm run aria:rag-v2:staging-check` est prête. Elle exige
`RAG_STAGING_RUN=1`, la configuration v2, le signataire compatible et un corpus
promu. Elle n'émet `COCKPIT_TO_RAG_STAGING=PASS` qu'après lecture réelle de la
taxonomie et obtention d'au moins un résultat cité.

## Risques restants

- absence de staging RAG externe et de credentials dédiés ;
- le schéma producteur autorise encore un résultat sans page, alors que Nexus le
  refuse pour garantir une citation exploitable ;
- aucune source STMG n'est disponible tant que le moteur ne promeut pas de
  corpus compatible ;
- les champs RAG historiques des modèles de bilan restent stockés pour
  compatibilité ; toute demande explicite au générateur est refusée.

## Rollback

Revenir au commit précédent restaure les fichiers applicatifs. Il ne faut pas
réactiver `POST /search` ni un moteur local. En cas d'incident après livraison,
désactiver la configuration v2 provoque une dégradation fermée et conserve les
bilans déterministes ; corriger ensuite le client v2 ou le contrat avec l'équipe
RAG.
