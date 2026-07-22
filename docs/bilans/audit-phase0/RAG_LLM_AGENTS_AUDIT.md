# Audit RAG, LLM, agents et traitements asynchrones

## RAG

**Source de vérité observée : ChromaDB/FastAPI**, pas pgvector dans le chemin TypeScript courant (`lib/rag-client.ts:3-13`). La production observée exécute Chroma 1.1.1 + ingestor + Ollama, healthy sur loopback. Des traces pgvector et une dimension OpenAI 3072 subsistent dans la configuration/documentation : `docs/RAG_ARCHITECTURE.md:12-21` annonce nomic 768, `.env.example:57-69` annonce `text-embedding-3-large`/3072, et `docs/adr/003-rag-canonical-backend.md:9-43` constate lui-même le conflit. Aucune preuve runtime ne permet d'affirmer que tous les corpus ont la même dimension.

Collections exactes trouvées :

- `ressources_pedagogiques_premiere_maths`
- `ressources_pedagogiques_terminale`
- `ressources_pedagogiques_nsi_premiere`
- `ressources_pedagogiques_nsi_terminale`
- fallback client `ressources_pedagogiques_terminale` (`rag-client.ts:89-102`)
- defaults divergents du BilanGenerator : `methodologie`, `suites`, `derivation`, `probabilites` (`lib/bilan/generator.ts:193-211`)

La divergence prouve qu'une collection peut être vide/inexistante sans signal fort. `ragSearch` applique un timeout mais retourne silencieusement `[]` sur erreur (`rag-client.ts:112-138`) : panne et absence de résultat sont confondues. Il n'existe ni retry, circuit breaker, métrique, seuil de pertinence uniforme ni limite globale de contexte démontrée.

Les hits (`rag-client.ts:15-21`) exposent id/document/metadata/distance, mais `buildRAGContext` (`:237-255`) concatène le texte avec une provenance réduite. Le rapport ne peut pas garantir `sourceId`, `chunkId`, titre, section, page, version et score. Il n'existe pas de filtres d'année d'effet, variante ou version curriculum ; les champs actuels subject/level/track sont insuffisants. Les chunks sont introduits dans le prompt sans cloisonnement anti-instruction, déduplication robuste ni politique de taille/provenance.

Verdict RAG : **NO-GO** pour les bilans auditablement sourcés.

## Fournisseurs LLM observés

| Fournisseur/client | Usage | Contrat | Risques constatés |
|---|---|---|---|
| Ollama | Assessment et Bilan legacy/canonique | Markdown libre, modèles `llama3.2:latest` et `qwen2.5:32b` codés | pas de schéma, contexte non fiable, fallback inégal |
| Mistral | GeneratedPedagogicalReport | JSON mode + Zod + timeout | pas de retry ; PII/verbatims complets ; grounding non vérifié |
| OpenAI | ARIA/embeddings documentés | flux distinct | configuration dimension contradictoire ; PII selon usage |
| Chutes | NPC/correction de copies | flux distinct | à conserver séparé, modèle/coût à tracer |
| Gemini | aucun client actif trouvé | n/a | ne pas revendiquer |

`lib/assessments/generators/index.ts` lance trois appels Ollama, sans RAG ni sortie structurée ; l'échec conserve le score déterministe mais ne produit pas un rapport narratif déterministe. `lib/bilan-generator.ts` a un fallback utile, mais transmet identité, école, moyennes, verbatims et chunks RAG. `lib/bilan/generator.ts:218-260` produit trois Markdown libres, enregistre un nom de moteur mais pas prompt checksum/citations exploitables, et marque `ragUsed=true` même avec zéro hit (`:193-211`).

La chaîne Mistral valide la forme (`processGeneratedReportJob.ts:59-77`) mais pas la véracité des affirmations ou le lien aux Evidence IDs. `buildReportContext.ts` refetch les derniers bilans au lieu de garantir les IDs du job et inclut nom, école, réponses libres et commentaire coach. Le prompt demande de respecter les données, sans neutraliser une injection présente dans un verbatim ou chunk.

Aucun chemin audité ne confie explicitement le calcul du score principal au LLM ; c'est positif. Il manque toutefois une validation logicielle interdisant à la sortie narrative structurée de présenter un score inventé comme officiel.

## Agents

ARIA est un assistant conversationnel ; les générateurs sont des services ; NPC et la génération de rapports sont des workers/jobs ; aucun orchestrateur multi-agent n'est nécessaire ni démontré pour la phase suivante. Ajouter des « agents » augmenterait la surface d'erreur et d'audit sans valeur probante. Une machine d'état déterministe + services bornés est suffisante.

## Robustesse async

- Assessment : `submit/route.ts:168-182`, deux fire-and-forget perdus au restart.
- Bilan : `bilans/generate/route.ts:100-110`, lancement puis update de statut, avec course possible.
- Generated report : job DB, mais aucun claim compare-and-set/lease, retry planifié, backoff, DLQ ni reprise automatique (`processGeneratedReportJob.ts:19-43`).
- Le checksum (`checksums.ts:3-20`) n'est pas un checksum des données, seulement de timestamps/versions.
- PDF : stockage local par défaut (`reportStorage.ts:20-30`); aucun répertoire préexistant observé en production et aucun objet signé.

Scénarios non démontrés : restart Next/worker, outage LLM/RAG, double clic, deux workers, échec PDF, régénération non destructive. Verdict LLM/worker : **NO-GO**.
