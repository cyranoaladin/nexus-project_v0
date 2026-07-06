import {
  buildContactLeadRetentionPlan,
  hashContactLeadErasureEmail,
  runContactLeadRetention,
} from '@/scripts/maintenance/contact-leads-retention';

describe('ContactLead retention maintenance script', () => {
  const now = new Date('2026-07-03T12:00:00.000Z');

  it('plans anonymization for stale non-converted leads without exposing raw PII', () => {
    const stale = {
      id: 'lead-old',
      email: 'parent@example.test',
      status: 'NEW',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    };
    const active = {
      id: 'lead-active',
      email: 'active@example.test',
      status: 'QUALIFIED',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    };

    const plan = buildContactLeadRetentionPlan({
      leads: [stale, active],
      now,
      erasureEmailHashes: [],
    });

    expect(plan.toAnonymize).toEqual([
      expect.objectContaining({
        id: 'lead-old',
        reason: 'retention_expired',
      }),
    ]);
    expect(JSON.stringify(plan)).not.toContain('parent@example.test');
    expect(JSON.stringify(plan)).not.toContain('active@example.test');
  });

  it('supports parent erasure requests by hashed email and keeps dry-run as default', async () => {
    const prismaMock = {
      contactLead: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'lead-erasure',
            email: 'parent@example.test',
            status: 'CONTACTED',
            createdAt: new Date('2026-06-01T00:00:00.000Z'),
          },
        ]),
        update: jest.fn(),
      },
    };

    const result = await runContactLeadRetention({
      prismaClient: prismaMock as any,
      now,
      erasureEmailHashes: [hashContactLeadErasureEmail('parent@example.test')],
      apply: false,
    });

    expect(result.dryRun).toBe(true);
    expect(result.planned).toBe(1);
    expect(prismaMock.contactLead.update).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('parent@example.test');
  });

  it('requires explicit apply before anonymizing selected leads', async () => {
    const prismaMock = {
      contactLead: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'lead-old',
            email: 'parent@example.test',
            status: 'NEW',
            createdAt: new Date('2025-01-01T00:00:00.000Z'),
          },
        ]),
        update: jest.fn().mockResolvedValue({ id: 'lead-old' }),
      },
    };

    const result = await runContactLeadRetention({
      prismaClient: prismaMock as any,
      now,
      erasureEmailHashes: [],
      apply: true,
    });

    expect(result.dryRun).toBe(false);
    expect(result.applied).toBe(1);
    expect(prismaMock.contactLead.update).toHaveBeenCalledWith({
      where: { id: 'lead-old' },
      data: expect.objectContaining({
        name: 'Lead anonymisé',
        email: expect.stringMatching(/^erased-lead-old@deleted\.nexus\.local$/),
        phone: null,
        notes: null,
        status: 'LOST',
      }),
    });
  });
});
