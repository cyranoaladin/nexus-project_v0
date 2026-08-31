import {
  expectedAriaQualificationIds,
  extractQualificationCasesFromJest,
  extractQualificationCasesFromPlaywright,
  qualificationIdsInReference,
  validateAriaQualificationEvidence,
} from '@/scripts/aria/qualification-evidence';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('ARIA exact-head qualification evidence', () => {
  it('defines the complete non-negotiable ID registry without using test counts as quality', () => {
    const ids = expectedAriaQualificationIds();
    expect(ids).toHaveLength(294);
    expect(ids).toEqual(expect.arrayContaining([
      'U001', 'U064', 'A001', 'A020', 'I001', 'I024', 'D001', 'D020',
      'H001', 'H012', 'E001', 'E026', 'P001', 'P019', 'S001', 'S010',
      'ARIA-B-R001', 'ARIA-B-R099',
    ]));
  });

  it('expands every matrix list and range into executable qualification IDs', () => {
    expect(qualificationIdsInReference('U006–U009 / I005 / R001-R003 / E016')).toEqual([
      'U006', 'U007', 'U008', 'U009', 'I005',
      'ARIA-B-R001', 'ARIA-B-R002', 'ARIA-B-R003', 'E016',
    ]);
    expect(() => qualificationIdsInReference('U064–A001'))
      .toThrow('ARIA_TEST_TRACEABILITY_INVALID:RANGE_PREFIX:U:A');
  });

  it('TRACEABILITY_REJECTS_REVERSE_RANGE', () => {
    expect(() => qualificationIdsInReference('U010-U009'))
      .toThrow('ARIA_TEST_TRACEABILITY_INVALID:RANGE_ORDER:U010:009');
  });

  it('TRACEABILITY_PRESERVES_UNKNOWN_JEST_ID_FOR_REJECTION', () => {
    expect(extractQualificationCasesFromJest('unit', {
      testResults: [{
        name: '/repo/__tests__/unit.test.ts',
        assertionResults: [{ fullName: 'U999 unknown qualification', status: 'passed' }],
      }],
    })).toEqual([
      expect.objectContaining({ id: 'U999', lane: 'unit', status: 'PASSED' }),
    ]);
  });

  it('TRACEABILITY_PRESERVES_UNKNOWN_PLAYWRIGHT_ID_FOR_REJECTION', () => {
    expect(extractQualificationCasesFromPlaywright({
      suites: [{
        file: 'e2e/aria/unknown.spec.ts',
        specs: [{
          title: 'E999 unknown qualification',
          tests: [{ results: [{ status: 'passed' }] }],
        }],
      }],
    })).toEqual([
      expect.objectContaining({ id: 'E999', lane: 'e2e', status: 'PASSED' }),
    ]);
  });

  it('TRACEABILITY_DOES_NOT_TRUNCATE_FOUR_DIGIT_QUALIFICATION_IDS', () => {
    expect(extractQualificationCasesFromJest('unit', {
      testResults: [{
        assertionResults: [{
          fullName: 'U9999 and ARIA-B-R9999 are not qualification identifiers',
          status: 'passed',
        }],
      }],
    })).toEqual([]);
  });

  it('TRACEABILITY_DOES_NOT_EXTRACT_IDS_FROM_ALPHANUMERIC_SUBSTRINGS', () => {
    expect(extractQualificationCasesFromJest('unit', {
      testResults: [{
        assertionResults: [{
          fullName: 'SKU999 and ERROR001 are ordinary words',
          status: 'passed',
        }],
      }],
    })).toEqual([]);
  });

  it('TRACEABILITY_DOES_NOT_EXTRACT_IDS_ADJACENT_TO_LOWERCASE_OR_UNICODE_LETTERS', () => {
    expect(extractQualificationCasesFromJest('unit', {
      testResults: [{
        assertionResults: [{
          fullName: 'skuU999 U999suffix préfixeU999 errorR001 XARIA-B-R001',
          status: 'passed',
        }],
      }],
    })).toEqual([]);
  });

  it('TRACEABILITY_DOES_NOT_EXTRACT_IDS_ADJACENT_TO_UNICODE_MARKS', () => {
    expect(extractQualificationCasesFromJest('unit', {
      testResults: [{
        assertionResults: [{
          fullName: 'pre\u0301U999 and U999\u0301suite are decomposed word substrings',
          status: 'passed',
        }],
      }],
    })).toEqual([]);
  });

  it('TRACEABILITY_REJECTS_TRUNCATED_RANGE_ENDPOINT', () => {
    expect(() => qualificationIdsInReference('U001-U9999'))
      .toThrow('ARIA_TEST_TRACEABILITY_INVALID:MALFORMED_ID:U9999');
  });

  it('TRACEABILITY_REJECTS_SHORT_RANGE_ENDPOINT', () => {
    expect(() => qualificationIdsInReference('U001-U99'))
      .toThrow('ARIA_TEST_TRACEABILITY_INVALID:MALFORMED_RANGE:U001-U99');
  });

  it('TRACEABILITY_REJECTS_ALPHANUMERIC_RANGE_ENDPOINT', () => {
    expect(() => qualificationIdsInReference('U001-U999X'))
      .toThrow('ARIA_TEST_TRACEABILITY_INVALID:MALFORMED_RANGE:U001-U999X');
  });

  it('TRACEABILITY_REJECTS_SHORT_RANGE_START', () => {
    expect(() => qualificationIdsInReference('U01-U002'))
      .toThrow('ARIA_TEST_TRACEABILITY_INVALID:MALFORMED_RANGE:U01-U002');
  });

  it('TRACEABILITY_REJECTS_ALPHANUMERIC_RANGE_START', () => {
    expect(() => qualificationIdsInReference('U01X-U002'))
      .toThrow('ARIA_TEST_TRACEABILITY_INVALID:MALFORMED_RANGE:U01X-U002');
  });

  it('TRACEABILITY_REJECTS_CHAINED_UNICODE_RANGE', () => {
    expect(() => qualificationIdsInReference('U001–U003–U002'))
      .toThrow('ARIA_TEST_TRACEABILITY_INVALID:MALFORMED_RANGE:U001-U003–U002');
  });

  it('TRACEABILITY_REJECTS_OR_VALIDATES_EM_DASH_RANGE', () => {
    expect(qualificationIdsInReference('U001—U003')).toEqual(['U001', 'U002', 'U003']);
    expect(() => qualificationIdsInReference('U003—U001'))
      .toThrow('ARIA_TEST_TRACEABILITY_INVALID:RANGE_ORDER:U003:001');
    expect(() => qualificationIdsInReference('U001—A003'))
      .toThrow('ARIA_TEST_TRACEABILITY_INVALID:RANGE_PREFIX:U:A');
  });

  it('TRACEABILITY_REJECTS_OR_VALIDATES_NON_BREAKING_HYPHEN_RANGE', () => {
    expect(qualificationIdsInReference('U001‑U003')).toEqual(['U001', 'U002', 'U003']);
    expect(() => qualificationIdsInReference('U003‑U001'))
      .toThrow('ARIA_TEST_TRACEABILITY_INVALID:RANGE_ORDER:U003:001');
    expect(() => qualificationIdsInReference('U001‑A003'))
      .toThrow('ARIA_TEST_TRACEABILITY_INVALID:RANGE_PREFIX:U:A');
  });

  it('TRACEABILITY_PRESERVES_UNKNOWN_TITLE_ID_AFTER_DASH_SEPARATOR', () => {
    expect(extractQualificationCasesFromJest('unit', {
      testResults: [{
        assertionResults: [{ fullName: 'test-U999 qualification', status: 'passed' }],
      }],
    })).toEqual([
      expect.objectContaining({ id: 'U999', lane: 'unit', status: 'PASSED' }),
    ]);
  });

  it('normalizes Jest assertions into one aggregate result per qualification ID', () => {
    const cases = extractQualificationCasesFromJest('unit', {
      testResults: [{
        name: '/repo/__tests__/unit.test.ts',
        assertionResults: [
          { fullName: 'H001 first assertion U001 ARIA-B-R001', status: 'passed' },
          { fullName: 'H001 second assertion', status: 'passed' },
          { fullName: 'U001 second assertion', status: 'failed' },
          { fullName: 'P001 passes its deterministic rubric', status: 'passed' },
          { fullName: 'E001 describes browser coverage but is not browser evidence', status: 'passed' },
        ],
      }],
    });
    expect(cases).toEqual([
      expect.objectContaining({ id: 'ARIA-B-R001', lane: 'unit', status: 'PASSED' }),
      expect.objectContaining({ id: 'P001', lane: 'unit', status: 'PASSED' }),
      expect.objectContaining({ id: 'U001', lane: 'unit', status: 'FAILED' }),
    ]);
  });

  it('normalizes nested Playwright JSON results and requires every project execution to pass', () => {
    expect(extractQualificationCasesFromPlaywright({
      suites: [{
        title: 'conversation',
        file: 'e2e/aria/conversation.spec.ts',
        specs: [{
          title: 'E001 Terminale Maths login to grounded completion',
          tests: [{ results: [{ status: 'passed' }] }],
        }],
        suites: [{
          title: 'nested',
          specs: [{
            title: 'E002 Première Maths fails closed',
            tests: [{ results: [{ status: 'failed' }] }],
          }],
        }],
      }],
    })).toEqual([
      expect.objectContaining({ id: 'E001', lane: 'e2e', status: 'PASSED' }),
      expect.objectContaining({ id: 'E002', lane: 'e2e', status: 'FAILED' }),
    ]);
  });

  it('normalizes production smoke results into the separate smoke lane', () => {
    expect(extractQualificationCasesFromPlaywright({
      suites: [{
        title: 'production smoke',
        file: 'e2e/aria/production-smoke.spec.ts',
        specs: [{
          title: 'S001 standalone chat transport',
          tests: [{ results: [{ status: 'passed' }] }],
        }],
      }],
    }, 'smoke')).toEqual([
      expect.objectContaining({ id: 'S001', lane: 'smoke', status: 'PASSED' }),
    ]);
  });

  it('requires a production-standalone smoke project with S001 through S010 exactly once', () => {
    const root = process.cwd();
    const config = readFileSync(resolve(root, 'playwright.aria.config.ts'), 'utf8');
    const smoke = readFileSync(resolve(root, 'e2e/aria/production-smoke.spec.ts'), 'utf8');
    expect(config).toContain("name: 'aria-smoke'");
    expect(config).toContain('/production-smoke\\.spec\\.ts/');
    for (let index = 1; index <= 10; index += 1) {
      const id = `S${String(index).padStart(3, '0')}`;
      expect(smoke.match(new RegExp(`\\b${id}\\b`, 'g'))).toHaveLength(1);
    }
  });

  it('fails closed on a stale HEAD, absent, duplicate, failed or unknown evidence case', () => {
    const headSha = 'a'.repeat(40);
    const validCases = expectedAriaQualificationIds().map((id) => ({
      id,
      lane: id.startsWith('A') ? 'api' as const
        : id.startsWith('I') ? 'integration' as const
          : id.startsWith('D') ? 'database' as const
            : id.startsWith('H') ? 'architecture' as const
              : id.startsWith('E') ? 'e2e' as const
                : id.startsWith('S') ? 'smoke' as const
                  : 'unit' as const,
      status: 'PASSED' as const,
      title: `${id} qualification`,
      path: 'fixture.test.ts',
    }));
    const valid = { schemaVersion: 1 as const, headSha, cases: validCases };
    expect(validateAriaQualificationEvidence(valid, headSha)).toMatchObject({
      headSha,
      passed: 294,
      missing: [],
      duplicate: [],
      failed: [],
      unknown: [],
    });
    expect(() => validateAriaQualificationEvidence(valid, 'b'.repeat(40)))
      .toThrow('ARIA_TEST_TRACEABILITY_INVALID:STALE_HEAD');
    expect(() => validateAriaQualificationEvidence({
      ...valid,
      cases: validCases.slice(1),
    }, headSha)).toThrow('ARIA_TEST_TRACEABILITY_INVALID:MISSING:U001');
    expect(() => validateAriaQualificationEvidence({
      ...valid,
      cases: [...validCases, validCases[0]],
    }, headSha)).toThrow('ARIA_TEST_TRACEABILITY_INVALID:DUPLICATE:U001');
    expect(() => validateAriaQualificationEvidence({
      ...valid,
      cases: validCases.map((item) => item.id === 'I024' ? { ...item, status: 'FAILED' as const } : item),
    }, headSha)).toThrow('ARIA_TEST_TRACEABILITY_INVALID:FAILED:I024');
    expect(() => validateAriaQualificationEvidence({
      ...valid,
      cases: [...validCases, { ...validCases[0], id: 'U999' }],
    }, headSha)).toThrow('ARIA_TEST_TRACEABILITY_INVALID:UNKNOWN:U999');
    expect(() => validateAriaQualificationEvidence({
      ...valid,
      cases: validCases.map((item) => item.id === 'D001' ? { ...item, lane: 'unit' as const } : item),
    }, headSha)).toThrow('ARIA_TEST_TRACEABILITY_INVALID:LANE:D001');
  });

  it('TRACEABILITY_REJECTS_UNSUPPORTED_SCHEMA_VERSION', () => {
    expect(() => validateAriaQualificationEvidence({
      schemaVersion: 2,
      headSha: 'a'.repeat(40),
      cases: [],
    } as never, 'a'.repeat(40))).toThrow('ARIA_TEST_TRACEABILITY_INVALID:SCHEMA_VERSION');
  });
});
