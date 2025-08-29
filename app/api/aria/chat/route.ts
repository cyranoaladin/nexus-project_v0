// app/api/aria/chat/route.ts
import { AriaOrchestrator } from '@/lib/aria/orchestrator';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Subject } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const chatRequestSchema = z.object({
  message: z.string().min(1, "Le message ne peut pas être vide."),
  subject: z.nativeEnum(Subject, {
    errorMap: () => ({ message: "La matière fournie est invalide." }),
  }),
});

export async function POST(req: NextRequest) {
  try {
    // Validation ENV au démarrage (mode, clés, etc.)
    try {
      const { validateAriaEnv, computeAriaMode } = await import('@/lib/aria/env-validate');
      validateAriaEnv();
      const mode = computeAriaMode();
      console.log(`[ARIA][Boot] mode=${mode}`);
    } catch (e) {
      console.error('[ARIA][ENV] Validation failed:', e);
      return NextResponse.json({ error: 'Configuration invalide: ' + String((e as any)?.message || e) }, { status: 500 });
    }
    // Rate limit (IP + route)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { rateLimit } = await import('@/lib/rate-limit');
    const check = rateLimit({ windowMs: 60_000, max: 30 })(`aria_chat:${ip}`);
    if (!check.ok) {
      return NextResponse.json({ error: 'Trop de requêtes, réessayez plus tard.' }, { status: 429 });
    }

    const auth = await (await import('@/lib/api/auth')).getAuthFromRequest(req as any);
    let studentId: string | undefined;
    let parentId: string | undefined;
    if (auth?.via === 'dev-token' && process.env.NODE_ENV !== 'production') {
      // Choisir un élève/parent par défaut en dev
      const first = await prisma.student.findFirst({ select: { id: true, parentId: true } });
      if (!first) return NextResponse.json({ error: 'Aucun élève en base' }, { status: 500 });
      studentId = first.id as any;
      parentId = first.parentId as any;
    } else {
      let session = await getServerSession(authOptions);
      // E2E bypass: désactivé en mode live (ARIA_LIVE=1)
      if ((!session?.user?.id || !session.user.studentId || !session.user.parentId)
        && (process.env.ARIA_LIVE !== '1')
        && (process.env.E2E === '1' || process.env.NEXT_PUBLIC_E2E === '1')) {
        const first = await prisma.student.findFirst({ select: { id: true, parentId: true } });
        if (!first) return NextResponse.json({ error: 'Aucun élève en base' }, { status: 500 });
        session = {
          user: { id: 'e2e-user', studentId: first.id, parentId: first.parentId },
        } as any;
      }
      if (!session?.user?.id || !session.user.studentId || !session.user.parentId) {
        return NextResponse.json({ error: "Non authentifié ou profil élève incomplet." }, { status: 401 });
      }
      studentId = session.user.studentId as any;
      parentId = session.user.parentId as any;
    }

    // Parsing JSON standard (compatible avec tests)
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Requête invalide: JSON mal formé.' }, { status: 400 });
    }

    const parsedBody = chatRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json({ error: "Requête invalide", details: parsedBody.error.flatten() }, { status: 400 });
    }

    const { message, subject } = parsedBody.data;

    // Freemium limit: max 5 requests per day per student
    const today = new Date().toISOString().split('T')[0];
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    const usage = (student as any)?.freemiumUsage as { requestsToday?: number; date?: string; } | null;

    if (usage && usage.date === today && (usage.requestsToday ?? 0) >= 5) {
      return NextResponse.json({
        error: 'Limite de requêtes freemium atteinte. Réessayez demain.',
        cta: {
          label: 'Souscrire à ARIA+',
          url: '/dashboard/parent/abonnements',
        },
      }, { status: 429 });
    }

    // Update usage: reset if new day, else increment
    let nextUsage: { requestsToday: number; date: string; };
    if (!usage || usage.date !== today) {
      nextUsage = { requestsToday: 1, date: today };
    } else {
      nextUsage = { requestsToday: (usage.requestsToday ?? 0) + 1, date: today };
    }
    await prisma.student.update({ where: { id: studentId }, data: { freemiumUsage: nextUsage as any } });

    // Instancier l'orchestrateur avec la logique moderne
    const orchestrator = new AriaOrchestrator(studentId!, parentId!);

    // Gérer la requête de bout en bout
    const { response, documentUrl } = await orchestrator.handleQuery(message, subject);

    // Retourner la réponse et l'éventuel URL du document
    return NextResponse.json({
      response,
      documentUrl,
    });

  } catch (error: any) {
    try {
      const { logger } = await import('@/lib/logger');
      logger.error({ err: String(error) }, 'API_ARIA_CHAT_ERROR');
    } catch {
      console.error('[API_ARIA_CHAT_ERROR]', error);
    }
    return NextResponse.json({ error: "Une erreur est survenue lors de la communication avec ARIA." }, { status: 500 });
  }
}
