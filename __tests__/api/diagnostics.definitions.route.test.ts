/**
 * Diagnostics Definitions API — Complete Test Suite
 *
 * Tests: GET /api/diagnostics/definitions
 *
 * Source: app/api/diagnostics/definitions/route.ts
 */

jest.mock('@/lib/diagnostics/definitions', () => ({
  listDefinitions: jest.fn(),
  getDefinitionOrNull: jest.fn(),
}));

import { GET } from '@/app/api/diagnostics/definitions/route';
import { listDefinitions, getDefinitionOrNull } from '@/lib/diagnostics/definitions';

const mockListDefinitions = listDefinitions as jest.MockedFunction<typeof listDefinitions>;
const mockGetDefinitionOrNull = getDefinitionOrNull as jest.MockedFunction<typeof getDefinitionOrNull>;

beforeEach(() => {
  jest.clearAllMocks();
});

function makeRequest(params?: string): Request {
  const url = params
    ? `http://localhost:3000/api/diagnostics/definitions?${params}`
    : 'http://localhost:3000/api/diagnostics/definitions';
  return new Request(url, { method: 'GET' });
}

describe('GET /api/diagnostics/definitions — list all', () => {
  it('should return all definitions', async () => {
    mockListDefinitions.mockReturnValue([
      { key: 'maths-terminale-p2', label: 'Maths Terminale', track: 'eds_maths_tle', level: 'terminale', version: '1.0', stage: 'p2' },
      { key: 'nsi-terminale-p2', label: 'NSI Terminale', track: 'eds_nsi_tle', level: 'terminale', version: '1.0', stage: 'p2' },
    ] as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.definitions).toHaveLength(2);
    expect(body.definitions[0].key).toBe('maths-terminale-p2');
  });

  it('should deduplicate definitions by key', async () => {
    mockListDefinitions.mockReturnValue([
      { key: 'maths-terminale-p2', label: 'Maths Terminale' },
      { key: 'maths-terminale-p2', label: 'Maths Terminale (alias)' },
      { key: 'nsi-terminale-p2', label: 'NSI Terminale' },
    ] as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.definitions).toHaveLength(2);
  });
});

describe('GET /api/diagnostics/definitions?id=... — single definition', () => {
  it('should return definition domains for valid id', async () => {
    mockGetDefinitionOrNull.mockReturnValue({
      key: 'maths-terminale-p2',
      label: 'Maths Terminale Spé',
      track: 'eds_maths_tle',
      level: 'terminale',
      version: '1.0',
      stage: 'p2',
      skills: {
        analysis: [{ skillId: 'sk-1', label: 'Limites' }],
        algebra: [{ skillId: 'sk-2', label: 'Suites' }],
      },
      scoringPolicy: {
        domainWeights: { analysis: 0.28, algebra: 0.22 },
      },
      chapters: [
        { chapterId: 'ch-1', chapterLabel: 'Limites', description: 'Limites de fonctions', domainId: 'analysis', skills: ['sk-1'] },
      ],
      examFormat: { duration: 240 },
      riskModel: { factors: ['stress', 'time_management'] },
    } as any);

    const res = await GET(makeRequest('id=maths-terminale-p2'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.key).toBe('maths-terminale-p2');
    expect(body.domains).toHaveLength(2);
    expect(body.chapters).toHaveLength(1);
    expect(body.riskFactors).toContain('stress');
  });

  it('should return 404 for unknown definition', async () => {
    mockGetDefinitionOrNull.mockReturnValue(null);

    const res = await GET(makeRequest('id=unknown-def'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain('not found');
  });
});

describe('GET /api/diagnostics/definitions — error handling', () => {
  it('should return 500 on unexpected error', async () => {
    mockListDefinitions.mockImplementation(() => {
      throw new Error('Unexpected error');
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain('Internal');
  });
});
