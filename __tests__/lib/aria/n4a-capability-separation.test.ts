/**
 * N4A capability-separation lock: adding academic identity for SES, SVT,
 * HGGSP, HLP and DGEMC must never, by itself, imply ARIA chat grounding or
 * a servable RAG corpus. `ACADEMIC_COURSE_EXISTS` (this file's `getCourse`
 * assertions) is a strictly weaker fact than `ARIA_GROUNDED_CHAT` (a course
 * capability declaration) or `RAG_CORPUS_SERVABLE` (a validated servable
 * manifest binding) — N4A only ever proves the first for these five keys.
 */
import { getCourse } from '@/lib/curriculum/catalog';
import {
  getAriaCourseCapabilityDeclaration,
  resolveAriaCourseCorpusId,
} from '@/lib/aria/manifests/course-capabilities';
import { resolveAriaRagCorpusCapability } from '@/lib/aria/infrastructure/rag/manifest';
import { ARIA_RESOURCE_REGISTRY_SHA256 } from '@/lib/aria/manifests/resource-registry';
import { ARIA_PEDAGOGICAL_MODES } from '@/lib/aria/domain/pedagogy/pedagogical-mode';

const N4A_NEW_COURSE_KEYS = [
  'eds-hggsp-premiere',
  'eds-hggsp-terminale',
  'eds-hlp-premiere',
  'eds-hlp-terminale',
  'opt-dgemc-terminale',
] as const;

describe('N4A — academic identity never implies ARIA/RAG capability', () => {
  it.each(N4A_NEW_COURSE_KEYS)('%s exists in the academic catalog', (courseKey) => {
    expect(getCourse(courseKey)).not.toBeNull();
  });

  it.each(N4A_NEW_COURSE_KEYS)(
    '%s has no ARIA course capability declaration (ARIA_GROUNDED_CHAT=NO)',
    (courseKey) => {
      expect(getAriaCourseCapabilityDeclaration(courseKey)).toBeNull();
    },
  );

  it.each(N4A_NEW_COURSE_KEYS)(
    '%s resolves no corpus id for any pedagogical mode',
    (courseKey) => {
      for (const mode of ARIA_PEDAGOGICAL_MODES) {
        expect(
          resolveAriaCourseCorpusId({ courseKey, mode, agentRole: 'TUTOR' }),
        ).toBeNull();
      }
    },
  );

  it.each(N4A_NEW_COURSE_KEYS)(
    '%s resolves NOT_CONFIGURED for RAG corpus servability (RAG_CORPUS_SERVABLE=NO)',
    (courseKey) => {
      const result = resolveAriaRagCorpusCapability({
        courseKey,
        pedagogicalMode: 'DISCOVERY',
        agentRole: 'TUTOR',
        manifest: null,
        expectedResourceRegistrySha256: ARIA_RESOURCE_REGISTRY_SHA256,
      });
      expect(result).toEqual({
        status: 'NOT_CONFIGURED',
        reasonCode: 'COURSE_HAS_NO_DECLARED_CORPUS',
      });
    },
  );

  it('SES and SVT keep their pre-existing academic identity but gain no new capability from N4A', () => {
    for (const courseKey of ['eds-ses-premiere', 'eds-ses-terminale', 'eds-svt-premiere', 'eds-svt-terminale']) {
      expect(getCourse(courseKey)).not.toBeNull();
      expect(getAriaCourseCapabilityDeclaration(courseKey)).toBeNull();
    }
  });
});
