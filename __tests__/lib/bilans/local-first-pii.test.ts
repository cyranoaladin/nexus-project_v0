/** @jest-environment node */

import {
  PiiScanResultSchema,
  scanPiiFields,
  validatePiiScanResultChecksum,
} from '@/lib/bilans/local-first/pii';

describe('local-first PII contract', () => {
  it('returns CLEAN only for controlled fields without detections', () => {
    const scan = scanPiiFields([
      {
        path: '$.approvedEvidenceForLlm[0].text',
        text: 'La procédure algébrique est correctement appliquée.',
        source: 'CONTROLLED_TEMPLATE',
      },
    ]);

    expect(scan.sanitizedFields).toEqual({
      '$.approvedEvidenceForLlm[0].text':
        'La procédure algébrique est correctement appliquée.',
    });
    expect(scan.result).toMatchObject({
      status: 'CLEAN',
      detectorVersion: 'nexus-pii-detector-v1',
      detectedCategories: [],
      redactionCount: 0,
      requiresHumanReview: false,
      scannedFieldPaths: ['$.approvedEvidenceForLlm[0].text'],
      scannedContentChecksum: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(validatePiiScanResultChecksum(scan.result)).toBe(true);
    expect(() => PiiScanResultSchema.parse(scan.result)).not.toThrow();
  });

  it('redacts deterministic PII without retaining detected values', () => {
    const source = [
      'Contact: eleve.synthetic@example.invalid',
      '+216 99 12 34 56',
      '22 345 678',
      'né le 14/02/2012',
      'https://example.invalid/profil',
    ].join(' — ');
    const scan = scanPiiFields([
      {
        path: '$.rawEvidenceLocalOnly[0].text',
        text: source,
        source: 'CONTROLLED_TEMPLATE',
      },
    ]);
    const serialized = JSON.stringify(scan);

    expect(scan.result.status).toBe('REDACTED');
    expect(scan.result.detectedCategories).toEqual([
      'DATE_OF_BIRTH',
      'EMAIL',
      'PHONE_INTERNATIONAL',
      'PHONE_LOCAL_TUNISIA',
      'URL',
    ]);
    expect(scan.result.redactionCount).toBe(5);
    expect(scan.result.requiresHumanReview).toBe(false);
    expect(serialized).not.toContain('eleve.synthetic@example.invalid');
    expect(serialized).not.toContain('+216 99 12 34 56');
    expect(serialized).not.toContain('22 345 678');
    expect(serialized).not.toContain('14/02/2012');
    expect(serialized).not.toContain('https://example.invalid/profil');
    expect(validatePiiScanResultChecksum(scan.result)).toBe(true);
    const rescanned = scanPiiFields([{
      path: '$.rawEvidenceLocalOnly[0].text',
      text: scan.sanitizedFields['$.rawEvidenceLocalOnly[0].text'],
      source: 'CONTROLLED_TEMPLATE',
    }]);
    expect(rescanned.result.status).toBe('CLEAN');
    expect(rescanned.result.scannedContentChecksum)
      .toBe(scan.result.sanitizedContentChecksum);
  });

  it.each([
    ['Adresse : 12 avenue Habib Bourguiba', 'POSTAL_ADDRESS'],
    ['@eleve_fictif', 'SOCIAL_HANDLE'],
    ['matricule ELEVE-9821', 'STUDENT_IDENTIFIER'],
    ['lycée SYNTHETIQUE-42', 'SCHOOL_IDENTIFIER'],
    ['Nom : Camille Exemple', 'PERSON_NAME_CANDIDATE'],
  ] as const)(
    'blocks ambiguous identity field %s as %s without retaining its value',
    (text, category) => {
      const scan = scanPiiFields([
        {
          path: '$.rawEvidenceLocalOnly[0].text',
          text,
          source: 'CONTROLLED_TEMPLATE',
        },
      ]);

      expect(scan.result.status).toBe('BLOCKED');
      expect(scan.result.detectedCategories).toContain(category);
      expect(scan.result.requiresHumanReview).toBe(true);
      expect(JSON.stringify(scan)).not.toContain(text);
      expect(validatePiiScanResultChecksum(scan.result)).toBe(true);
    },
  );

  it('blocks unclassified free text even when no regex matches', () => {
    const text = 'Une formulation libre et ambiguë à examiner humainement.';
    const scan = scanPiiFields([
      {
        path: '$.rawEvidenceLocalOnly[0].text',
        text,
        source: 'UNCLASSIFIED_FREE_TEXT',
      },
    ]);

    expect(scan.result).toMatchObject({
      status: 'BLOCKED',
      detectedCategories: ['FREE_TEXT_UNCLASSIFIED'],
      redactionCount: 0,
      requiresHumanReview: true,
    });
    expect(scan.sanitizedFields).toEqual({});
    expect(JSON.stringify(scan)).not.toContain(text);
  });

  it('rejects NOT_SCANNED on a transport boundary and detects tampering', () => {
    expect(() => PiiScanResultSchema.parse({
      status: 'NOT_SCANNED',
      detectorVersion: 'nexus-pii-detector-v1',
      detectedCategories: [],
      redactionCount: 0,
      requiresHumanReview: true,
      scannedFieldPaths: [],
      scannedContentChecksum: '0'.repeat(64),
      sanitizedContentChecksum: '0'.repeat(64),
      checksum: '0'.repeat(64),
    })).not.toThrow();

    const scan = scanPiiFields([{
      path: '$.approvedEvidenceForLlm[0].text',
      text: 'Texte contrôlé.',
      source: 'CONTROLLED_TEMPLATE',
    }]);
    expect(validatePiiScanResultChecksum({
      ...scan.result,
      requiresHumanReview: true,
    })).toBe(false);
  });
});
