import { auth } from '@/auth';
import { GET } from '@/app/api/aria/resources/[resourceId]/versions/[resourceVersionId]/content/route';
import { openAriaResourceContentForActor } from '@/lib/aria/application/resources/public';
import { AriaError } from '@/lib/aria/errors';
import { NextRequest } from 'next/server';
import { PassThrough, Readable } from 'node:stream';

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

  it.each([
    ['missing user', null],
    ['wrong role', { user: { id: 'coach-user-1', role: 'COACH' } }],
  ])('rejects %s before opening private content', async (_case, session) => {
    (auth as jest.Mock).mockResolvedValue(session);

    const response = await GET(request(), routeContext);

    expect(response.status).toBe(401);
    expect(openAriaResourceContentForActor).not.toHaveBeenCalled();
  });

  it('surfaces descriptor close failure after the final content byte', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'student-user-1', role: 'ELEVE' } });
    const closeFailure = new Error('descriptor close failed');
    const close = jest.fn().mockRejectedValue(closeFailure);
    (openAriaResourceContentForActor as jest.Mock).mockResolvedValue({
      filename: 'official.pdf',
      contentType: 'application/pdf',
      sizeBytes: 8,
      createReadStream: () => Readable.from([Buffer.from('official')]),
      close,
    });

    const response = await GET(request(), routeContext);

    await expect(response.text()).rejects.toBe(closeFailure);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes the descriptor and preserves a stream failure', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'student-user-1', role: 'ELEVE' } });
    const streamFailure = new Error('stream failed');
    const close = jest.fn().mockResolvedValue(undefined);
    (openAriaResourceContentForActor as jest.Mock).mockResolvedValue({
      filename: 'official.pdf',
      contentType: 'application/pdf',
      sizeBytes: 8,
      createReadStream: () => new Readable({
        read() { this.destroy(streamFailure); },
      }),
      close,
    });

    const response = await GET(request(), routeContext);

    await expect(response.text()).rejects.toBe(streamFailure);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('retains both stream and descriptor failures', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'student-user-1', role: 'ELEVE' } });
    const streamFailure = new Error('stream failed');
    const closeFailure = new Error('descriptor close failed');
    const close = jest.fn().mockRejectedValue(closeFailure);
    (openAriaResourceContentForActor as jest.Mock).mockResolvedValue({
      filename: 'official.pdf',
      contentType: 'application/pdf',
      sizeBytes: 8,
      createReadStream: () => new Readable({
        read() { this.destroy(streamFailure); },
      }),
      close,
    });

    const response = await GET(request(), routeContext);

    await expect(response.text()).rejects.toEqual(expect.objectContaining({
      name: 'AggregateError',
      errors: [streamFailure, closeFailure],
    }));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('destroys the file stream and closes its descriptor when the client cancels', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'student-user-1', role: 'ELEVE' } });
    const fileStream = new PassThrough();
    const destroy = jest.spyOn(fileStream, 'destroy');
    const close = jest.fn().mockResolvedValue(undefined);
    (openAriaResourceContentForActor as jest.Mock).mockResolvedValue({
      filename: 'official.pdf',
      contentType: 'application/pdf',
      sizeBytes: 8,
      createReadStream: () => fileStream,
      close,
    });
    const response = await GET(request(), routeContext);
    const reader = response.body!.getReader();

    await reader.cancel();

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('A009 fails closed when the exact version is retired or unauthorized', async () => {
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
