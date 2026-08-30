import { auth } from '@/auth';
import { GET } from '@/app/api/aria/resources/[resourceId]/content/route';
import { openAriaResourceContentForActor } from '@/lib/aria/application/resources/public';
import { AriaError } from '@/lib/aria/errors';
import { NextRequest } from 'next/server';
import { Readable } from 'node:stream';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/application/resources/public', () => ({
  openAriaResourceContentForActor: jest.fn(),
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
    (openAriaResourceContentForActor as jest.Mock).mockRejectedValue(
      new AriaError('NOT_ENTITLED', 403, 'Aucun droit ARIA actif ne couvre cette ressource.')
    );

    const response = await GET(request(), routeContext);
    expect(response.status).toBe(403);
    expect(openAriaResourceContentForActor).toHaveBeenCalledTimes(1);
  });

  it('passes only actor identity and resource identity to the application facade', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'student-user-1', role: 'ELEVE' } });
    const close = jest.fn().mockResolvedValue(undefined);
    (openAriaResourceContentForActor as jest.Mock).mockResolvedValue({
      filename: 'official.pdf',
      contentType: 'application/pdf',
      sizeBytes: 8,
      createReadStream: () => Readable.from([Buffer.from('official')]),
      close,
    });

    const response = await GET(request(), routeContext);
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('official');
    expect(close).toHaveBeenCalledTimes(1);
    expect(openAriaResourceContentForActor).toHaveBeenCalledWith({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      resourceId: 'resource-1',
    });
  });

  it('does not convert an authentication failure into an anonymous fallback', async () => {
    (auth as jest.Mock).mockRejectedValue(new Error('auth infrastructure unavailable'));

    const response = await GET(request(), routeContext);
    expect(response.status).toBe(500);
    expect(openAriaResourceContentForActor).not.toHaveBeenCalled();
  });
});
