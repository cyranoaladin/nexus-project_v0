import { AriaOrchestrator } from '@/lib/aria/orchestrator';
import { llm_service } from '@/lib/aria/services';
import { prisma } from '@/lib/prisma';

describe('AriaOrchestrator RAG ingestion branches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma as any).student = {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 's1', user: { firstName: 'A', lastName: 'B' } }),
    };
    (prisma as any).ariaMessage = {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
    };
    (prisma as any).ariaConversation = {
      findFirst: jest.fn().mockResolvedValue({ id: 'c1' }),
      create: jest.fn(),
    };
  });

  it('should call ingest when response meets structure/length (test env threshold)', async () => {
    const longText =
      '# Titre\n' +
      Array.from({ length: 60 })
        .map((_, i) => `mot${i}`)
        .join(' ');
    (llm_service as any).generate_response = jest.fn().mockResolvedValue({ response: longText });
    const fetchSpy = jest
      .spyOn(global as any, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => ({ ok: true }) } as any);
    const orch = new AriaOrchestrator('s1', 'p1');
    await orch.handleQuery('Explique...', 'MATHEMATIQUES' as any);
    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('should include decision_hints in LLM payload for RAG long response', async () => {
    (llm_service as any).generate_response = jest
      .fn()
      .mockResolvedValue({ response: '# H1\n' + 'mot '.repeat(40) });
    const orch = new AriaOrchestrator('s1', 'p1');
    await orch.handleQuery('Explique...', 'MATHEMATIQUES' as any);
    const ctx = (llm_service as any).generate_response.mock.calls[0][0].contexte_eleve;
    expect(ctx.decision_hints).toBeDefined();
    expect(typeof ctx.decision_hints.requireChecks).toBe('boolean');
  });

  it('should not call ingest when response is too short and unstructured', async () => {
    (llm_service as any).generate_response = jest.fn().mockResolvedValue({ response: 'court' });
    const fetchSpy = jest
      .spyOn(global as any, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => ({ ok: true }) } as any);
    const orch = new AriaOrchestrator('s1', 'p1');
    await orch.handleQuery('Explique...', 'MATHEMATIQUES' as any);
    const called = fetchSpy.mock.calls.some((c: any[]) => String(c[0]).includes('/ingest'));
    expect(called).toBe(false);
    fetchSpy.mockRestore();
  });
});
