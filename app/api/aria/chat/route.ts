// app/api/aria/chat/route.ts
import { AriaOrchestrator } from '@/lib/aria/orchestrator';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Subject } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Intent } from '@/lib/aria/policy';
import { getGenerationParams, getSystemPrefix } from '@/lib/aria/policy';
import { sanitizeLog } from '@/lib/log/sanitize';

export const dynamic = 'force-dynamic';

const chatRequestSchema = z.object({
  message: z.string().min(1, "Le message ne peut pas être vide."),
  subject: z.nativeEnum(Subject, {
    errorMap: () => ({ message: "La matière fournie est invalide." }),
  }),
  intent: z.enum(["tutor", "summary", "pdf"]).default("tutor"),
});

export async function POST(req: NextRequest) {
  try {
    // Validation ENV au démarrage (mode, clés, etc.)
    let ariaMode: string = 'unknown';
    try {
      const { validateAriaEnv, computeAriaMode } = await import('@/lib/aria/env-validate');
      validateAriaEnv();
      ariaMode = computeAriaMode();
      console.log(`[ARIA][Boot] mode=${ariaMode}`);
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

    const { message, subject, intent } = parsedBody.data as { message: string; subject: Subject; intent: Intent };

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

    // Streaming SSE si demandé
    const url = new URL(req.url);
    const wantStream = url.searchParams.get('stream') === 'true';
    if (wantStream) {
      // En mode service, on ne streame pas (pour l'instant): on émet une erreur SSE claire
      if (ariaMode === 'service') {
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ code: 'stream_not_available_in_service_mode' })}\n\n`));
            controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ reason: 'service_mode' })}\n\n`));
            controller.close();
          }
        });
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            ...(process.env.NODE_ENV !== 'production' ? { 'Access-Control-Allow-Origin': '*' } : {}),
          },
        });
      }
      const encoder = new TextEncoder();
      const keepAliveMs = 15000;
      const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || 30000);
      const retriesMax = Number(process.env.RETRIES || 1);
      const { selectModel, getFallbackModel } = await import('@/lib/aria/openai');
      const modelPrimary = selectModel();
      const modelFallback = getFallbackModel();

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const sendEvent = (event: string, obj: any = {}) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(obj)}\n\n`));
          const ping = () => controller.enqueue(encoder.encode(`:\n\n`));
          const heartbeat = setInterval(ping, keepAliveMs);
          const startedAt = Date.now();
          let usedModel = modelPrimary;
          let attempt = 0;
          let tokenIndex = 0;

          const runOnce = async (model: string) => {
            const { default: OpenAI } = await import('openai');
            const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const controllerAbort = new AbortController();
            const timer = setTimeout(() => controllerAbort.abort(), timeoutMs);
            try {
              const sys = getSystemPrefix();
              const gen = getGenerationParams(intent);
              // @ts-ignore stream: true support
              const resp = await (client as any).chat.completions.create({
                model,
                stream: true,
                temperature: gen.temperature,
                top_p: gen.top_p,
                presence_penalty: gen.presence_penalty,
                max_tokens: gen.max_tokens,
                messages: [
                  { role: 'system', content: sys },
                  { role: 'user', content: `Matière: ${subject}\n\nQuestion: ${message}` },
                ],
              }, { signal: controllerAbort.signal });

              for await (const chunk of resp) {
                const delta = chunk?.choices?.[0]?.delta?.content || '';
                if (delta) {
                  sendEvent('token', { text: delta, index: tokenIndex++ });
                }
              }
              clearTimeout(timer);
              const ms = Date.now() - startedAt;
              console.log(sanitizeLog(`[ARIA][chat] intent=${intent} model=${model} fallback=${modelFallback || 'null'} stream=true ms=${ms} tokens=${tokenIndex}`));
              sendEvent('done', { usage: { prompt: null, completion: tokenIndex }, model, latency_ms: ms });
              controller.close();
            } catch (err: any) {
              clearTimeout(timer);
              throw err;
            }
          };

          while (true) {
            try {
              usedModel = attempt === 0 ? modelPrimary : (modelFallback || modelPrimary);
              await runOnce(usedModel);
              break;
            } catch (err: any) {
              attempt++;
              const retriable = attempt <= retriesMax;
              if (!retriable) {
                console.error(sanitizeLog(`[ARIA][chat][stream] error: ${String(err?.message || err)}`));
                sendEvent('error', { code: 'timeout_or_upstream_error' });
                sendEvent('done', { reason: 'error' });
                controller.close();
                break;
              }
            }
          }
          clearInterval(heartbeat);
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          ...(process.env.NODE_ENV !== 'production' ? { 'Access-Control-Allow-Origin': '*' } : {}),
        },
      });
    }

    // Mode non-stream: orchestrateur habituel
    const orchestrator = new AriaOrchestrator(studentId!, parentId!);
    const { response, documentUrl } = await orchestrator.handleQuery(message, subject);
    return NextResponse.json({ response, documentUrl });

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
