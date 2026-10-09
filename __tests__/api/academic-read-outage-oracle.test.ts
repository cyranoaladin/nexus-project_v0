jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/families/student-access-authority', () => ({
  resolveParentStudentAccess: jest.fn().mockResolvedValue({ id: 'synthetic-student', status: 'AUTHORITY_UNAVAILABLE' }),
  familyAuthorityAvailable: jest.fn().mockResolvedValue(false),
  familyReadAllowed: () => false,
}));

import { auth } from '@/auth';
import { NextRequest } from 'next/server';
import { GET as assessmentStatus } from '@/app/api/assessments/[id]/status/route';
import { GET as assessmentResult } from '@/app/api/assessments/[id]/result/route';
import { GET as assessmentExport } from '@/app/api/assessments/[id]/export/route';
import { GET as bilanRead } from '@/app/api/bilans/[id]/route';
import { GET as bilanExport } from '@/app/api/bilans/[id]/export/route';

type Handler = (request: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>;
let prisma: any;

beforeEach(async () => {
  prisma = ((await import('@/lib/prisma')) as any).prisma;
  jest.clearAllMocks();
  (auth as jest.Mock).mockResolvedValue({ user: { id: 'synthetic-parent', role: 'PARENT', email: 'parent@synthetic.test' } });
});

const routes: Array<[string, Handler, 'assessment' | 'bilan']> = [
  ['assessments/[id]/status', assessmentStatus, 'assessment'],
  ['assessments/[id]/result', assessmentResult, 'assessment'],
  ['assessments/[id]/export', assessmentExport, 'assessment'],
  ['bilans/[id]', bilanRead, 'bilan'],
  ['bilans/[id]/export', bilanExport, 'bilan'],
];

test.each(routes)('%s cannot reveal whether an ID exists while family authority is down', async (_route, handler, model) => {
  const call = () => handler(new NextRequest('http://localhost/api/synthetic/synthetic-id'), { params: Promise.resolve({ id: 'synthetic-id' }) });
  prisma[model].findUnique.mockResolvedValue({ studentId: 'synthetic-student' });
  const existing = await call();
  prisma[model].findUnique.mockResolvedValue(null);
  const missing = await call();
  expect(existing.status).toBe(503);
  expect(missing.status).toBe(existing.status);
  expect(await missing.json()).toEqual(await existing.json());
});
