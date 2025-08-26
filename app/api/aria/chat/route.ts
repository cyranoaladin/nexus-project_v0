// app/api/aria/chat/route.ts
import { AriaOrchestrator } from '@/lib/aria/orchestrator';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Subject as PrismaSubject } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { AriaChatRequestSchema } from '@/shared/schemas/aria';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Validation centralisée via shared schemas

export async function POST(req: NextRequest) {
  try {
    // Rate limit (IP + route)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { rateLimit } = await import('@/lib/rate-limit');
    const { getRateLimitConfig } = await import('@/lib/rate-limit.config');
    const rlConf = getRateLimitConfig('ARIA_CHAT', { windowMs: 60_000, max: 30 });
    const check = await rateLimit(rlConf)(`aria_chat:${ip}`);
    if (!check.ok) {
      return NextResponse.json({ error: 'Trop de requêtes, réessayez plus tard.' }, { status: 429 });
    }

    const session = await getServerSession(authOptions);
    let effectiveStudentId: string | null = (session as any)?.user?.studentId ?? null;
    let effectiveParentId: string | null = (session as any)?.user?.parentId ?? null;
    const isTestEnv = process.env.NODE_ENV === 'test';
    const allowBypass = !isTestEnv && (process.env.E2E === '1' || process.env.E2E_RUN === '1' || process.env.NEXT_PUBLIC_E2E === '1' || process.env.NODE_ENV === 'development');

    if (!effectiveStudentId || !effectiveParentId) {
      // Bypass en E2E/dev: utiliser un élève et un parent existants
      if (allowBypass) {
        const anyStudent = await prisma.student.findFirst({ orderBy: { createdAt: 'asc' } });
        const anyParent = anyStudent?.parentId
          ? await prisma.parentProfile.findUnique({ where: { id: anyStudent.parentId } })
          : await prisma.parentProfile.findFirst({ orderBy: { id: 'asc' } });
        effectiveStudentId = anyStudent?.id ?? null;
        effectiveParentId = (anyStudent?.parentId ?? anyParent?.id) ?? null;
      }
    }
    if (!effectiveStudentId || !effectiveParentId) {
      return NextResponse.json({ error: "Non authentifié ou profil élève incomplet." }, { status: 401 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Requête invalide: JSON manquant ou corrompu." }, { status: 400 });
    }
    const parsedBody = AriaChatRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json({ error: "Requête invalide", details: parsedBody.error.flatten() }, { status: 400 });
    }

    const { message, subject, attachments } = parsedBody.data;
    const studentId = effectiveStudentId;
    const parentId = effectiveParentId;

    if (!allowBypass) {
      // Freemium limit: max 5 requests per day per student
      const today = new Date().toISOString().split('T')[0];
      const student = await prisma.student.findUnique({ where: { id: studentId } });
      const usage = (student as any)?.freemiumUsage as { requestsToday?: number; date?: string } | null;

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
      let nextUsage: { requestsToday: number; date: string };
      if (!usage || usage.date !== today) {
        nextUsage = { requestsToday: 1, date: today };
      } else {
        nextUsage = { requestsToday: (usage.requestsToday ?? 0) + 1, date: today };
      }
      await prisma.student.update({ where: { id: studentId }, data: { freemiumUsage: nextUsage as any } });
    }

    // Instancier l'orchestrateur avec la logique moderne
    const orchestrator = new AriaOrchestrator(studentId, parentId);

    // Gérer la requête de bout en bout
    const { response, documentUrl } = await orchestrator.handleQuery(message, subject as unknown as PrismaSubject, attachments || []);

    // Retourner la réponse et l'éventuel URL du document
    return NextResponse.json({
      response,
      documentUrl,
    });

  } catch (error: any) {
    console.error("[API_ARIA_CHAT_ERROR]", error);
    return NextResponse.json({ error: "Une erreur est survenue lors de la communication avec ARIA." }, { status: 500 });
  }
}
