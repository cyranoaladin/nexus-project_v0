import { createPseudonymizedFactSheet } from '@/lib/bilans/local-first/contracts';
import { BilanLlmGateway } from '@/lib/bilans/llm/gateway';
import { buildValidatedPack } from '@/lib/bilans/validators/contracts';

const pack = buildValidatedPack({
  slug: 'maths-terminale-v1', version: 1, status: 'VALIDATED',
  review: { validatedBy: 'ENSEIGNANT_MATHS', validatedAt: '2026-08-01T09:00:00.000Z' },
  scoring: { domains: ['analyse'] },
  reporting: { promptFiles: {
    preAnalysis: { path: 'pre.md', checksum: 'a'.repeat(64) }, eleve: { path: 'eleve.md', checksum: 'b'.repeat(64) },
    parents: { path: 'parents.md', checksum: 'c'.repeat(64) }, nexus: { path: 'nexus.md', checksum: 'd'.repeat(64) },
    verifier: { path: 'verifier.md', checksum: 'e'.repeat(64) },
  } },
  validation: { lexiconPath: 'data/bilans/lexique-interdit.json', forbidDigits: ['eleve', 'parents'] },
});

const factSheet = createPseudonymizedFactSheet({
  engineVersion: '1.0.1', bankSlug: pack.slug, bankVersion: pack.version,
  student: { alias: 'ELEVE_A', level: 'TERMINALE' }, globalScore: 42, coverage: 100,
  calibrationIndex: 80, domains: [{ id: 'analyse', score: 42, profile: 'MAITRISE' }],
  nodes: [], flags: [], groupBand: 'RENFORCEMENT',
});

const validBundle = {
  preAnalysis: { synthese: 'Synthèse.', forcesPercues: [], craintes: [] },
  eleve: {
    accroche: 'Un travail structuré.', forces: ['Analyse : un acquis.', 'Une méthode utile.', 'Une implication régulière.'],
    priorites: [{ domainId: 'analyse', titre: 'Analyse', pourquoi: 'Consolider.', comment: 'Reprendre les démarches.' }],
    microPlan: [{ action: 'Revoir les démarches.', dureeMin: 20 }], motDeFin: 'La progression sera accompagnée.',
  },
  parents: {
    cadre: 'La passation est cohérente.', pointsAppui: [{ domainId: 'analyse', texte: 'Analyse : un acquis.' }],
    priorites: [{ domainId: 'analyse', titre: 'Analyse', ceQuiSeraFait: 'Les démarches seront consolidées.' }],
    etapeSuivante: { texte: 'Un échange précisera le parcours.', cta: 'Être conseillé' },
  },
  nexus: { syntheseProfil: 'Interne.', diagnosticPedagogique: 'Interne.', planQuatreSemaines: 'Interne.', alertes: [], ragReferences: [] },
  verifier: { ok: true, violations: [] },
};

describe('constrained bilan LLM gateway', () => {
  it('returns a pending review bundle after deterministic validation', async () => {
    const transport = { generate: jest.fn().mockResolvedValue(validBundle) };
    const gateway = new BilanLlmGateway(transport);

    await expect(gateway.run(factSheet, pack)).resolves.toMatchObject({
      status: 'REPORT_PENDING_REVIEW', attempts: 1, validationFailures: [], bundle: validBundle,
    });
    expect(transport.generate).toHaveBeenCalledTimes(1);
    expect(transport.generate.mock.calls[0][0]).not.toHaveProperty('messages');
  });

  it('retries exactly once, then keeps failures pending review', async () => {
    const invalid = { ...validBundle, parents: { ...validBundle.parents, cadre: 'Score 12.' } };
    const transport = { generate: jest.fn().mockResolvedValue(invalid) };
    const gateway = new BilanLlmGateway(transport);

    const result = await gateway.run(factSheet, pack);

    expect(transport.generate).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('REPORT_PENDING_REVIEW');
    expect(result.validationFailures).not.toEqual([]);
    expect(result.bundle).toBeNull();
  });

  it('rejects a FactSheet whose PII binding was tampered with before transport', async () => {
    const transport = { generate: jest.fn() };
    const gateway = new BilanLlmGateway(transport);
    const tampered = { ...factSheet, value: { ...factSheet.value, globalScore: 99 } };

    await expect(gateway.run(tampered, pack)).rejects.toThrow(/PII|checksum/i);
    expect(transport.generate).not.toHaveBeenCalled();
  });
});
