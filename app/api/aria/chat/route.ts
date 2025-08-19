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
    // Rate limit (IP + route)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { rateLimit } = await import('@/lib/rate-limit');
    const check = rateLimit({ windowMs: 60_000, max: 30 })(`aria_chat:${ip}`);
    if (!check.ok) {
      return NextResponse.json({ error: 'Trop de requêtes, réessayez plus tard.' }, { status: 429 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.studentId || !session.user.parentId) {
      return NextResponse.json({ error: "Non authentifié ou profil élève incomplet." }, { status: 401 });
    }

    const body = await req.json();
    const parsedBody = chatRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json({ error: "Requête invalide", details: parsedBody.error.flatten() }, { status: 400 });
    }

    const { message, subject } = parsedBody.data;
    const { studentId, parentId } = session.user;

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

    // Instancier l'orchestrateur avec la logique moderne
    const orchestrator = new AriaOrchestrator(studentId, parentId);

    // Gérer la requête de bout en bout
    const { response, documentUrl } = await orchestrator.handleQuery(message, subject);

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
