import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const RAG_URL = process.env.RAG_SERVICE_URL || 'http://localhost:8001';
const LLM_URL = process.env.LLM_SERVICE_URL || 'http://localhost:8003';
const PDF_URL = process.env.PDF_GENERATOR_SERVICE_URL || 'http://localhost:8002';

async function pingHealth(baseUrl: string) {
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    const ms = Date.now() - started;
    return { ok: res.ok, ms } as const;
  } catch (e: any) {
    const ms = Date.now() - started;
    return { ok: false, ms, error: e?.message || 'error' } as const;
  }
}

export async function GET() {
  try {
    // DB health and basic metric
    const t0 = Date.now();
    await prisma.$connect();
    const userCount = await prisma.user.count();
    const dbMs = Date.now() - t0;

    // Microservices health
    const [rag, llm, pdf] = await Promise.all([
      pingHealth(RAG_URL),
      pingHealth(LLM_URL),
      pingHealth(PDF_URL),
    ]);

    const overall = (rag.ok ? 1 : 0) + (llm.ok ? 1 : 0) + (pdf.ok ? 1 : 0);
    const status = overall >= 2 ? 'ok' : overall >= 1 ? 'degraded' : 'down';

    return NextResponse.json({
      status,
      app: {
        db: { connected: true, userCount, ms: dbMs },
      },
      services: {
        rag,
        llm,
        pdf,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: error?.message || 'internal error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  } finally {
    try { await prisma.$disconnect(); } catch {}
  }
}

