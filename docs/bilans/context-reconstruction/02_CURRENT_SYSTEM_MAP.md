# Carte du système actuel

## Application cible

`nexus-project_v0` est une application Next.js 15 App Router TypeScript strict, NextAuth, Prisma/PostgreSQL, avec dashboards par rôle. Le middleware protège surtout les pages ; chaque route API reste responsable de son guard. Le dépôt contient plusieurs clients LLM, un client RAG FastAPI/Chroma, plusieurs moteurs PDF et deux conceptions de worker.

```text
Dashboards / portails publics
  ├─ Assessment public ── Prisma Assessment/DomainScore/SkillScore ── Ollama
  ├─ Diagnostic Pallier2 ─ Prisma Diagnostic ─ RAG + LLM/fallback
  ├─ Bilan générique ───── Prisma Bilan ─ RAG + Qwen/Ollama
  ├─ StageBilan ────────── Prisma StageBilan/Bilan ─ rendu/PDF parent
  ├─ EAF/Maths stage ───── rapports dédiés ─ GeneratedPedagogicalReport/Mistral/LaTeX
  └─ NPC copies ────────── CopySubmission/AiProcessingJob/PedagogicalReport/Chutes
```

## Chaînes constatées

| Chaîne | Entrée | Score | Rapport / stockage | Publication | État |
|---|---|---|---|---|---|
| Assessment | `/bilan-gratuit/assessment` | `BaseScorer`, déterministe mais NSP incorrect | 3 Markdown dans `Assessment`, Ollama fire-and-forget | statut `COMPLETED`, audiences mélangées au GET result | active, publique, non canonique |
| Diagnostic Pallier 2 | `/bilan-pallier2-maths` | `score-diagnostic.ts`, mix preuves/déclaratif | 3 Markdown dans `Diagnostic`, génération synchrone + fallback | lien signé mais payload multi-audience | active, spécialisée |
| Bilan générique | API/staff, vues diverses | scores JSON/agrégats | 3 Markdown dans `Bilan`, RAG + Qwen | booléen global `isPublished` | active, fragile |
| StageBilan | pages coach/parent stages | moteur spécifique | trois contenus dans `StageBilan` et PDF à la demande | booléen global | active, manuelle |
| EAF préparation | questionnaires élève/coach | complétude/règles spécifiques | `EafPreparationReport` + job généré | validation de rapport coach | active, dédiée |
| Maths stage | questionnaires élève/coach | spécifique | `Bilan`/rapport coach ; création job incomplète côté élève | booléen/état dédié | active, dédiée |
| Generated stage report | déclenchée quand entrées jugées prêtes | réutilise entrées | JSON Mistral validé, LaTeX, PDF local, `GeneratedPedagogicalReport` | `NEEDS_REVIEW`, téléchargement coach | pré-canonique partielle |
| NPC | dépôt de copie coach | LLM attribue actuellement des points | DB job worker, rapports/matrices | visibilité NPC distincte | producteur distinct, non canonique |

La matrice exhaustive est dans `WORKFLOW_INVENTORY.csv`.

## Principales incohérences confirmées

- `Bilan` comporte un commentaire de convergence mais aucun lien relationnel effectif vers les IDs historiques annoncés.
- `AssessmentRunner` importe les questions côté client ; `isCorrect` et explications peuvent donc entrer dans le bundle.
- `__NSP__` n'est pas reconnu par la soumission et devient `incorrect`.
- Le GET résultat Assessment renvoie `studentMarkdown` et `parentsMarkdown` ensemble.
- Le GET partagé Diagnostic renvoie plusieurs audiences et les données brutes.
- `sanitizeBilanForRole` retire l'interne mais ne projette pas une seule audience.
- Le dashboard élève transforme un `Bilan` vers une page de résultat `Diagnostic`, alors qu'une route dashboard Bilan sécurisée existe.
- `GeneratedPedagogicalReport` n'a ni version de publication, ni revue structurée, ni lease/retry.
- Le contexte stage refait une requête « latest » au lieu de consommer strictement les IDs d'entrée du job.
- NPC annonce un retry mais remet les échecs en `RETRYING`, état que le claim ne sélectionne pas ; la constante de lock n'est pas utilisée.

## Sources en lecture seule

- `Interface_NSI_Bilan_Support_Suivi` apporte BullMQ, retries/DLQ, S3/MinIO, deux audiences et métriques, mais combine deux pipelines, journalise des PII et utilise pgvector.
- `Interface_Maths_2025_2026` et `Interface_Maths_2025_2026_Fixed` apportent rubric, traces par question et revue humaine, mais le LLM attribue les points et des portails statiques recherchent des personnes par nom/email.
- `nexus-reussite-app` confirme le modèle Nexus multi-enfants côté parent, les cinq rôles historiques et l'intégration aux dashboards ; il n'est pas une cible d'implémentation.
- `NSI_cours_accompagnement` apporte des contenus, quiz et logique de maîtrise ; il reste une source pédagogique, pas une application à fusionner.

## Tests : portée réelle

Les tests unitaires et routes utilisent largement Prisma, auth, fetch et fournisseurs mockés. Les suites `__tests__/db`, `__tests__/integration/*real*`, `__tests__/security/idor-real.test.ts` requièrent PostgreSQL. Playwright requiert une application, des fixtures et souvent une DB. Le RAG unitaire simule `fetch`; les générateurs simulent les fournisseurs.

Pendant cette reconstruction, 10 suites/63 tests ciblés ont passé, TypeScript a passé et Prisma a validé le schéma. Cela ne prouve ni l'IDOR sur PostgreSQL réel, ni Redis, ni RAG/LLM/PDF réels, ni un parcours E2E.
