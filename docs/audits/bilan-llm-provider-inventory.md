# Inventaire des fournisseurs LLM pour les bilans

## Date

30 juillet 2026.

## Résultat

C1 ajoute un seul client OpenRouter, non raccordé au moteur métier. Le moteur
canonique de `lib/bilans/engine` n'importe aucun fournisseur LLM. Mistral reste
un chemin historique de stages et Chutes reste un composant NPC.

| Implémentation | Fournisseur | Consommateurs | Modèle de données | Actif pour les nouveaux bilans canoniques | Historique uniquement | Action de migration | Gate de retrait |
| --- | --- | --- | --- | ---: | ---: | --- | --- |
| `lib/llm/openrouter/client.ts` | OpenRouter | preflight synthétique C1 uniquement | aucun en C1 | non | non | C2 : invocation asynchrone et provenance | preflight, confidentialité, worker et schéma métier validés |
| `lib/llm/mistral.ts` | Mistral direct | rapports de stages, tests legacy | `GeneratedPedagogicalReport` | non | oui pour le domaine canonique | C3 : interdire tout consommateur canonique, conserver la lecture | zéro route Mistral produisant un bilan canonique |
| `lib/bilan-generation/generateBilanWithMistral.ts` | Mistral direct | `lib/bilan-generation/index.ts` | `Bilan.parentsMarkdown`, `sourceData.generationMetadata` | non | oui | C3 : borner explicitement les deux routes maths printemps | aucune écriture canonique et tests de lecture legacy |
| `lib/bilan-generation/saveGeneratedBilan.ts` | persistance legacy | orchestrateur Mistral legacy | `Bilan` | non | oui | C3 : empêcher le dual-write depuis le moteur canonique | `CANONICAL_REPORT_DUAL_WRITE_COUNT=0` |
| `lib/reports/stage/generateStructuredReportWithMistral.ts` | Mistral direct | `processGeneratedReportJob.ts` | `GeneratedPedagogicalReport` | non | oui | conserver jusqu'à migration séparée du domaine stage | lecteurs historiques et exports non régressés |
| `lib/npc/ai/chutes-client.ts` | Chutes | `lib/npc/ai/index.ts` | modèles NPC | non | domaine distinct | aucune importation depuis `lib/bilans/engine` | test d'architecture vert |
| `lib/bilans/engine/report-service.ts` | aucun | API canonique #89 | `ReportArtifact`, `ReportRevision`, `ReportPublication` | génération déterministe actuelle | non | C2/C3 : remplacer la narration par job OpenRouter sans appel réseau en transaction | C1 ne modifie pas ce fichier |

## Consommateurs legacy observés

- `app/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-parent/route.ts`
- `app/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-student/route.ts`
- `lib/reports/stage/processGeneratedReportJob.ts`
- `lib/reports/stage/generateStructuredReportWithMistral.ts`

Les lectures de `Bilan.parentsMarkdown` sont présentes dans les dashboards,
exports et PDF historiques. Elles doivent être conservées pendant la migration.
Le modèle `GeneratedPedagogicalReport` conserve ses états et documents de
stages existants.

## Modèles canoniques déjà présents

- `ReportArtifact` porte l'audience et le pointeur de publication.
- `ReportRevision` porte le snapshot de score, le checksum de contexte et le
  contenu versionné.
- `ReportPublication` porte la version, l'idempotence et la révocation.
- `Bilan` et `GeneratedPedagogicalReport` sont des surfaces legacy distinctes.

C1 n'ajoute aucune table et ne modifie aucune migration.

## Variables

### Nouveau contrat, non activé

`BILAN_REPORT_GENERATION_MODE` et les variables `OPENROUTER_*` /
`BILAN_OPENROUTER_*` documentées dans `.env.example`.

### Legacy

`MISTRAL_API_KEY`, `MISTRAL_MODEL`, `MISTRAL_BASE_URL`,
`MISTRAL_TIMEOUT_MS`, `CHUTES_API_KEY` et `CHUTES_BASE_URL` restent utilisés
par leurs domaines historiques. Leur présence ne sélectionne jamais le client
canonique C1.

## Compteurs C1

- `OPENROUTER_CLIENT_IMPLEMENTATION_COUNT=1`
- `ACTIVE_CANONICAL_BILAN_LLM_PROVIDER_COUNT=0` (raccordement volontairement
  hors périmètre C1)
- `NEW_CANONICAL_BILAN_MISTRAL_WRITE_COUNT=0`
- `CANONICAL_LEGACY_DUAL_WRITE_COUNT=0`

La cible `ACTIVE_CANONICAL_BILAN_LLM_PROVIDER_COUNT=1` ne deviendra vraie
qu'après C2/C3, sans modifier l'historique.

