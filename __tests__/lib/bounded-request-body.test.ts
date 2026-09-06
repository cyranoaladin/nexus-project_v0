import { readBoundedRequestBody, RequestBodyTooLargeError } from '@/lib/http/bounded-request-body';

test('counts UTF-8 bytes, not characters', async () => {
  await expect(readBoundedRequestBody(new Request('http://localhost', { method: 'POST', body: 'éé' }), 4)).resolves.toBe('éé');
  await expect(readBoundedRequestBody(new Request('http://localhost', { method: 'POST', body: 'éé' }), 3)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
});
test('refuses an oversized declared length before reading the body', async () => {
  const request = new Request('http://localhost', { method: 'POST', body: '{}', headers: { 'Content-Length': '100' } });
  const getReader = jest.spyOn(request.body!, 'getReader');
  await expect(readBoundedRequestBody(request, 8)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  expect(getReader).not.toHaveBeenCalled();
});

test('rejects malformed UTF-8 instead of persisting replacement characters', async () => {
  const request = new Request('http://localhost', { method: 'POST', body: new Uint8Array([0xc3, 0x28]) });
  await expect(readBoundedRequestBody(request)).rejects.toMatchObject({ name: 'TypeError' });
});
