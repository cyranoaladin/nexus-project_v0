# LLM, générateurs et agents

## Fournisseurs constatés

| Usage | Fournisseur/modèle par défaut | Sortie / validation | Risques |
|---|---|---|---|
| Assessment | Ollama `llama3.2:latest` | trois Markdown libres | 3 appels, pas RAG, timeout/process-local, PII |
| Bilan générique | Ollama/OpenAI-compatible, `qwen2.5:32b` documenté | Markdown | collections client, citations perdues, PII |
| Diagnostic legacy | Ollama + RAG | Markdown + fallback déterministe | schéma faible, provenance incomplète |
| Rapports stage | Mistral | JSON Zod puis LaTeX | contexte « latest », pas Evidence IDs/citations, pas retry |
| NPC | Chutes.ai, Ollama/stub possibles | JSON Zod | OCR/verbatims/PII, points attribués par LLM |
| ARIA/embeddings | OpenAI-compatible/OpenAI selon config | conversation/embeddings | chaîne distincte, configurations divergentes |

Le prototype NSI ajoute Gemini et OpenAI, mais ceux-ci ne constituent pas un fournisseur actif prouvé de la chaîne primaire. Coûts, versions exactes, rétention fournisseur, régions de traitement et modèles réellement déployés sont `UNKNOWN_PRODUCTION_FACT`.

## Contrat cible LLM

Le contexte contient un identifiant pseudonyme, le `ScoreSnapshot`, des Evidence IDs, des faits autorisés, des chunks RAG citables et une matrice d'audience. Il exclut nom, email, téléphone, établissement et verbatims non nécessaires. Les verbatims nécessaires sont délimités comme données non fiables.

La réponse est un JSON strict versionné : assertions avec `evidenceIds`, ressources avec `citationIds`, recommandations bornées, limites et indicateur de fallback. Zod/JSON Schema valide types, références, bornes, audience et absence de claims non fondés. Prompt version/checksum, modèle, paramètres, schéma, contexte checksum, latence et coût sont attachés à `ReportVersion`.

Le LLM ne calcule ni ne corrige le score, ne crée pas une Evidence vérifiée, ne publie rien et ne modifie jamais `ScoreSnapshot`. Un JSON invalide, timeout ou absence de citations déclenche retry borné puis rapport déterministe complet.

## Données et sécurité

Établir un registre par appelant : finalité, catégories de données, base légale/consentement si nécessaire, fournisseur/sous-traitant, région, rétention, logs et droit d'opposition. Ne jamais journaliser prompts/réponses complets en production. Détecter instructions dans documents/verbatims, borner longueur et refuser les références d'Evidence inconnues.

## Fallback

Le fallback assemble les axes, forces/priorités, limites et actions depuis règles/catalogues versionnés. Il peut produire HTML/PDF sans LLM ni RAG. Le statut indique `ENRICHMENT_UNAVAILABLE`, sans transformer un score réussi en tentative échouée.

## Agents

ARIA est un assistant conversationnel. Les générateurs de bilan sont des services. NPC et rapports sont des jobs exécutés par workers. Aucun besoin démontré ne justifie un agent autonome ou une architecture multi-agent pour la chaîne canonique.

La cible privilégie quatre machines d'état bornées, des workers idempotents, des schémas stricts et une décision humaine. Un agent ne serait acceptable que pour une responsabilité mesurable non autoritaire — par exemple proposer un brouillon de plan de séance — avec outils allowlistés, budget, traces, validation et aucune mutation de score/publication.
