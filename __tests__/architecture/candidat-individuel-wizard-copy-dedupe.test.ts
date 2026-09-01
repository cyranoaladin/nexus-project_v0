import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAutoCheckableEligibilityConditionsClient, getSellableSessionClient } from '@/lib/exams/catalog-client';
import { ELIGIBILITY_QUESTION_LABELS as DEVIS_WIZARD_ELIGIBILITY_QUESTION_LABELS } from '@/components/quotes/DevisWizard';
import { ELIGIBILITY_QUESTION_LABELS as PREVIEW_ELIGIBILITY_QUESTION_LABELS } from '@/components/dashboard/assistante/PublicWizardPreview';

/**
 * Mission P0-A dedupe (ZERO_MANUAL_KEEP_IN_SYNC = PASS) — locks that the
 * four hardcodings the mission flagged in the live public wizard
 * (components/quotes/DevisWizard.tsx) and its internal preview sibling
 * (components/dashboard/assistante/PublicWizardPreview.tsx) are gone:
 * SUBJECT_LABELS, TIER_BY_STRATEGY, SUPPORTED_SESSION, ELIGIBILITY_
 * QUESTIONS. Each now derives from a single canonical source instead of a
 * hand-duplicated literal — this test proves the source-level absence of
 * the old literals and the runtime completeness of the presentation-copy
 * maps that replaced ELIGIBILITY_QUESTIONS' hardcoded id list.
 */

const root = process.cwd();

function read(relPath: string): string {
  return readFileSync(join(root, relPath), 'utf8');
}

describe('ZERO_MANUAL_KEEP_IN_SYNC — candidat-individuel public wizard copy', () => {
  test('SUBJECT_LABELS: exam-profile.ts, pdf-adapter.ts, DevisWizard.tsx, PublicWizardPreview.tsx import the canonical map, none redefines it', () => {
    for (const file of [
      'lib/quotes/exam-profile.ts',
      'lib/quotes/pdf-adapter.ts',
      'components/quotes/DevisWizard.tsx',
      'components/dashboard/assistante/PublicWizardPreview.tsx',
    ]) {
      const source = read(file);
      expect(source).toMatch(/from ['"]@\/lib\/quotes\/subject-labels['"]|from ['"]\.\/subject-labels['"]/);
      // Never a locally-redefined literal map (the old duplication shape).
      expect(source).not.toMatch(/SUBJECT_LABELS[^=]*=\s*\{\s*\n?\s*MATHEMATIQUES:/);
    }
  });

  test('TIER_BY_STRATEGY: recommendation.ts, pipeline.ts, DevisWizard.tsx import SCENARIO_TIER_BY_STRATEGY from schemas.ts, none redefines it', () => {
    for (const file of ['lib/quotes/recommendation.ts', 'lib/quotes/pipeline.ts', 'components/quotes/DevisWizard.tsx']) {
      const source = read(file);
      expect(source).toMatch(/SCENARIO_TIER_BY_STRATEGY/);
      expect(source).not.toMatch(/RESPECT_BUDGET:\s*'ESSENTIEL'/);
    }
  });

  test('SUPPORTED_SESSION: DevisWizard.tsx, PublicWizardPreview.tsx, DevisWorkspace.tsx derive it from getSellableSessionClient(), never a literal year', () => {
    for (const file of [
      'components/quotes/DevisWizard.tsx',
      'components/dashboard/assistante/PublicWizardPreview.tsx',
      'components/dashboard/assistante/DevisWorkspace.tsx',
    ]) {
      const source = read(file);
      expect(source).toMatch(/SUPPORTED_SESSION\s*=\s*getSellableSessionClient\(\)/);
      expect(source).not.toMatch(/SUPPORTED_SESSION\s*=\s*20\d\d/);
    }
  });

  test('ELIGIBILITY_QUESTIONS: DevisWizard.tsx and PublicWizardPreview.tsx derive the condition ids from getAutoCheckableEligibilityConditionsClient, never a hardcoded id list', () => {
    for (const file of ['components/quotes/DevisWizard.tsx', 'components/dashboard/assistante/PublicWizardPreview.tsx']) {
      const source = read(file);
      expect(source).toMatch(/getAutoCheckableEligibilityConditionsClient\(\s*SUPPORTED_SESSION\s*,?\s*\)/);
      // The old shape hardcoded every {id, label} pair inline.
      expect(source).not.toMatch(/\{\s*id:\s*'age20'/);
    }
  });

  test("ELIGIBILITY_QUESTION_LABELS completeness (fail-closed on drift): every canonical auto-checkable condition id has a presentation entry in both wizards, right now and for whatever session is currently sellable", () => {
    const session = getSellableSessionClient();
    const conditions = getAutoCheckableEligibilityConditionsClient(session);
    expect(conditions.length).toBeGreaterThan(0);

    for (const labels of [DEVIS_WIZARD_ELIGIBILITY_QUESTION_LABELS, PREVIEW_ELIGIBILITY_QUESTION_LABELS]) {
      for (const condition of conditions) {
        expect(labels).toHaveProperty(condition.id);
      }
    }
  });
});
