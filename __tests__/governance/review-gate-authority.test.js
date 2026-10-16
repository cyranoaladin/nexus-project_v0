let selectQualifiedAuthority;
beforeAll(async () => {
  ({ selectQualifiedAuthority } = await import('../../scripts/github/review-gate/qualification/authority.mjs'));
});

const candidate = { id: 'model', sha256: 'a'.repeat(64), contextTokens: 8192 };
const report = { candidateId: 'model', modelSha256: 'a'.repeat(64),
  qualified: true, thresholdsMet: true, reason: 'PASS', corpusReviewStatus: 'VETTED',
  sourceSha: 'b'.repeat(40), heldoutVerified: true, bundleSha256: 'e'.repeat(64) };

describe('model authority requires versioned independent evidence', () => {
  test('current unqualified manifest cannot create semantic merge authority', () => {
    expect(selectQualifiedAuthority({ manifest: { authorityStatus: 'UNQUALIFIED',
      selectedModel: null, candidates: [candidate] }, corpus: { reviewStatus: 'UNVETTED' },
    report: null })).toBeNull();
  });

  test('qualification is refused when corpus or report lacks independent proof', () => {
    const manifest = { authorityStatus: 'QUALIFIED', selectedModel: 'model',
      candidates: [candidate], qualificationEvidence: { sourceSha: 'b'.repeat(40),
        reportSha256: 'c'.repeat(64), bundleSha256: 'e'.repeat(64) } };
    expect(() => selectQualifiedAuthority({ manifest, corpus: { reviewStatus: 'UNVETTED' },
      report })).toThrow('MODEL_AUTHORITY_UNPROVEN');
    expect(() => selectQualifiedAuthority({ manifest, corpus: { reviewStatus: 'VETTED' },
      report: { ...report, qualified: false } })).toThrow('MODEL_AUTHORITY_UNPROVEN');
  });

  test('valid exact candidate and vetted evidence can select a model', () => {
    const manifest = { authorityStatus: 'QUALIFIED', selectedModel: 'model',
      candidates: [candidate], qualificationEvidence: { sourceSha: 'b'.repeat(40),
        reportSha256: 'c'.repeat(64), bundleSha256: 'e'.repeat(64) } };
    expect(selectQualifiedAuthority({ manifest, corpus: { reviewStatus: 'VETTED' }, report,
      actualReportSha256: 'c'.repeat(64), actualBundleSha256: 'e'.repeat(64) })).toEqual(candidate);
    expect(() => selectQualifiedAuthority({ manifest, corpus: { reviewStatus: 'VETTED' }, report,
      actualReportSha256: 'd'.repeat(64), actualBundleSha256: 'e'.repeat(64) })).toThrow('MODEL_AUTHORITY_UNPROVEN');
  });
});
