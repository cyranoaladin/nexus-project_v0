import { ARIA_PERFORMANCE_BUDGETS } from '../domain/observability/performance-budgets';
import { AriaError } from '../errors';

function badRequest(reasonCode: string): AriaError {
  return new AriaError('BAD_REQUEST', 400, 'Requête ARIA invalide.', { reasonCode });
}

function payloadTooLarge(): AriaError {
  return new AriaError(
    'PAYLOAD_TOO_LARGE',
    413,
    'Le corps de la requête ARIA est trop volumineux.',
    { reasonCode: 'ARIA_MUTATION_BODY_TOO_LARGE' },
  );
}

export async function readBoundedAriaJson(
  request: Request,
  maxBytes = ARIA_PERFORMANCE_BUDGETS.mutationBytesMax,
): Promise<unknown> {
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) throw badRequest('INVALID_CONTENT_LENGTH');
    const declaredBytes = Number(contentLength);
    if (!Number.isSafeInteger(declaredBytes)) throw badRequest('INVALID_CONTENT_LENGTH');
    if (declaredBytes > maxBytes) throw payloadTooLarge();
  }

  if (!request.body) throw badRequest('EMPTY_JSON_BODY');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let observedBytes = 0;
  let text = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      observedBytes += value.byteLength;
      if (observedBytes > maxBytes) {
        try {
          await reader.cancel('ARIA_MUTATION_BODY_TOO_LARGE');
        } catch (error: unknown) {
          throw new AriaError(
            'INTERNAL_ERROR',
            500,
            'Le corps ARIA n’a pas pu être interrompu.',
            { reasonCode: 'ARIA_BODY_CANCEL_FAILED', cause: error },
          );
        }
        throw payloadTooLarge();
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error: unknown) {
    if (error instanceof AriaError) throw error;
    throw badRequest(error instanceof TypeError ? 'INVALID_UTF8_BODY' : 'BODY_READ_FAILED');
  } finally {
    reader.releaseLock();
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw badRequest('INVALID_JSON_BODY');
  }
}
