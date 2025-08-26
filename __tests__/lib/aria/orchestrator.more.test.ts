import { AriaOrchestrator } from '@/lib/aria/orchestrator';
import { llm_service, pdf_generator_service } from '@/lib/aria/services';
import { prisma } from '@/lib/prisma';

describe('AriaOrchestrator branch coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates PDF when query requests it and LLM returns latex', async () => {
    (prisma as any).student = {
      findUnique: jest
        .fn()
        .mockResolvedValue({
          id: 's1',
          user: { firstName: 'A', lastName: 'B' },
          parent: { user: { firstName: 'P', lastName: 'Q' } },
        }),
    };
    (prisma as any).ariaMessage = {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
    };
    (prisma as any).ariaConversation = {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'c1' }),
    };
    (llm_service as any).generate_response = jest
      .fn()
      .mockResolvedValue({ response: 'ok', contenu_latex: 'latex' });
    (pdf_generator_service as any).generate_pdf = jest
      .fn()
      .mockResolvedValue({ url: 'http://doc.pdf' });

    const orch = new AriaOrchestrator('s1', 'p1');
    const res = await orch.handleQuery('Peux-tu faire un PDF ?', 'MATHEMATIQUES' as any);
    expect(res.documentUrl).toBe('http://doc.pdf');
  });

  it('PDF fallback kicks in when first compile fails and second succeeds', async () => {
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
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'c1' }),
    };
    (llm_service as any).generate_response = jest
      .fn()
      .mockResolvedValue({
        response: 'texte suffisant pour fallback'.repeat(20),
        contenu_latex: 'bad\\write18',
      });
    (pdf_generator_service as any).generate_pdf = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail compile 1'))
      .mockResolvedValueOnce({ url: 'http://fallback.pdf' });

    const orch = new AriaOrchestrator('s1', 'p1');
    const res = await orch.handleQuery('Fais un document PDF', 'MATHEMATIQUES' as any);
    expect(res.documentUrl).toBe('http://fallback.pdf');
  });

  it('uses existing LaTeX (with \\documentclass) without wrapping and compiles once', async () => {
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
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'c1' }),
    };
    const latex = '\\documentclass{article}\\begin{document}Hello\\end{document}';
    (llm_service as any).generate_response = jest
      .fn()
      .mockResolvedValue({ response: 'ok', contenu_latex: latex });
    const gen = ((pdf_generator_service as any).generate_pdf = jest
      .fn()
      .mockResolvedValue({ url: 'http://doc2.pdf' }));
    const orch = new AriaOrchestrator('s1', 'p1');
    const res = await orch.handleQuery('fais un PDF', 'MATHEMATIQUES' as any);
    expect(res.documentUrl).toBe('http://doc2.pdf');
    expect(gen).toHaveBeenCalledTimes(1);
  });

  it('decision_hints switches to REMEDIATION when multiple weaknesses', async () => {
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
    (prisma as any).mastery = {
      findMany: jest.fn().mockResolvedValue([
        { level: 'LOW', concept: 'Fractions' },
        { score: 0.4, concept: 'Équations' },
        { level: 'HIGH', concept: 'Géométrie' },
      ]),
    };
    const llmSpy = ((llm_service as any).generate_response = jest
      .fn()
      .mockResolvedValue({ response: 'ok' }));
    const orch = new AriaOrchestrator('s1', 'p1');
    await orch.handleQuery('expliquer', 'MATHEMATIQUES' as any);
    const ctx = llmSpy.mock.calls[0][0].contexte_eleve;
    expect(ctx.decision_hints.interventionMode).toBe('REMEDIATION_GUIDEE');
    expect(ctx.decision_hints.requireStepByStep).toBe(true);
  });

  it('decision_hints remains STANDARD when no critical gaps', async () => {
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
    (prisma as any).mastery = {
      findMany: jest.fn().mockResolvedValue([
        { level: 'MEDIUM', concept: 'Fractions' },
        { score: 0.8, concept: 'Équations' },
      ]),
    };
    const llmSpy = ((llm_service as any).generate_response = jest
      .fn()
      .mockResolvedValue({ response: 'ok' }));
    const orch = new AriaOrchestrator('s1', 'p1');
    await orch.handleQuery('expliquer', 'MATHEMATIQUES' as any);
    const ctx = llmSpy.mock.calls[0][0].contexte_eleve;
    expect(ctx.decision_hints.interventionMode).toBe('STANDARD');
    expect(ctx.decision_hints.requireStepByStep).toBe(false);
  });

  it('throws when profile missing', async () => {
    (prisma as any).student = { findUnique: jest.fn().mockResolvedValue(null) };
    (prisma as any).ariaMessage = {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn(),
    };
    (prisma as any).ariaConversation = { findFirst: jest.fn(), create: jest.fn() };

    const orch = new AriaOrchestrator('sX', 'pX');
    await expect(orch.handleQuery('hello', 'NSI' as any)).rejects.toThrow(
      /Impossible de charger le profil/
    );
  });

  it('does not call pdf service if query asks pdf but no latex provided by LLM', async () => {
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
    (llm_service as any).generate_response = jest
      .fn()
      .mockResolvedValue({ response: 'réponse textuelle seulement', contenu_latex: undefined });
    (pdf_generator_service as any).generate_pdf = jest.fn();

    const orch = new AriaOrchestrator('s1', 'p1');
    const res = await orch.handleQuery('Fais moi un PDF de révision', 'MATHEMATIQUES' as any);
    expect(res.response).toContain('réponse');
    expect((pdf_generator_service as any).generate_pdf).not.toHaveBeenCalled();
  });
});
