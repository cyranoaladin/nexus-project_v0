# Architecture cible du système unifié de bilans

## Décision générale

Le système est un ensemble de modules du dépôt Next.js existant, pas une application parallèle. Les flux legacy restent derrière des adaptateurs pendant la migration. Les contrats déterministes et versionnés précèdent les migrations de données.

## Alternatives examinées pour le premier lot

### 1. Registre TypeScript/Zod puis persistance additive — retenu

Un registre immuable décrit les versions officielles et un resolver pur sélectionne programme préalable et cible selon l'année scolaire, le niveau, la voie et la variante. Avantages : tests rapides, aucun secret, aucune migration risquée, API stable pour la future DB. Limite : données en mémoire au début.

### 2. Modèles Prisma immédiatement

Avantage : persistance et administration rapides. Inconvénients : le schéma contient déjà des modèles redondants, la source éditoriale n'est pas tranchée et les règles internes imposent un arrêt/validation pour les changements Prisma. Écartée jusqu'à ADR de persistance.

### 3. Manifeste documentaire uniquement

Avantage : très faible risque. Inconvénient : aucune résolution runtime ni garantie de schéma. Écartée car elle ne constitue pas un lot technique consommable.

## Modules cibles

```text
Profil académique authentifié
  -> CurriculumResolver
  -> DiagnosticCatalog
  -> Attempt/Response autosave
  -> DeterministicScoring + SkillEvidence
  -> ScoreSnapshot immuable
  -> BullMQ ReportJob
  -> ContextBuilder -> ChromaDB retrieval -> JSON LLM validé
  -> DeterministicReportRenderer
  -> HumanReview -> audience-scoped publication -> object storage
```

### Curriculum

- `lib/curriculum/schemas/` : schémas Zod et types dérivés.
- `lib/curriculum/registry/` : métadonnées officielles immuables, checksums et statut de revue.
- `lib/curriculum/version-resolution/` : résolution déterministe et erreurs explicites en cas d'ambiguïté ou d'absence.
- Un `CurriculumContext` contient toujours `academicYear`, `previousAcademicYear`, `currentLevel`, `targetLevel`, `track`, `subject`, `subjectVariant`, `prerequisiteCurriculumId`, `targetCurriculumId` et, si pertinent, `examSession`.

### Diagnostics et preuves

- Une `AssessmentDefinition` référence explicitement les deux curriculum IDs.
- Les questions ont une version et un état de revue ; les réponses correctes et tests privés restent serveur-only.
- Les statuts `NOT_STUDIED`, `UNKNOWN` et `NO_ANSWER` sont distincts.
- Chaque contribution au score crée une preuve par compétence ; le snapshot contient version scoring, définition, curriculum et checksum d'entrée.

### Famille et permissions

- Modèle de lien plusieurs-à-plusieurs élève/responsable légal avec statut, vérification, révocation et permissions.
- L'identité élève vient de la session, jamais d'un `studentId` client sur les routes élève.
- La publication est un objet séparé par audience et version de rapport.
- Le rapport Nexus interne n'a aucune publication famille possible.

### Worker et rapports

- BullMQ/Redis, identifiant de job déterministe, retries bornés, backoff, verrou, idempotence et DLQ.
- Le score et le rapport déterministe existent avant l'appel LLM.
- Le LLM reçoit un contexte minimisé, retourne un JSON Zod-validé et ne peut pas ajouter de fait sans preuve.
- Toute régénération crée une nouvelle version et ne modifie jamais silencieusement une version validée.

### RAG et stockage

- ChromaDB via le service FastAPI existant ; aucun pgvector concurrent.
- Manifeste obligatoire avec checksum, autorité, licence, période d'effet, matière, niveau, version et approbation.
- Chunking sémantique par structure officielle avec page/section.
- PDF et exports dans S3/MinIO compatible, checksumés, versionnés, privés et servis par URL signée courte.

## Gestion des erreurs

- Aucun curriculum applicable : erreur métier explicite, diagnostic non démarrable, événement d'audit sans PII.
- Plusieurs versions applicables : erreur d'ambiguïté ; aucune sélection silencieuse.
- RAG/LLM indisponible : score et fallback déterministe restent disponibles ; job retry puis revue/DLQ.
- PDF indisponible : rapport structuré reste accessible aux rôles autorisés ; aucune publication de lien cassé.
- Publication refusée si question, rapport parent ou sources requises ne sont pas approuvés.

## Sécurité et confidentialité

- Zod à chaque frontière ; RBAC + ownership serveur ; rate limiting ; audit events minimisés.
- Aucune PII dans prompts persistés, logs, corpus ou métriques.
- Tests IDOR pour élève, parent, coach et téléchargement.
- Rétention et anonymisation configurables, à valider juridiquement avant pilote.

## Stratégie de migration

1. Contrats purs et adaptateurs legacy.
2. Persistance additive et double lecture contrôlée.
3. Backfill dry-run avec rapport de correspondance.
4. Feature flag du nouveau catalogue/scoring/worker.
5. Pilote limité et comparaison des snapshots.
6. Dépréciation progressive, sans suppression avant preuve de parité et rollback testé.
