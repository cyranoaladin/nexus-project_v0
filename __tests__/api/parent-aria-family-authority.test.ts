jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/families/student-access-authority', () => ({ ...jest.requireActual('@/lib/families/student-access-authority'), resolveParentStudentAccess: jest.fn() }));
jest.mock('@/lib/aria/application/mastery/list-courses-for-parent', () => ({ listAriaCoursesForParentChild: jest.fn().mockResolvedValue([]) }));
jest.mock('@/lib/aria/application/mastery/list-course-mastery-for-parent', () => ({ listAriaCourseMasteryForParent: jest.fn().mockResolvedValue([]) }));
jest.mock('@/lib/aria/application/workshop/list-workshops-for-parent', () => ({ listAriaWorkshopsForParent: jest.fn().mockResolvedValue([]) }));
jest.mock('@/lib/aria/bilans/periodic/list-for-parent', () => ({ listAriaPeriodicBilansForParent: jest.fn().mockResolvedValue([]) }));
jest.mock('@/lib/aria/application/evidence/list-recent-activity-for-parent', () => ({ listAriaRecentActivityForParent: jest.fn().mockResolvedValue([]) }));
jest.mock('@/lib/aria/application/mastery/get-next-best-action-for-parent', () => ({ getAriaNextBestActionForParent: jest.fn().mockResolvedValue([]) }));
import { auth } from '@/auth';
import { resolveParentStudentAccess } from '@/lib/families/student-access-authority';
import { NextRequest } from 'next/server';
import { GET as get0 } from '@/app/api/parent/children/[studentId]/aria/courses/route';
import { listAriaCoursesForParentChild as service0 } from '@/lib/aria/application/mastery/list-courses-for-parent';
import { GET as get1 } from '@/app/api/parent/children/[studentId]/aria/mastery/route';
import { listAriaCourseMasteryForParent as service1 } from '@/lib/aria/application/mastery/list-course-mastery-for-parent';
import { GET as get2 } from '@/app/api/parent/children/[studentId]/aria/workshops/route';
import { listAriaWorkshopsForParent as service2 } from '@/lib/aria/application/workshop/list-workshops-for-parent';
import { GET as get3 } from '@/app/api/parent/children/[studentId]/aria/bilans/route';
import { listAriaPeriodicBilansForParent as service3 } from '@/lib/aria/bilans/periodic/list-for-parent';
import { GET as get4 } from '@/app/api/parent/children/[studentId]/aria/recent-activity/route';
import { listAriaRecentActivityForParent as service4 } from '@/lib/aria/application/evidence/list-recent-activity-for-parent';
import { GET as get5 } from '@/app/api/parent/children/[studentId]/aria/next-best-action/route';
import { getAriaNextBestActionForParent as service5 } from '@/lib/aria/application/mastery/get-next-best-action-for-parent';
const routes = [
  { name: 'courses', get: get0, service: service0 },
  { name: 'mastery', get: get1, service: service1 },
  { name: 'workshops', get: get2, service: service2 },
  { name: 'bilans', get: get3, service: service3 },
  { name: 'recent-activity', get: get4, service: service4 },
  { name: 'next-best-action', get: get5, service: service5 },
];
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(auth).mockResolvedValue({ expires: '2026-12-31T00:00:00.000Z', user: { id: 'synthetic-parent', email: 'synthetic-parent@example.test', role: 'PARENT' } });
});
describe.each(routes)('$name family authority', ({ name, get, service }) => {
  it.each(['LEGACY_ALLOWED', 'CORE_VERIFIED_READ'] as const)('permits %s only after the family read decision', async status => {
    jest.mocked(resolveParentStudentAccess).mockResolvedValue({ id: 'synthetic-child', status });
    const response = await get(new NextRequest(`http://localhost/api/parent/children/synthetic-child/aria/${name}?courseKey=synthetic-course`), { params: Promise.resolve({ studentId: 'synthetic-child' }) });
    expect(response.status).toBe(200);
    expect(service).toHaveBeenCalledTimes(1);
    expect(jest.mocked(resolveParentStudentAccess).mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(service).mock.invocationCallOrder[0]);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it.each(['DENIED', 'AUTHORITY_UNAVAILABLE'] as const)('refuses %s before any ARIA data service', async status => {
    jest.mocked(resolveParentStudentAccess).mockResolvedValue({ id: 'synthetic-child', status });
    const response = await get(new NextRequest(`http://localhost/api/parent/children/synthetic-child/aria/${name}?courseKey=synthetic-course`), { params: Promise.resolve({ studentId: 'synthetic-child' }) });
    expect(response.status).toBe(status === 'DENIED' ? 403 : 503);
    expect(resolveParentStudentAccess).toHaveBeenCalledWith('synthetic-parent', 'synthetic-child', 'read');
    expect(service).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
});
