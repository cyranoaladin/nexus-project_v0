# Architecture cible

## Principes

Une application, une chaîne canonique, scoring déterministe, enrichissement LLM optionnel, RAG cité, jobs durables, rapports/version/publication séparés par audience, revue humaine, PDF privé, rattachement familial explicite, dashboards existants, migration additive réversible.

```text
Dashboards Next.js
      │ session + capacité + ownership + projection audience
      ▼
DiagnosticDefinition ─ Assignment ─ AssessmentAttempt ─ AssessmentResponse
                                              │
                                     deterministic scorer
                                              ▼
                                  SkillEvidence ─ ScoringRun
                                              │
                                         ScoreSnapshot
                                              │ outbox
                                              ▼
                                          ReportJob
                                  ┌───────────┼───────────┐
                                  │ RAG cited │ LLM JSON  │
                                  │ optional  │ optional  │
                                  └───────────┼───────────┘
                                              ▼
                                ReportVersion + private Artifact
                                              │
                                         HumanReview
                                              │
                                     ReportPublication
```

## Bounded contexts

- **Identity/relationships** : utilisateurs, élève, guardians, assignments, capacités.
- **Curriculum/catalogue** : versions/sources, définitions, banques et publication pédagogique.
- **Attempt/scoring** : réponses, preuves, runs et snapshots ; sans LLM.
- **Reporting** : jobs, contexte, RAG/LLM, versions, revue, publication, artefacts.
- **Operations** : outbox, leases, DLQ, audit, métriques.

Ce sont des modules du même produit et de la même gouvernance, pas des microservices obligatoires. Le worker est un processus séparé pour la durabilité, pas une plateforme.

## Invariants structurants

1. définition publiée immutable ; nouvelle modification = nouvelle version ;
2. attempt snapshotte assignment/curriculum/definition ;
3. soumission finale idempotente et transactionnelle ;
4. score snapshot immutable et indépendant des enrichissements ;
5. evidence itemisée, référencée par toute assertion ;
6. job consomme des IDs/checksums immutables, jamais « latest » ;
7. une `ReportVersion` appartient à une audience unique ;
8. publication append-only/révocable et jamais booléen global ;
9. parent/coach autorisés par liens/affectations actifs dans la requête ;
10. aucun contenu interne n'entre dans une projection externe.

## Contrats d'échec

Une panne RAG produit un code distinct d'un vide. Une panne LLM active un fallback déterministe. Une panne PDF laisse le rapport HTML/JSON approuvé disponible si politique autorisée. Un artefact invalide n'est jamais stocké comme prêt. Le score et ses preuves restent lisibles après toute panne d'enrichissement.

## Sécurité et RGPD

Minimisation à chaque boundary, pseudonymisation fournisseur, chiffrement transport/repos, URLs privées, rétention par type, suppression logique/révocation et audit. Threat model : IDOR, audience confusion, prompt injection, exfiltration via RAG/LLM, bundle de corrections, replay/idempotence, worker takeover, path traversal, PDF actif et logs PII.

## Compatibilité

Adapters de lecture/ingestion pour Assessment, Diagnostic, Bilan, StageBilan, EAF et NPC. `LegacyEntityLink` maintient traçabilité. Feature flags par matière/cohorte/audience, shadow scoring et comparaison. Aucun big-bang, aucune suppression avant preuve et période de rollback.

## Choix non arrêtés

Queue DB/outbox seule ou Redis/BullMQ ; Chroma ou pgvector ; S3/MinIO/opérateur ; modèle de capacités ; durée de rétention ; stratégie de signature PDF. Ces choix sont listés dans `18_DECISIONS_REQUIRED.md` et ne doivent pas être cachés dans une migration.
