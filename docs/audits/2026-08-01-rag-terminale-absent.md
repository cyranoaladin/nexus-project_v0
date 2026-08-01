# Audit lecture seule — corpus RAG Terminale absent

## Date et périmètre

Audit effectué le 2026-08-01 sur le serveur de production, sans ingestion, écriture,
redémarrage, modification de conteneur ni lecture de secret. Le code applicatif cité est
le SHA déployé `11e0dce`.

## Verdict

Le corpus RAG Terminale requis par les bilans n'est présent dans aucun backend cible
observé. La collection Chroma `ressources_pedagogiques_terminale` contient zéro entrée et
la nouvelle table `rag_pgvector.rag_chunks` contient zéro ligne.

ARIA échoue silencieusement lorsque le retrieval échoue ou ne retourne rien : elle appelle
quand même le modèle sans contexte pédagogique et ne signale pas l'absence de source à
l'élève. C'est un P0 hors chantier Bilans.

## Stockages observés

| Stockage | Contenu observé | Interprétation |
|---|---:|---|
| PostgreSQL Nexus `pedagogical_contents` | 40 lignes, 40 vecteurs, 20 titres distincts | stockage legacy de courts segments, deux par titre |
| `pedagogical_contents` Maths | 20 | métadonnée de niveau absente |
| `pedagogical_contents` NSI | 10 | métadonnée de niveau absente |
| `pedagogical_contents` Philosophie | 10 | métadonnée de niveau absente |
| Chroma `nsi_corpus_v2` | 5 992 | corpus NSI, niveau exact non prouvé par le nom seul |
| Chroma `nsi_corpus` | 4 716 | corpus NSI legacy, niveau exact non prouvé |
| Chroma `rag_education` | 7 181 | corpus éducatif générique, couverture matière/niveau non qualifiée |
| Chroma `rag_francais_premiere` | 5 948 | Français Première |
| Chroma `rag_math_correction` | 67 | correction mathématique, niveau non qualifié |
| Chroma `rag_maths_premiere` | 0 | Maths Première absent |
| Chroma `ressources_pedagogiques_terminale` | 0 | corpus Terminale attendu absent |
| Chroma `rag_divers` | 0 | vide |
| nouvelle pile PostgreSQL `rag_chunks` | 0 | aucune ingestion dans le nouveau backend |

Les 40 lignes PostgreSQL ne sont donc pas comparables aux 211 chunks annoncés comme s'il
s'agissait du même corpus. Les backends sont disjoints et aucun stockage actif observé ne
porte le compte 211.

## État des services

- `compose-ingestor-1`, démarré le 2026-06-30, répond 200 sur `/health` et expose l'API d'ingestion historique.
- `rag_ingestor`, démarré le 2026-07-14, répond 200 sur `/health`, mais 500 sur `/admin/health`.
- La nouvelle pile PostgreSQL RAG est joignable mais vide.
- L'environnement réel du processus PM2 ne contient ni `RAG_INGESTOR_URL` ni clé `RAG_*`.
- Sur le SHA déployé, l'absence d'URL force en production `http://ingestor:8001`, nom de service Docker non prouvé joignable depuis le processus PM2 hôte (`lib/rag-client.ts:67`).

## Nature des erreurs 401 et 422

La première réponse 401 observée sur la pile historique date du 2026-07-02 sur
`POST /ingest/urls`. La nouvelle pile montre un 401 le 2026-07-14 sur
`POST /ingest/v2/urls`.

Le code des deux ingestors exige un token sur ces routes : 401 signifie que
l'authentification d'ingestion était absente ou refusée. Les logs ne permettent pas de
distinguer un token manquant d'un token invalide.

Les réponses 422 des 14 et 15 juillet signifient que FastAPI a rejeté la charge utile au
regard du modèle de requête : champs, fichiers ou paramètres requis absents ou invalides.
Elles ne prouvent pas un échec d'authentification.

Ces requêtes ciblent des endpoints d'ingestion. ARIA appelle uniquement `/search` : rien
ne prouve que les 401/422 aient été produits par l'application Nexus. Aucun succès
d'ingestion Terminale n'apparaît dans les logs conservés.

Il est impossible d'établir une rotation récente de `RAG_API_TOKEN` à partir de l'état
présent : Docker conserve la configuration actuelle, pas son historique. Le processus PM2
n'expose actuellement aucune clé `RAG_*`; les ingestors déclarent des clés nommées
`INGESTOR_API_TOKEN` et, pour la nouvelle pile, plusieurs tokens par rôle. Aucune valeur
n'a été lue ni comparée.

## Défaillance silencieuse d'ARIA

Sur `11e0dce`, `ragSearch` transforme une réponse non-2xx, un timeout ou une exception en
tableau vide (`lib/rag-client.ts:82`, `lib/rag-client.ts:120`, `lib/rag-client.ts:129`).
`buildRAGContext([])` retourne ensuite une chaîne vide (`lib/rag-client.ts:240`).

Le chemin non streaming concatène cette chaîne vide au prompt puis appelle le modèle sans
contrôle du nombre de sources (`lib/aria.ts:35`, `lib/aria.ts:40`, `lib/aria.ts:55`). Le
chemin streaming fait de même (`lib/aria-streaming.ts:24`, `lib/aria-streaming.ts:30`,
`lib/aria-streaming.ts:48`). La route publique relaie directement ce flux
(`app/api/aria/chat/route.ts:155`).

**Conclusion P0 :** ARIA peut répondre sans aucune source et sans avertir l'élève. Le
comportement est observable dans les deux modes de réponse.

## Plan de réingestion proposé — non exécuté

1. Choisir un backend canonique et une collection Terminale versionnée ; interdire toute ingestion simultanée dans les piles concurrentes.
2. Établir un manifeste des sources : origine, droits, matière, niveau, programme, checksum, parseur et stratégie de chunking.
3. Faire valider humainement les sources et métadonnées avant indexation.
4. Sauvegarder ou exporter l'état Chroma existant et définir le rollback de collection.
5. Réconcilier les noms de variables et les rôles d'authentification sans exposer les tokens ; effectuer toute rotation côté Nexus.
6. Valider hors production les payloads contre le schéma OpenAPI de l'ingestor retenu.
7. Ingérer dans une nouvelle collection isolée et immutable, jamais directement dans l'alias actif.
8. Vérifier les comptes, doublons, dimensions, métadonnées, filtres Terminale et recherches sur un jeu de référence.
9. Faire effectuer une recette pédagogique et une revue de provenance avant promotion.
10. Promouvoir atomiquement la collection, configurer explicitement l'endpoint côté PM2, puis vérifier que zéro résultat devient une erreur visible.
11. Surveiller taux de résultats vides, erreurs d'authentification, dérives de corpus et qualité des sources.

Aucune de ces actions n'a été exécutée pendant cet audit.
