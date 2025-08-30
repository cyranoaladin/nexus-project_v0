import { AriaOrchestrator } from '@/lib/aria/orchestrator';
import { llm_service, pdf_generator_service } from '@/lib/aria/services';
import { prisma } from '@/lib/prisma';

describe('AriaOrchestrator LaTeX sanitization and RAG catch branches', () => {
  const OLD = { PDF_REMOTE_DISABLED: process.env.PDF_REMOTE_DISABLED } as any;
  beforeAll(() => { process.env.PDF_REMOTE_DISABLED = '0'; });
  afterAll(() => { process.env.PDF_REMOTE_DISABLED = OLD.PDF_REMOTE_DISABLED; });
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma as any).student = {
      findUnique: jest.fn().mockResolvedValue({
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
  });

  it('removes \\write18 from latex before compile', async () => {
    (llm_service as any).generate_response = jest
      .fn()
      .mockResolvedValue({ response: 'ok', contenu_latex: 'préambule \\write18 input' });
    const gen = ((pdf_generator_service as any).generate_pdf = jest
      .fn()
      .mockResolvedValue({ url: 'http://safe.pdf' }));
    const orch = new AriaOrchestrator('s1', 'p1');
    await orch.handleQuery('pdf', 'MATHEMATIQUES' as any);
    const arg = gen.mock.calls[0][0].contenu;
    expect(arg).not.toMatch(/\\write18/);
  });

  it('fallback minimalFromText escapes special chars and newlines', async () => {
    (llm_service as any).generate_response = jest.fn().mockResolvedValue({
      response: 'Texte avec # et % et & et { }\nligne 2',
      contenu_latex: 'bad',
    });
    (pdf_generator_service as any).generate_pdf = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockResolvedValueOnce({ url: 'http://fallback.pdf' });
    const orch = new AriaOrchestrator('s1', 'p1');
    await orch.handleQuery('pdf', 'MATHEMATIQUES' as any);
    const arg2 = (pdf_generator_service as any).generate_pdf.mock.calls[1][0].contenu;
    expect(arg2).toMatch(/\\#/);
    expect(arg2).toMatch(/\\%/);
    expect(arg2).toMatch(/\\&/);
    expect(arg2).toMatch(/\\\{/);
    expect(arg2).toMatch(/\\\}/);
    expect(arg2).toMatch(/\\par /);
  });

  it('RAG ingestion catch branch when fetch rejects', async () => {
    (llm_service as any).generate_response = jest
      .fn()
      .mockResolvedValue({ response: '# H1\n' + 'word '.repeat(50) });
    const fetchSpy = jest.spyOn(global as any, 'fetch').mockRejectedValue(new Error('network'));
    const orch = new AriaOrchestrator('s1', 'p1');
    await orch.handleQuery('Question longue', 'MATHEMATIQUES' as any);
    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
