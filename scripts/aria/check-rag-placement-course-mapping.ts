/**
 * Standing regression guard for the RAG placement → courseKey mapping
 * primitive a future real C05a importer will consume. Proves, against the
 * REAL curriculum catalog:
 *   - the two currently known RAG placements resolve to their exact courseKey;
 *   - building the full mapping index over every curriculum course with a
 *     `programmeSelector` never throws.
 *
 * A future curriculum edit that introduces a genuine ambiguity (two courses
 * sharing one RAG vocabulary tuple) will not fail THIS check — that is a
 * legitimate `PLACEMENT_COURSE_MAPPING_AMBIGUOUS` result the real importer
 * must handle when it exists (see `mapBootstrapPlacementToCourseKey`) — but
 * this check does confirm the two named cases the corpus already relies on
 * keep resolving unambiguously.
 */
import {
  catalogPlacementSignatureCount,
  mapBootstrapPlacementToCourseKey,
} from '../../lib/aria/infrastructure/rag/rag-placement-to-course-key';

const KNOWN_PLACEMENTS = [
  {
    label: 'NSI Première',
    placement: { matiere: 'nsi', niveau: 'premiere', voie: 'generale', statut_enseignement: 'specialite' },
    expectedCourseKey: 'eds-nsi-premiere',
  },
  {
    label: 'NSI Terminale',
    placement: { matiere: 'nsi', niveau: 'terminale', voie: 'generale', statut_enseignement: 'specialite' },
    expectedCourseKey: 'eds-nsi-terminale',
  },
] as const;

export function checkKnownPlacementMappings(): readonly string[] {
  const failures: string[] = [];
  for (const { label, placement, expectedCourseKey } of KNOWN_PLACEMENTS) {
    const result = mapBootstrapPlacementToCourseKey(placement);
    if (result.outcome !== 'MATCHED' || result.courseKey !== expectedCourseKey) {
      failures.push(`${label}: expected MATCHED ${expectedCourseKey}, got ${JSON.stringify(result)}`);
    }
  }
  return failures;
}

function main(): void {
  const failures = checkKnownPlacementMappings();
  // The known-cases check above already forced the memoized index to build;
  // reading its size here never rebuilds it a second time.
  const indexSize = catalogPlacementSignatureCount();

  if (failures.length > 0) {
    for (const failure of failures) process.stderr.write(`${failure}\n`);
    process.stderr.write(`PLACEMENT_COURSE_MAPPING_KNOWN_CASES_FAILED=${failures.length}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`PLACEMENT_COURSE_MAPPING_KNOWN_CASES_OK=${KNOWN_PLACEMENTS.length}\n`);
  process.stdout.write(`PLACEMENT_COURSE_MAPPING_SIGNATURES=${indexSize}\n`);
}

if (require.main === module) {
  main();
}
