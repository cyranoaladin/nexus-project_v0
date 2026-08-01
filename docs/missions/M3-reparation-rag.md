# M3 — Réparation du RAG Terminale

## Statut

Mission préparée le 2026-08-01. Aucune action d’ingestion, de configuration ou de
production n’a été exécutée dans ce cadre.

## Objectif

Constituer et éprouver un corpus Terminale exploitable avant toute réactivation du RAG
dans ARIA ou dans un pack de bilan.

## Configuration observée

### Application Nexus sous PM2

- L’application lit `RAG_INGESTOR_URL` et `RAG_API_TOKEN` dans `lib/rag-client.ts`.
- `/etc/nexus/nexus-prod.env` ne contient actuellement aucune clé `RAG_*` ou `CHROMA_*`.
- Sans URL explicite, le code de production utilise `http://ingestor:8001`.
- Depuis l’hôte qui exécute PM2, `getent hosts ingestor` échoue et un appel au healthcheck
  retourne le code curl `000`. Ce nom Docker n’est donc pas résolvable depuis PM2.

### Services d’ingestion

- `compose-ingestor-1` déclare `INGESTOR_API_TOKEN` ainsi que sa configuration Chroma.
- `rag_ingestor` déclare notamment `INGESTOR_API_TOKEN`, `INGEST_AUTH_TOKEN` et des tokens
  par rôle.
- Aucune valeur n’a été lue ou affichée.
- Il n’existe pas de token côté application à comparer aux tokens des ingestors. La
  correspondance ne peut donc pas être vraie dans l’état actuel : le client Nexus n’envoie
  aucun bearer token configuré.

## Cause réseau et statuts historiques

L’absence de résolution de `ingestor` explique une panne réseau du client ARIA exécuté
sur l’hôte. Elle ne peut pas expliquer les `401` ou `422` historiques : obtenir un statut
HTTP prouve qu’un autre client a atteint un ingestor.

- `401` : authentification absente ou refusée sur une route d’ingestion.
- `422` : corps de requête accepté par HTTP mais refusé par la validation FastAPI.
- `rag_ingestor` conserve 18 lignes d’accès en `422`, mais aucune ligne de détail de
  validation. Il est impossible de retrouver après coup le champ précis rejeté.

L’OpenAPI de `compose-ingestor-1` impose actuellement :

| Route | Format | Champs obligatoires |
| --- | --- | --- |
| `/ingest` | JSON | `source_type`, `source` |
| `/ingest/urls` | JSON | `urls` |
| `/ingest/drive` | JSON | `folder_id` |
| `/ingest/upload-files` | multipart | `files` |

Ces contrats permettent de préparer une reproduction, mais pas d’attribuer honnêtement
les anciens `422` à l’un de ces champs. La future reproduction devra conserver une réponse
de validation expurgée, limitée à la route, au champ et au code d’erreur, sans contenu
pédagogique ni token.

## Plan de réparation

1. Définir une URL d’ingestor joignable depuis le processus PM2 ; ne pas utiliser un nom
   de service Docker hors de son réseau.
2. Créer ou sélectionner un credential d’appel dédié à Nexus, puis vérifier côté serveur
   que le même credential est attendu. Ne jamais afficher sa valeur dans les journaux.
3. Vérifier `/health`, puis effectuer une recherche contrôlée avant toute ingestion.
4. Reproduire chaque type d’ingestion dans un environnement isolé avec les schémas OpenAPI
   ci-dessus et conserver les erreurs de validation expurgées.
5. Créer une collection de recette distincte, jamais la collection active.
6. Ingérer un échantillon Terminale validé pédagogiquement.
7. Vérifier le nombre d’éléments et les métadonnées obligatoires : matière, niveau,
   source, domaine et version du corpus.
8. Tester des recherches positives, sans résultat, hors sujet et des indisponibilités
   techniques.
9. Comparer les résultats à une grille de pertinence humaine avant promotion.
10. Promouvoir explicitement le corpus validé vers la collection de production, avec un
    rollback documenté.

## Conditions avant `rag.enabled: true`

- l’URL est résolue et joignable depuis le runtime réel de l’application ;
- l’authentification aboutit sans secret dans les logs ;
- la collection cible existe et contient des éléments Terminale validés ;
- toutes les entrées portent les métadonnées matière et niveau attendues ;
- une recherche témoin retourne des sources pertinentes et traçables ;
- une collection vide ou une panne technique échoue de façon visible ;
- la surveillance du taux d’échec et l’alerte Telegram sont opérationnelles ;
- la validation pédagogique du pack et du corpus est nominative et datée ;
- un plan de rollback permet de désactiver le RAG sans publier une réponse faussement
  présentée comme ancrée.

Tant qu’une condition manque, `rag.enabled` reste à `false`.
