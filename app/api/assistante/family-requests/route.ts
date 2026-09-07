export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { FamilyRequestStatus, FamilyRequestType } from '@prisma/client';

import { isErrorResponse, requireAnyRole } from '@/lib/guards';
import { createPaginationMeta, parseEnumParam, parsePagination } from '@/lib/api/pagination';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/assistante/family-requests
 *
 * Liste paginée des demandes famille (bilan gratuit public ou ajout
 * d'enfant côté parent) en attente de qualification/conversion.
 * Requires: ADMIN or ASSISTANTE.
 *
 * La création d'une FamilyRequest n'est jamais un geste staff direct -- elle
 * n'est qu'un effet de bord des routes publique/parent (Amendement 7). Cette
 * route n'expose donc volontairement aucun POST générique.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
    if (isErrorResponse(sessionOrError)) return sessionOrError;

    const { searchParams } = new URL(request.url);
    const statusRaw = searchParams.get('status');
    const typeRaw = searchParams.get('type');
    const status = parseEnumParam(statusRaw, FamilyRequestStatus);
    const type = parseEnumParam(typeRaw, FamilyRequestType);

    if (statusRaw && status === null) {
      return NextResponse.json({ error: `status invalide : ${statusRaw}` }, { status: 400 });
    }
    if (typeRaw && type === null) {
      return NextResponse.json({ error: `type invalide : ${typeRaw}` }, { status: 400 });
    }

    const { page, limit, skip } = parsePagination(searchParams);
    const where = {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.familyRequest.findMany({
        where,
        include: { children: true },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.familyRequest.count({ where }),
    ]);

    return NextResponse.json({ items, pagination: createPaginationMeta(page, limit, total) });
  } catch (error) {
    console.error('[family-requests] list failed', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
