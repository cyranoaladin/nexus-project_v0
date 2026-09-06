import { readBoundedRequestBody, RequestBodyTooLargeError } from '@/lib/http/bounded-request-body';
import { auth } from '@/auth';
import { withParentPrivateNoStore } from '@/lib/bilans/api/parent-access';
import { checkCsrf } from '@/lib/csrf';
import { completeParentRegistration, loadParentRegistration, ParentRegistrationError } from '@/lib/families/parent-registration';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
const respond = (body: unknown, status = 200) => withParentPrivateNoStore(NextResponse.json(body, { status }));
async function parentId() {
  const session = await auth();
  return session?.user?.role === 'PARENT' ? session.user.id : null;
}
function failure(error: unknown) {
  if (error instanceof ParentRegistrationError) {
    const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'FAMILY_CHANGED' ? 409 : 400;
    return respond({ code: error.code, error: error.code === 'FAMILY_CHANGED' ? 'Le dossier a changé. Rechargez la liste de vos enfants.' : 'Impossible de confirmer ces informations.' }, status);
  }
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034') {
    return respond({ code: 'FAMILY_CHANGED', error: 'Le dossier a changé. Rechargez la liste de vos enfants.' }, 409);
  }
  return respond({ error: 'Le service est momentanément indisponible.' }, 500);
}
export async function GET() {
  try {
    const id = await parentId();
    if (!id) return respond({ error: 'Not found' }, 404);
    return respond(await loadParentRegistration(id));
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    const id = await parentId();
    if (!id) return respond({ error: 'Not found' }, 404);
    const csrf = checkCsrf(request);
    if (csrf) return withParentPrivateNoStore(csrf);
    const blocked = await guardSensitiveRateLimit(request, { scope: 'parent-registration', identity: id, dimensions: ['identity', 'ip'] });
    if (blocked) return withParentPrivateNoStore(blocked);
    let body: unknown;
    try { body = JSON.parse(await readBoundedRequestBody(request)); }
    catch (error) { return respond({ error: error instanceof RequestBodyTooLargeError ? 'Requête trop volumineuse.' : 'Données invalides.' }, error instanceof RequestBodyTooLargeError ? 413 : 400); }
    return respond(await completeParentRegistration(id, body));
  } catch (error) { return failure(error); }
}
