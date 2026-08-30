import { auth } from '@/auth';
import { GET } from '@/app/api/aria/resources/[resourceId]/content/route';
import { authorizeAriaResourceForActor } from '@/lib/aria/application/resources/public';
import { AriaError } from '@/lib/aria/errors';
import { resolveResourceFilePath } from '@/lib/aria/resources';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/application/resources/public', () => ({
  authorizeAriaResourceForActor: jest.fn(),
}));
jest.mock('@/lib/aria/resources', () => ({
  resolveResourceFilePath: jest.fn(),
}));

function request() {
  return new NextRequest('http://localhost:3000/api/aria/resources/resource-1/content');
}

const routeContext = {
  params: Promise.resolve({ resourceId: 'resource-1' }),
};

describe('GET /api/aria/resources/[resourceId]/content', () => {
  beforeEach(() => jest.clearAllMocks());

  it('enforces canonical academic and commercial resource authorization', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'student-user-1', role: 'ELEVE' } });
    (authorizeAriaResourceForActor as jest.Mock).mockRejectedValue(
      new AriaError('NOT_ENTITLED', 403, 'Aucun droit ARIA actif ne couvre cette ressource.')
    );

    const response = await GET(request(), routeContext);
    expect(response.status).toBe(403);
    expect(resolveResourceFilePath).not.toHaveBeenCalled();
  });

  it('passes only actor identity and resource identity to the application facade', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'student-user-1', role: 'ELEVE' } });
    (authorizeAriaResourceForActor as jest.Mock).mockResolvedValue({
      resource: { id: 'resource-1', courseKey: 'eds-maths-terminale' },
    });
    (resolveResourceFilePath as jest.Mock).mockReturnValue(null);

    const response = await GET(request(), routeContext);
    expect(response.status).toBe(404);
    expect(authorizeAriaResourceForActor).toHaveBeenCalledWith({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      resourceId: 'resource-1',
    });
  });
});
