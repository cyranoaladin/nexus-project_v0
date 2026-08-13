import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  FamilyConsentError,
  readConsentStateFromShareToken,
  recordConsentFromShareToken,
} from '@/lib/bilans/family-landing/consent';
import {
  FamilyAccessError,
  attachParentEmailFromShareToken,
  readParentAccessState,
  resendParentActivationFromShareToken,
} from '@/lib/bilans/family-landing/access';
import { checkCsrf } from '@/lib/csrf';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';

export const dynamic = 'force-dynamic';

/**
 * Consentement parental depuis la page d'arrivée du lien signé.
 *
 * Le jeton signé est la preuve d'identité : il porte le parent destinataire
 * et l'élève du bilan. La transition d'état est exactement celle du
 * dashboard (même service, même traçabilité) — seule la provenance de
 * l'identité change. La porte RGPD n'est ni contournée ni affaiblie : un
 * jeton altéré, expiré ou révoqué ne peut RIEN consentir.
 */

const NO_STORE = {
  'cache-control': 'private, no-store, max-age=0',
  'x-robots-tag': 'noindex, nofollow, noarchive',
} as const;

function notFound(): NextResponse {
  return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
}

const consentSchema = z.object({
  consent: z.literal(true),
  parentEmail: z.string().trim().max(254).optional(),
  // Renvoi de l'e-mail d'activation SANS ressaisir l'adresse (jamais affichée
  // sur la page publique) : le parent dont le premier e-mail s'est égaré ne
  // reste pas en cul-de-sac.
  resendActivation: z.literal(true).optional(),
}).strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const limited = await guardSensitiveRateLimit(request, {
    scope: 'bilan-share-consult',
    dimensions: ['ip'],
  });
  if (limited) return limited;

  const { token } = await params;
  try {
    const [consent, access] = [
      await readConsentStateFromShareToken(token),
      await readParentAccessState(token),
    ];
    return NextResponse.json(
      {
        state: consent.state,
        parentHasEmail: access.parentHasEmail,
        parentActivated: access.parentActivated,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof FamilyConsentError) return notFound();
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const csrf = checkCsrf(request);
  if (csrf) return csrf;

  const limited = await guardSensitiveRateLimit(request, {
    scope: 'bilan-share-consent',
    dimensions: ['ip'],
  });
  if (limited) return limited;

  const { token } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400, headers: NO_STORE });
  }
  const parsed = consentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400, headers: NO_STORE });
  }

  try {
    // 1. Le consentement d'abord — il ne dépend jamais du sort de l'e-mail.
    const consent = await recordConsentFromShareToken(token);

    // 2. L'accès ensuite, seulement si une adresse est fournie. Un échec ici
    //    (adresse déjà prise, etc.) n'invalide pas le consentement acquis.
    let email: Readonly<{ status: 'QUEUED' | 'ALREADY_SET' | 'SKIPPED' } | { status: 'ERROR'; code: string }> =
      { status: 'SKIPPED' };
    const parentEmail = parsed.data.parentEmail;
    if (parentEmail !== undefined && parentEmail !== '') {
      try {
        const attached = await attachParentEmailFromShareToken(token, parentEmail);
        email = { status: attached.activationQueued ? 'QUEUED' : 'ALREADY_SET' };
        if (attached.activationQueued) kickEmailOutboxDrain();
      } catch (accessError) {
        if (accessError instanceof FamilyAccessError && accessError.code !== 'INVALID_LINK') {
          email = { status: 'ERROR', code: accessError.code };
        } else {
          throw accessError;
        }
      }
    } else if (parsed.data.resendActivation === true) {
      const resent = await resendParentActivationFromShareToken(token);
      email = { status: resent.activationQueued ? 'QUEUED' : 'ALREADY_SET' };
      if (resent.activationQueued) kickEmailOutboxDrain();
    }

    return NextResponse.json({ state: consent.state, email }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof FamilyConsentError || (error instanceof FamilyAccessError && error.code === 'INVALID_LINK')) {
      return notFound();
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_STORE });
  }
}
