# Architecture RAG

## Chemin réel constaté

Le client actif des bilans appelle `RAG_INGESTOR_URL` via HTTP et reçoit des résultats de type Chroma (`id`, `document`, `metadata`, `distance`). La production observée possède des conteneurs ChromaDB, Ollama et ingestor. Les affirmations README « migré vers pgvector » et le prototype NSI pgvector ne prouvent donc pas le backend de production des bilans. À cette date, **Chroma/FastAPI est le seul backend RAG Bilans confirmé en production** ; son commit, son corpus et sa configuration restent inconnus.

## Divergences

- documentation et prototype : pgvector ; runtime observé/client : Chroma/FastAPI ;
- collections production documentées par niveau/matière, tandis que le générateur Bilan demande par défaut des noms de notions ;
- corpus historique décrit 768 dimensions `nomic-embed-text`, `.env.example` et Compose contiennent 3072/OpenAI ; dimension active non prouvée ;
- le client ne filtre que subject/level/track et perd provenance/version au moment de construire le contexte ;
- toute panne est transformée en liste vide ;
- le document récupéré est injecté tel quel dans le prompt sans frontière anti-instruction.

## Contrat cible

Requête : texte normalisé, `subject`, `level`, `track`, année scolaire, curriculum/version, notion, compétence, langue, collection logique, `topK`, seuil, budget tokens et correlationId. Réponse typée : `OK_WITH_HITS`, `OK_EMPTY`, `TIMEOUT`, `BACKEND_ERROR`, `SCHEMA_ERROR`, avec latence et version backend.

Chaque hit conserve `sourceId`, `chunkId`, titre, section, page, URI interne, version, checksum source/corpus, score brut et score normalisé. Le rapport persiste les citations réellement utilisées, pas seulement les résultats récupérés.

## Pipeline corpus

Manifest explicite et validé : source officielle/licence, matière, niveau, voie, année/version curriculum, checksum, parseur/version, stratégie de chunking, embedding model/dimension, dates et statut de revue. Aucun scan de dossier implicite, aucun vecteur zéro en fallback, aucune troncature/padding silencieux. Une nouvelle version crée un corpus immutable puis est promue atomiquement.

## Sécurité

Les documents sont des données non fiables, jamais des instructions. Le prompt les délimite, neutralise les directives et interdit d'exfiltrer contexte/secrets. Taille, MIME, OCR, virus, droits et provenance sont contrôlés à l'ingestion. Les verbatims élève ne deviennent pas des requêtes brutes sans minimisation. Logs sans contenu ni PII.

## Qualité et exploitation

Mesurer rappel sur jeu de questions validé, précision/citations, résultats vides, erreurs, latence, déduplication et dérive par corpus. Timeout et circuit breaker sont distincts d'un vide légitime. Limiter contexte par tokens, diversité de sources et maximum de chunks par document. Les citations manquantes font échouer la validation d'une recommandation RAG, mais n'empêchent pas le rapport déterministe.

## Décision requise

Ne pas ajouter de backend. Documenter d'abord le compose/commit/collections/dimensions réellement déployés, puis ADR : maintenir Chroma ou migrer vers pgvector. Une migration éventuelle exige double index, benchmark de parité, cutover réversible et checksums ; le prototype NSI n'est pas importé tel quel.
