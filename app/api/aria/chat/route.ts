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
  const startedAt = Date.now();
  const reqId = Math.random().toString(36).slice(2);
  try {
    // Rate limit (IP + route)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    console.info('[ARIA_CHAT_START]', { reqId, ip, ts: new Date(startedAt).toISOString() });
    const { rateLimit } = await import('@/lib/rate-limit');
    const { getRateLimitConfig } = await import('@/lib/rate-limit.config');
    const rlConf = getRateLimitConfig('ARIA_CHAT', { windowMs: 60_000, max: 30 });
    const check = await rateLimit(rlConf)(`aria_chat:${ip}`);
    if (!check.ok) {
      const duration = Date.now() - startedAt;
      console.warn('[ARIA_CHAT_RATE_LIMIT]', { reqId, durationMs: duration });
      return NextResponse.json(
        { error: 'Trop de requêtes, réessayez plus tard.' },
        { status: 429 }
      );
    }

    const session = await getServerSession(authOptions);
    let effectiveStudentId: string | null = (session as any)?.user?.studentId ?? null;
    let effectiveParentId: string | null = (session as any)?.user?.parentId ?? null;
    const isTestEnv = process.env.NODE_ENV === 'test';
    const allowBypass =
      !isTestEnv &&
      (process.env.E2E === '1' ||
        process.env.E2E_RUN === '1' ||
        process.env.NEXT_PUBLIC_E2E === '1' ||
        process.env.NODE_ENV === 'development');

    if (!effectiveStudentId || !effectiveParentId) {
      // Bypass en E2E/dev: utiliser un élève et un parent existants
      if (allowBypass) {
        const anyStudent = await prisma.student.findFirst({ orderBy: { createdAt: 'asc' } });
        const anyParent = anyStudent?.parentId
          ? await prisma.parentProfile.findUnique({ where: { id: anyStudent.parentId } })
          : await prisma.parentProfile.findFirst({ orderBy: { id: 'asc' } });
        effectiveStudentId = anyStudent?.id ?? null;
        effectiveParentId = anyStudent?.parentId ?? anyParent?.id ?? null;
      }
    }
    if (!effectiveStudentId || !effectiveParentId) {
      return NextResponse.json(
        { error: 'Non authentifié ou profil élève incomplet.' },
        { status: 401 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Requête invalide: JSON manquant ou corrompu.' },
        { status: 400 }
      );
    }
    const parsedBody = AriaChatRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Requête invalide', details: parsedBody.error.flatten() },
        { status: 400 }
      );
    }

    const { message, subject, attachments, forcePdf, docTitle, docDescription } =
      parsedBody.data as any;
    const studentId = effectiveStudentId;
    const parentId = effectiveParentId;

    // Forcer intention PDF si demandé explicitement côté UI
    let finalMessage = String(message || '');
    if (forcePdf && !/(\bpdf\b|\bfiche\b|\bdocument\b)/i.test(finalMessage)) {
      finalMessage = `PDF: ${finalMessage}`;
    }

    if (!allowBypass) {
      // Freemium limit: max 5 requests per day per student
      const today = new Date().toISOString().split('T')[0];
      const student = await prisma.student.findUnique({ where: { id: studentId } });
      const usage = (student as any)?.freemiumUsage as {
        requestsToday?: number;
        date?: string;
      } | null;

      if (usage && usage.date === today && (usage.requestsToday ?? 0) >= 5) {
        return NextResponse.json(
          {
            error: 'Limite de requêtes freemium atteinte. Réessayez demain.',
            cta: {
              label: 'Souscrire à ARIA+',
              url: '/dashboard/parent/abonnements',
            },
          },
          { status: 429 }
        );
      }

      // Update usage: reset if new day, else increment
      let nextUsage: { requestsToday: number; date: string };
      if (!usage || usage.date !== today) {
        nextUsage = { requestsToday: 1, date: today };
      } else {
        nextUsage = { requestsToday: (usage.requestsToday ?? 0) + 1, date: today };
      }
      await prisma.student.update({
        where: { id: studentId },
        data: { freemiumUsage: nextUsage as any },
      });
    }

    // Instancier l'orchestrateur avec la logique moderne
    const orchestrator = new AriaOrchestrator(studentId, parentId);

    // Gérer la requête de bout en bout
    const { response, documentUrl, wasFakeLocal } = await orchestrator.handleQuery(
      finalMessage,
      subject as unknown as PrismaSubject,
      attachments || []
    );

    const durationOk = Date.now() - startedAt;
    console.info('[ARIA_CHAT_OK]', { reqId, durationMs: durationOk, hasDoc: !!documentUrl });

    // Enregistrer le document généré si disponible
    if (documentUrl) {
      try {
        const title =
          (docTitle && String(docTitle).trim()) ||
          (finalMessage || '').slice(0, 80) ||
          `Document ARIA – ${String(subject)}`;
        const description = (docDescription && String(docDescription).trim()) || null;
        await prisma.generatedDocument.create({
          data: {
            studentId,
            title,
            description,
            url: documentUrl,
            subject: subject as any,
          },
        });
      } catch (e) {
        console.warn('[ARIA_DOC_SAVE_WARN]', e);
      }
    }

    // Retourner la réponse et l'éventuel URL du document
    return NextResponse.json({
      response,
      documentUrl,
      fakeLocal: !!wasFakeLocal,
    });
  } catch (error: any) {
    const durationErr = Date.now() - startedAt;
    console.error('[API_ARIA_CHAT_ERROR]', { reqId, durationMs: durationErr, error: String(error?.message || error) });
    const msg = String(error?.message || '').toUpperCase();
    const code = String((error as any)?.code || '').toUpperCase();

    // Distinguer les timeouts LLM vs PDF pour un feedback précis côté UI
    if (msg.includes('PDF_REQUEST_TIMEOUT')) {
      return NextResponse.json(
        { error: 'Timeout PDF: délai dépassé.' },
        { status: 504 }
      );
    }
    if (code === 'ETIMEDOUT' || msg.includes('LLM_REQUEST_TIMEOUT') || msg.includes('GENERIC_REQUEST_TIMEOUT') || msg.includes('ABORT')) {
      return NextResponse.json(
        { error: 'Timeout LLM: délai dépassé.' },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: 'Une erreur est survenue lors de la communication avec ARIA.' },
      { status: 500 }
    );
  }
}
