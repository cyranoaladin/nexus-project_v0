import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole, Subject } from "@prisma/client";
import OpenAI from "openai";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const EmbeddingModel = "text-embedding-3-small" as const;

// Accepts French front-matter keys and maps them to Prisma fields
const ingestSchema = z.object({
  contenu: z.string().min(1, "Le contenu est obligatoire"),
  metadata: z.object({
    titre: z.string().min(1, "Le titre est obligatoire").catch(""),
    matiere: z.nativeEnum(Subject).or(z.string()).optional(),
    niveau: z.string().optional(),
    mots_cles: z.array(z.string()).optional(),
  }).passthrough(),
});

function normalizeMetadata(meta: any): {
  title: string;
  subject: Subject;
  grade: string | null;
  tags: string[];
} {
  const title = (meta.titre ?? meta.title ?? "").toString();
  const grade = meta.niveau ? String(meta.niveau) : null;

  // Try to map matiere (French) to Subject enum if provided as string
  let subjectEnum: Subject = Subject.MATHEMATIQUES;
  const rawSubject = (meta.matiere ?? meta.subject)?.toString();
  if (rawSubject) {
    const candidate = rawSubject.toUpperCase().replace(/\s|-/g, "_");
    if (candidate in Subject) {
      subjectEnum = (Subject as any)[candidate] as Subject;
    }
  }

  const tags: string[] = Array.isArray(meta.mots_cles)
    ? meta.mots_cles.map((t: any) => String(t))
    : Array.isArray(meta.tags)
      ? meta.tags.map((t: any) => String(t))
      : [];

  return { title, subject: subjectEnum, grade, tags };
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role as UserRole | undefined;
if (!role || !([UserRole.ADMIN, UserRole.ASSISTANTE, UserRole.COACH] as UserRole[]).includes(role)) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

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
    const parsed = ingestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Requête invalide", details: parsed.error.flatten() }, { status: 400 });
    }

    const { contenu, metadata } = parsed.data;
    const { title, subject, grade, tags } = normalizeMetadata(metadata);

    // Generate embedding via OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    let vector: number[] | undefined;
    if (apiKey) {
      const openai = new OpenAI({ apiKey });
      const embRes = await openai.embeddings.create({
        model: EmbeddingModel,
        input: contenu,
      });
      vector = embRes.data?.[0]?.embedding as unknown as number[] | undefined;
    } else {
      // Dev fallback: if no API key, generate a small deterministic embedding
      // Do NOT use in production.
      const hash = Array.from(contenu.slice(0, 64)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      const dim = 64;
      vector = Array.from({ length: dim }, (_, i) => Math.sin(hash + i));
    }

    if (!vector || !Array.isArray(vector)) {
      return NextResponse.json({ error: "Échec de la génération d'embedding" }, { status: 500 });
    }

    // Persist in DB. In schema, embedding and tags are strings (JSON-encoded)
    const created = await prisma.pedagogicalContent.create({
      data: {
        title: title || "Sans titre",
        content: contenu,
        subject,
        grade: grade ?? undefined,
        embedding: JSON.stringify(vector),
        tags: JSON.stringify(tags),
      },
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    console.error("[RAG_INGEST_POST_ERROR]", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
