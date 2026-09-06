# Architecture RAG — Nexus Réussite

> Date : 6 septembre 2026
> Version : 2.0
> Statut : le service RAG v2 externe fait autorité pour le retrieval produit.

## Décision

Nexus consomme le RAG comme un service externe. Le Cockpit ne possède aucun
moteur vectoriel, ne calcule aucun embedding et ne connaît ni le modèle
d'embedding ni sa dimension. Ces propriétés appartiennent au moteur RAG.

Le chemin produit est `POST /search/v2`. La taxonomie publiée par le moteur est
lisible via `GET /taxonomy/v2`. Les schémas utilisés par Nexus sont importés
depuis le dépôt producteur et verrouillés dans
`data/aria/rag/contracts.lock.json`; Nexus ne redéfinit pas le contrat.

La révision producteur actuellement importée est
`dd0ae3d9490703c0c180b12a7fce11f5c222427d`, package de contrats `0.17.0`.

## Chemin produit

Le Cockpit Maths Première EDS suit cette chaîne :

```text
session ELEVE
  → rate limit par IP puis par identité
  → cursus et droits chargés côté serveur
  → capability et manifeste du cours
  → identité académique pseudonymisée et signée
  → POST /search/v2 avec les trois credentials
  → validation du schéma et des empreintes du manifeste
  → projection Cockpit avec citation, source et page
```

Les points d'entrée sont :

- `app/api/programme/maths-1ere/rag/route.ts` pour le Cockpit EDS ;
- `lib/programme/rag-v2-route.ts` pour l'enveloppe HTTP et le contrôle du rôle ;
- `lib/programme/rag-v2.ts` pour l'adaptation du résultat ;
- `lib/aria/rag.ts` pour la requête liée au manifeste et à l'identité ;
- `lib/aria/infrastructure/rag/rag-engine-client.ts` pour le transport v2.

Le cours STMG Première ne déclare pas encore de corpus promu. Sa route renvoie
un état indisponible sans requête réseau et sans fabriquer de nom de collection.
Les vues non élève n'exposent plus l'action de remédiation tant qu'elles ne
portent pas un élève cible autorisé permettant de construire une identité
académique signée. La route reste réservée au rôle `ELEVE`.

Les générateurs de bilans et le rapport EAF gardent leur contexte déterministe
et n'appellent pas le RAG. Leur ancien retrieval ne portait ni manifeste ni
identité académique signée. Il pourra être réintroduit uniquement après ajout
d'une capability v2 explicite et d'un modèle d'autorisation adapté à ces usages.
Les options historiques demandant explicitement du RAG sont refusées au lieu
d'être ignorées silencieusement.

## Authentification cumulative

`POST /search/v2` et `GET /taxonomy/v2` exigent simultanément :

- `Authorization: Bearer <BFF service credential>` ;
- `X-RAG-API-Key: <scoped client key>` avec le scope exact `rag:search` ;
- `X-Nexus-Identity: <signed identity>`.

L'identité signée est générée côté serveur. Elle lie le sujet pseudonyme, le
périmètre académique, la collection autorisée, le manifeste, l'empreinte de la
requête et une expiration courte. Aucun de ces credentials n'est envoyé au
navigateur.

Le client refuse la configuration incomplète avant tout appel réseau. Il
n'utilise aucun credential de repli, ne transforme pas une clé `rag:search` en
clé admin et ne réutilise pas le Bearer comme clé API.

Le contrôle de compatibilité avant déploiement appelle
`GET /corpora/servable/v1`. Il utilise le même Bearer BFF et une clé opératoire
distincte `RAG_MANIFEST_API_KEY`, limitée au scope `rag:read-source`. Cette clé
n'est pas injectée dans le runtime applicatif du Cockpit.

## Configuration

Les valeurs restent hors Git. Le runtime applicatif utilise :

- `RAG_API_BASE_URL` ;
- `RAG_BFF_SERVICE_TOKEN` ;
- `RAG_ENGINE_API_KEY`, limitée à `rag:search` ;
- `ARIA_RAG_ENGINE_TIMEOUT_MS` ;
- `NEXUS_INTERNAL_TOKEN_SECRET` ;
- `NEXUS_INTERNAL_TOKEN_ISSUER` ;
- `NEXUS_INTERNAL_TOKEN_AUDIENCE` ;
- `NEXUS_SSO_ISSUER` ;
- `NEXUS_SSO_AUDIENCE`.

Le runbook privé de déploiement fournit en plus `RAG_MANIFEST_API_KEY`, limitée
à `rag:read-source`, pour la vérification du manifeste. Aucun secret n'est
commité dans les fichiers d'exemple.

## Invariants de réponse

Nexus accepte un résultat seulement si :

- la réponse satisfait le schéma RAG v2 importé ;
- le corpus, sa version et le manifeste correspondent au plan promu ;
- la ressource, sa version, son contenu, le chunk et le locator existent dans
  les bindings du manifeste ;
- chaque résultat contient une citation exploitable, une source et une page.

Après validation du protocole, le Cockpit applique un seuil d'affichage produit
de `0,50`. Les hits plus faibles ne sont pas présentés comme sources vérifiées ;
si aucun hit n'atteint ce seuil, le résultat devient `NO_RESULTS`.

Le schéma producteur permet actuellement certains résultats sans page. Nexus
applique une règle produit plus stricte et refuse alors la réponse entière avec
`RAG_PROTOCOL_INVALID`. Si le staging produit ce cas, il doit être remonté à
l'équipe RAG avec la requête anonymisée et le statut observé ; le Cockpit ne
corrige pas le moteur ni son contrat.

## Taxonomie

`readAriaRagTaxonomyV2()` lit `GET /taxonomy/v2` avec les trois credentials et
valide la réponse avec
`data/aria/generated/rag-contracts/v1/taxonomy-v2-response.json`. La taxonomie
peut éclairer les capacités et libellés ; elle ne remplace jamais le manifeste
promu qui autorise un corpus précis pour un cours et un élève.
Nexus exige en plus les champs racine `version: 2`, `collections` et
`dimensions`, car le schéma producteur les laisse actuellement facultatifs.

## Dégradation et observabilité

Une configuration absente, un scope insuffisant, une identité impossible à
représenter, un timeout ou une réponse invalide échoue fermé. Le Cockpit affiche
un état sans source et ne bascule vers aucun ancien moteur.

Le healthcheck interne vérifie que la configuration v2 de production est
complète. Il ne forge pas une recherche de contrôle : `/search/v2` et
`/taxonomy/v2` exigent une vraie identité académique, tandis que le `/health` du
runtime RAG est volontairement limité au loopback par son proxy. La joignabilité
et la compatibilité distantes sont donc contrôlées par le gate de manifeste puis
par la recette métier signée avant la bascule de release.

## Héritage

L'ancien client `lib/rag-client.ts` et ses appels `POST /search` ont été retirés
du code actif. ChromaDB, pgvector et les anciennes dimensions d'embedding peuvent
rester mentionnés dans des audits ou ADR historiques. Ces documents décrivent
un état passé et ne font pas autorité pour le chemin produit actuel.

Le champ Prisma historique `embedding_vector` reste une donnée de compatibilité.
Il n'est pas lu par ce chemin et sa suppression éventuelle relève d'une migration
de données séparée.

## Vérifications

Les tests discriminants couvrent :

- l'absence du chemin produit `/search` ;
- le succès de `/search/v2` avec les trois credentials ;
- le refus sans clé API, sans Bearer BFF ou sans identité ;
- le refus d'un scope insuffisant sans retry ni élévation ;
- la lecture et la validation de `/taxonomy/v2` ;
- la présence de citation, source et page ;
- le seuil produit de pertinence et l'état `NO_RESULTS` ;
- la correspondance des résultats avec le manifeste promu ;
- l'indisponibilité propre d'un cours sans corpus ;
- le rate limit par IP et identité ainsi que les réponses privées ;
- le refus de déclarer prêt un runtime disposable ou incomplet ;
- la séparation entre `rag:search` et `rag:read-source`.

La recette externe ne peut porter le statut
`COCKPIT_TO_RAG_STAGING=PASS` qu'après un appel réel au staging RAG avec des
credentials dédiés. Les tests sur le fournisseur jetable prouvent le contrat du
client, pas la disponibilité du staging externe.

## Références

- `data/aria/rag/contracts.lock.json`
- `data/aria/generated/rag-contracts/v1/retrieval-request.json`
- `data/aria/generated/rag-contracts/v1/retrieval-response.json`
- `data/aria/generated/rag-contracts/v1/taxonomy-v2-response.json`
- `docs/architecture/ARIA_V1.md`
- `docs/roadmaps/RAG_PLATFORM_ROADMAP.md`
- `DEPLOY_RUNBOOK.md`
