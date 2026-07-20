# Audit du modèle de données et des workflows

## Conclusion

Le modèle actuel contient au moins six chaînes de bilan/rapport partiellement redondantes. `Bilan` est qualifié de canonique dans les commentaires, mais ni les relations, ni les statuts, ni les routes ne l'imposent. **NO-GO base/workflow avant ADR de convergence et migration explicite.**

## Cartographie

| Concept | Preuve Prisma | Identité / relation | Statut/version/audience | Observation |
|---|---|---|---|---|
| `Diagnostic` | `schema.prisma:963-1021` | email/nom bruts | statut String, 3 Markdown | ancien flux autonome |
| `Assessment` | `:1235-1316` | Student optionnel + email/nom | statut/progress, version assessment/engine, 3 Markdown | accepte anonyme ; pas snapshot curriculum/prompt |
| `Bilan` | `:1318-1410` | Student/Coach + legacy IDs | status, `isPublished`, 3 Markdown | publication unique non audience ; consolidation incomplète |
| `DomainScore`/`SkillScore` | `:1412-1444` | Assessment | scores agrégés | pas de preuve item/règle snapshotée |
| `StageBilan` | `:1137-1162` | inscription stage | 3 contenus + booléen publication | chaîne parallèle |
| `EafPreparationReport` | `:1915-1948` | Student/Coach | statut validation propre | preuve coach spécifique |
| NPC `CopySubmission`/`AiJob`/`PedagogicalReport` | `:2055-2233` | soumission/document | worker et visibilité propres | correction de copies, sémantique distincte |
| `GeneratedPedagogicalReport` | `:2339-2390` | Student/Coach/Bilan | nombreux statuts, checksum, PDF | pas de publication/revue audience versionnée |

`Student` a un `parentId` requis vers un seul `ParentProfile` (`schema.prisma:249-252`). Ceci ne modélise pas plusieurs responsables légaux, historique, type de garde ou consentement. L'ownership parent hérite de cette limitation.

## Incompatibilités

- Identifiants : certains flux utilisent FK Student, d'autres email, publicShareId ou IDs legacy.
- Statuts : String libre, enums/valeurs différentes, booléen `isPublished`, `PDF_READY`, `VALIDATED`, `COMPLETED` sans automate commun.
- Audiences : trois colonnes Markdown mais un seul booléen de publication ; aucune table de publication par audience/version.
- Formats : Markdown en DB, PDF à la volée, PDF local, documents NPC ; provenance et rétention diffèrent.
- Version : assessment/engine parfois enregistrés, prompt/template sur GeneratedReport, mais pas de curriculum/règles/sources/inputs immuables cohérents.
- Destruction : `DELETE /api/bilans/[id]` supprime ; une régénération peut remplacer l'état sans journal d'audit complet.

## Architecture de convergence recommandée

```text
DiagnosticDefinition(version, curriculumSnapshot)
  → Attempt(idempotencyKey, studentId, definitionVersion, status)
  → Answer(raw, normalized, savedAt)
  → Evidence(itemId, competencyId, ruleVersion, provenance)
  → ScoringRun(deterministicEngineVersion)
  → ScoreSnapshot(immutable, checksum)
  → ReportJob(unique inputChecksum, atomic lease, retry/backoff)
  → ReportVersion(prompt/model/RAG citations/input checksum)
  → Review(decision, reviewer, audit event)
  → Publication(reportVersion, audience, publishedAt, revokedAt)
```

Le LLM ne reçoit que le snapshot déterministe et ne modifie jamais ScoreSnapshot. Un rapport interne, élève et parent devient une version/audience distincte, jamais trois champs renvoyés indistinctement.

## Migration argumentée

1. Définir une table de correspondance, sans supprimer les tables historiques : `Diagnostic/Assessment` → Attempt ; `DomainScore/SkillScore` → Evidence/ScoreSnapshot ; `Bilan/StageBilan` → ReportVersion/Publication ; EAF → Evidence coach ; NPC reste un producteur distinct vers ReportVersion.
2. Double écriture transactionnelle derrière feature flag, avec IDs legacy conservés et checksum comparé.
3. Backfill idempotent par lots, journalisé, avec comptages avant/après et rollback logique.
4. Lecture nouvelle avec fallback ancien ; canary par type de bilan ; aucune republication automatique.
5. Migrer une chaîne à la fois : Assessment, diagnostics maths, Stage/EAF, puis NPC. Ne pas forcer NPC dans la même sémantique de tentative.
6. Après parité et tests DB/E2E, geler les anciennes écritures ; archiver, ne pas supprimer.

## Worker et statuts

Automate canonique proposé :

```text
PENDING → CLAIMED → BUILDING_CONTEXT → LLM_GENERATING → VALIDATING
  → RENDERING → STORED → NEEDS_REVIEW → APPROVED → PUBLISHED
             └→ RETRY_SCHEDULED → CLAIMED
             └→ DEAD_LETTER
PUBLISHED → REVOKED (jamais supprimé)
```

Comparaison : `processGeneratedReportJob.ts:34-102` saute de lecture à mises à jour successives sans `CLAIMED` atomique, lease, max attempts, backoff ou DLQ. `maybeCreateGeneratedReportJob.ts:80-116` assure une unicité applicative/DB utile, mais le checksum ne couvre que deux timestamps + versions (`checksums.ts:3-20`) et le contexte est refetché plus tard. Deux workers peuvent traiter le même report ; un restart au mauvais moment laisse un statut intermédiaire.
