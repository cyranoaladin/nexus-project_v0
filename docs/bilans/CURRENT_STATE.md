# État actuel du système de bilans

## Verdict

Le dépôt principal possède un socle riche et testable, mais le système unifié demandé n'existe pas encore. Les briques sont réparties entre deux moteurs de diagnostic, plusieurs modèles de rapports et des flux spécialisés. Le build et 6 415 tests unitaires passent ; les tests d'intégration DB ne sont pas exécutables sans base de test configurée.

## Flux actifs

### Assessment universel

`POST /api/assessments/submit` → banque de questions → scorer déterministe → `Assessment` + `DomainScore` → génération asynchrone non durable → polling statut/résultat.

Points positifs : validation runtime, version de questionnaire, scoring indépendant du LLM, trois audiences, score disponible lors d'un échec LLM.

Écarts : identité élève fournie dans le payload public, pas de rattachement parent requis dans ce flux, réponses `NOT_STUDIED` non modélisées, pas de preuve persistée par compétence, fire-and-forget.

### Diagnostic pré-stage

`POST /api/bilan-pallier2-maths` → validation → scoring V2 → génération RAG/Ollama → Markdown trois audiences → tokens d'accès.

Points positifs : maîtrise/couverture séparées, statut non étudié, incohérences, TrustScore, fallback déterministe, définition versionnée.

Écarts : route spécifique Maths, définitions non reliées à un registre de programmes daté, worker non durable et modèle legacy distinct d'Assessment.

### Rapports de stage générés

Questionnaire élève + rapport coach validé → `GeneratedPedagogicalReport` → contexte → JSON Mistral → validation Zod → LaTeX déterministe → PDF privé.

Points positifs : checksum, déduplication, RBAC coach, séparation JSON/LaTeX, durcissement de compilation et stockage configurable.

Écarts : pipeline spécialisé EAF/Maths, worker autonome durable non unifié, pas encore de publication famille contrôlée par audience.

## Données

- Les modèles principaux existent mais se chevauchent.
- La famille ne supporte pas encore plusieurs responsables légaux par lien vérifiable/révocable.
- Les `SkillScore` existants ne constituent pas le `SkillEvidence` détaillé exigé.
- Aucun registre relationnel `CurriculumVersion` ni snapshot de résolution n'existe.
- Les versions de questionnaire/scoring sont partielles ; prompt, corpus, template et checksum des entrées ne sont pas uniformément persistés.

## Sécurité

Acquis : guards de rôle, helpers coach-student, routes parent/enfant testées, tests IDOR nombreux, token signé et PDF coach protégé dans certains flux.

Ouvert : Assessment public sans ownership canonique, lien multi-parent, publication parent explicite, URL objet signée, rétention/purge, inventaire PII historique, réduction de logs et tests IDOR du futur rapport unifié.

## Pédagogie

- Huit définitions legacy existent, aucune des quinze définitions d'entrée du nouveau cahier n'est encore formellement créée.
- Les mappings ne distinguent pas programme préalable et cible par cohorte.
- Physique-Chimie, Français et préparation SNT ne sont pas couverts par le moteur canonique actuel.
- Toutes les banques sources restent à placer en revue pédagogique ; aucune reprise n'est déclarée publiable.

## RAG

ChromaDB est la décision canonique et le client existe. Le manifeste, les métadonnées complètes, le chunking sémantique, les checksums et l'approbation avant ingestion restent à implémenter. Aucun document n'a été ingéré pendant cette session.

## Risques prioritaires

1. Critique : jobs de génération Assessment non durables.
2. Critique : exposition potentielle de données historiques par matching email/nom dans les portails sources.
3. Élevé : programmes non résolus par cohorte, donc risque d'évaluer des notions non étudiées.
4. Élevé : modèles et statuts concurrents, migration difficile sans contrat canonique.
5. Élevé : gouvernance RAG incomplète et contenus de licence incertaine.
6. Élevé : absence de lien multi-responsables légaux et publication audience-scopée.
7. Moyen : 24 vulnérabilités npm et dette de warnings lint.

## Décision de premier lot

Commencer par un registre curriculum TypeScript/Zod et un resolver pur, sans migration Prisma. Ce lot réduit le risque pédagogique le plus amont, est testable sans secret/DB et ne bloque pas la future persistance. Les entrées initiales se limitent à des métadonnées officielles vérifiées ; aucune matrice de notions n'est créée automatiquement.
