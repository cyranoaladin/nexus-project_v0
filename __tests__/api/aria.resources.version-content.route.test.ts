import { auth } from '@/auth';
import { GET } from '@/app/api/aria/resources/[resourceId]/versions/[resourceVersionId]/content/route';
import { openAriaResourceContentForActor } from '@/lib/aria/application/resources/public';
import { AriaError } from '@/lib/aria/errors';
import { NextRequest } from 'next/server';
import { Readable } from 'node:stream';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/application/resources/public', () => ({
  openAriaResourceContentForActor: jest.fn(),
}));

const resourceId = '202269df-9b59-5c61-aa20-1f13a7558910';
const resourceVersionId = 'f69965ee-0e3a-51d9-ab4d-55f58a003beb';
const request = () => new NextRequest(
  `http://localhost:3000/api/aria/resources/${resourceId}/versions/${resourceVersionId}/content`,
);
const routeContext = {
  params: Promise.resolve({ resourceId, resourceVersionId }),
};

describe('GET versioned ARIA resource content', () => {
  beforeEach(() => jest.clearAllMocks());

  it('passes actor plus exact Resource and ResourceVersion identities', async () => {
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
      resourceId,
      resourceVersionId,
    });
  });

  it('A009 ARIA-B-R040 fails closed when the exact version is retired or unauthorized', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'student-user-1', role: 'ELEVE' } });
    (openAriaResourceContentForActor as jest.Mock).mockRejectedValue(
      new AriaError('RESOURCE_MISMATCH', 404, 'Ressource ARIA introuvable.'),
    );

    const response = await GET(request(), routeContext);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: 'BAD_REQUEST' },
    });
  });

  it('does not convert authentication infrastructure failure into anonymous access', async () => {
    (auth as jest.Mock).mockRejectedValue(new Error('auth infrastructure unavailable'));

    const response = await GET(request(), routeContext);

    expect(response.status).toBe(500);
    expect(openAriaResourceContentForActor).not.toHaveBeenCalled();
  });
});
