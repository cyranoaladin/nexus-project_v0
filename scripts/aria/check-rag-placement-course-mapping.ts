/**
 * Standing regression guard for the RAG placement → courseKey mapping
 * primitive a future real C05a importer will consume. Proves, against the
 * REAL curriculum catalog:
 *   - every RAG placement tuple from the sealed production release resolves
 *     to its exact courseKey;
 *   - building the full mapping index over every curriculum course with a
 *     `programmeSelector` never throws.
 *
 * A future curriculum edit that introduces a genuine ambiguity (two courses
 * sharing one RAG vocabulary tuple) will not fail THIS check — that is a
 * legitimate `PLACEMENT_COURSE_MAPPING_AMBIGUOUS` result the real importer
 * must handle when it exists (see `mapBootstrapPlacementToCourseKey`) — but
 * this check does confirm every named case the corpus already relies on
 * keeps resolving unambiguously.
 *
 * The 11 sealed-release cases below are pinned against evidence, not
 * invented: producer `cyranoaladin/RAG`, commit
 * `dd0ae3d9490703c0c180b12a7fce11f5c222427d`, release
 * `production-profile-gate-2026-2027-v1` — see
 * `services/rag-pedago/data/releases/prerentree_2026_2027/profile_gate/{production-profile-gate.release.json,programme_registry.json}`
 * in that repository, and `__tests__/lib/aria/rag-placement-to-course-key.test.ts`
 * for the full per-collection cross-check in this one.
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
  {
    label: 'SES Première',
    placement: { matiere: 'ses', niveau: 'premiere', voie: 'generale', statut_enseignement: 'specialite' },
    expectedCourseKey: 'eds-ses-premiere',
  },
  {
    label: 'SES Terminale',
    placement: { matiere: 'ses', niveau: 'terminale', voie: 'generale', statut_enseignement: 'specialite' },
    expectedCourseKey: 'eds-ses-terminale',
  },
  {
    label: 'SVT Première',
    placement: { matiere: 'svt', niveau: 'premiere', voie: 'generale', statut_enseignement: 'specialite' },
    expectedCourseKey: 'eds-svt-premiere',
  },
  {
    label: 'SVT Terminale',
    placement: { matiere: 'svt', niveau: 'terminale', voie: 'generale', statut_enseignement: 'specialite' },
    expectedCourseKey: 'eds-svt-terminale',
  },
  {
    label: 'HGGSP Première',
    placement: { matiere: 'hggsp', niveau: 'premiere', voie: 'generale', statut_enseignement: 'specialite' },
    expectedCourseKey: 'eds-hggsp-premiere',
  },
  {
    label: 'HGGSP Terminale',
    placement: { matiere: 'hggsp', niveau: 'terminale', voie: 'generale', statut_enseignement: 'specialite' },
    expectedCourseKey: 'eds-hggsp-terminale',
  },
  {
    label: 'HLP Première',
    placement: { matiere: 'hlp', niveau: 'premiere', voie: 'generale', statut_enseignement: 'specialite' },
    expectedCourseKey: 'eds-hlp-premiere',
  },
  {
    label: 'HLP Terminale',
    placement: { matiere: 'hlp', niveau: 'terminale', voie: 'generale', statut_enseignement: 'specialite' },
    expectedCourseKey: 'eds-hlp-terminale',
  },
  {
    label: 'DGEMC Terminale (option, voie générale)',
    placement: { matiere: 'dgemc', niveau: 'terminale', voie: 'generale', statut_enseignement: 'option' },
    expectedCourseKey: 'opt-dgemc-terminale',
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
