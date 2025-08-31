// app/api/admin/rag/ingest/route.ts
import { authOptions } from '@/lib/auth';
import { UserRole } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://localhost:8001';

const ingestRequestSchema = z.object({
  contenu: z.string().min(1),
  metadata: z.record(z.any()),
});

export async function POST(req: Request) {
  try {
    // 1. Vérification de la session et du rôle
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // 2. Validation du corps de la requête (parser en sécurité)
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type invalide. Utilisez application/json.' }, { status: 415 });
    }
    let raw = '';
    try { raw = await req.text(); } catch { raw = ''; }
    if (!raw || raw.trim().length === 0) {
      return NextResponse.json({ error: 'Requête invalide: corps vide.' }, { status: 400 });
    }
    let body: unknown;
    try { body = JSON.parse(raw); } catch {
      return NextResponse.json({ error: 'Requête invalide: JSON mal formé.' }, { status: 400 });
    }
    const parsedBody = ingestRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json({ error: "Requête invalide", details: parsedBody.error.flatten() }, { status: 400 });
    }

    const { contenu, metadata } = parsedBody.data;

    // 3. Appel au microservice RAG
    const response = await fetch(`${RAG_SERVICE_URL}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenu, metadata }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Erreur du service RAG : ${errorBody}`);
      return NextResponse.json({ error: "Le service RAG a rencontré une erreur." }, { status: response.status });
    }

    const responseData = await response.json();

    // 4. Succès
    return NextResponse.json({ message: "Document ingéré avec succès.", data: responseData }, { status: 201 });

  } catch (error) {
    console.error("[API_RAG_INGEST_ERROR]", error);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}

