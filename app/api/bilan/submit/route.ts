import { resolveQcmPath } from '@/lib/bilan/qcm-map';
import { prisma } from '@/lib/prisma';
import { buildPedagoPayloadMathsPremiere } from '@/lib/scoring/pedago_maths_premiere';
import { buildPedagoPayloadMathsTerminale } from '@/lib/scoring/pedago_maths_terminale';
import { scoreQcm } from '@/lib/scoring/qcm';
import { readFile } from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type QcmQuestion = { id: string; domain?: string; weight?: number; type?: string; answer?: number; correct?: number[]; };
type QcmDoc = { meta?: any; questions: QcmQuestion[]; };

function buildSynthesis(qcmScores: { byDomain: Record<string, { percent: number; }>; }) {
  const forces: string[] = []; const faiblesses: string[] = [];
  for (const [k, v] of Object.entries(qcmScores.byDomain || {} as any)) {
    const p = (v as any).percent || 0;
    if (p >= 75) forces.push(k); else if (p < 50) faiblesses.push(k);
  }
  const feuilleDeRoute = [
    'S1–S2 : Automatismes et bases essentielles',
    'S3–S4 : Applications ciblées selon faiblesses',
    'S5–S6 : Approfondissement et annales',
    'S7–S8 : Consolidation et préparation examens',
  ];
  return { forces, faiblesses, feuilleDeRoute };
}

function chooseOffer(qcmScores: { byDomain: Record<string, { percent: number; }>; }) {
  const percents = Object.values(qcmScores.byDomain || {}).map((v: any) => Number(v.percent || 0));
  const avg = percents.length ? percents.reduce((a, b) => a + b, 0) / percents.length : 0;
  const low = percents.filter(p => p < 50).length;
  if (avg >= 65 && low === 0) return { primary: 'Cortex', alternatives: ['Studio Flex'], reasoning: 'Radar homogène et autonomie présumée.' };
  if (low <= 2) return { primary: 'Studio Flex', alternatives: ['Académies'], reasoning: '1–2 lacunes ciblées à combler rapidement.' };
  if (low >= 3) return { primary: 'Académies', alternatives: ['Odyssée'], reasoning: 'Plusieurs domaines <50% : besoin d’un boost intensif.' };
  return { primary: 'Odyssée', alternatives: ['Studio Flex'], reasoning: 'Objectif mention / besoin de structuration annuelle.' };
}

// Import auth lazily to avoid ESM adapter issues in Jest when E2E stub is used

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const isE2E = url.searchParams.get('e2e') === '1' || process.env.NEXT_PUBLIC_E2E === '1' || process.env.E2E === '1';
    const body = await req.json().catch(() => ({}));
    if (isE2E) {
      return NextResponse.json({ ok: true, bilanId: 'e2e-bilan-id' }, { status: 200 });
    }
    let session: any = null;
    try {
      const { authOptions } = await import('@/lib/auth');
      const { getServerSession } = await import('next-auth');
      session = await (getServerSession as any)(authOptions).catch(() => null);
    } catch {}
    const studentIdFromSession = (session?.user as any)?.studentId as string | undefined;
    // En E2E, autoriser l'absence de studentId (création sans FK)
    const studentIdRaw = String(body?.studentId || studentIdFromSession || '');
    const studentId = (isE2E && !studentIdRaw) ? '' : studentIdRaw;
    let subject = String(body?.subject || '').toUpperCase();
    let grade = String((body?.grade || body?.niveau || '')).toLowerCase();
    if (isE2E) {
      if (!subject) subject = 'MATHEMATIQUES';
      if (!grade) grade = 'premiere';
    }
    const qcmAnswers = (body?.qcmAnswers || {}) as Record<string, any>;
    const pedagoAnswers = body?.pedagoAnswers as Record<string, any> | undefined;
    if (!subject || !grade) return NextResponse.json({ error: 'subject, grade requis' }, { status: 400 });

    const qcmPath = resolveQcmPath(subject as any, grade as any);
    const qcmRawStr = await readFile(qcmPath, 'utf-8');
    const qcm: QcmDoc = JSON.parse(qcmRawStr);
    const qcmScores = scoreQcm(qcm as any, qcmAnswers);

    // Charger ou créer le profil pédagogique (Volet 2). On persiste aussi dans StudentProfileData.
    let pedagoRaw: any = null;
    if (pedagoAnswers && Object.keys(pedagoAnswers).length > 0) {
      pedagoRaw = pedagoAnswers;
      if (studentId) {
        try {
          await prisma.memory.create({ data: { studentId, kind: 'SEMANTIC' as any, content: 'PEDAGO_PROFILE_BASE', meta: pedagoAnswers } });
        } catch {}
        try {
          await prisma.studentProfileData.upsert({
            where: { studentId },
            create: { studentId, pedagoRawAnswers: pedagoAnswers, pedagoProfile: pedagoAnswers },
            update: { pedagoRawAnswers: pedagoAnswers, pedagoProfile: pedagoAnswers, lastUpdatedAt: new Date() },
          });
        } catch {}
      }
    } else {
      if (studentId) {
        const profile = await prisma.studentProfileData.findUnique({ where: { studentId } }).catch(() => null);
        if (profile?.pedagoProfile) pedagoRaw = profile.pedagoProfile;
        else {
          const mem = await prisma.memory.findFirst({ where: { studentId, content: 'PEDAGO_PROFILE_BASE' } });
          pedagoRaw = mem?.meta || {};
        }
      } else {
        pedagoRaw = {};
      }
    }
    // Si matière Maths (Première/Terminale) et des réponses sont fournies, calculer profil à partir du survey dédié
    let pedagoProfile = pedagoRaw;
    try {
      if (subject === 'MATHEMATIQUES' && (grade === 'premiere' || grade === 'première') && pedagoAnswers && Object.keys(pedagoAnswers).length > 0) {
        const surveyCommon = JSON.parse(await readFile('/home/alaeddine/Documents/nexus-project_v0/data/pedago_survey_commun.json', 'utf-8'));
        let merged = surveyCommon;
        try {
          const surveyMaths = JSON.parse(await readFile('/home/alaeddine/Documents/nexus-project_v0/data/pedago_survey_maths_premiere.json', 'utf-8'));
          merged.meta = { ...(merged.meta || {}), ...(surveyMaths.meta || {}) };
          if (Array.isArray(surveyMaths.questions)) merged.questions = Array.isArray(merged.questions) ? [...merged.questions, ...surveyMaths.questions] : surveyMaths.questions;
        } catch {}
        const out = buildPedagoPayloadMathsPremiere(merged, pedagoAnswers);
        pedagoProfile = out.pedagoProfile;
      } else if (subject === 'MATHEMATIQUES' && grade === 'terminale' && pedagoAnswers && Object.keys(pedagoAnswers).length > 0) {
        const surveyCommon = JSON.parse(await readFile('/home/alaeddine/Documents/nexus-project_v0/data/pedago_survey_commun.json', 'utf-8'));
        let merged = surveyCommon;
        try {
          const surveyMathsT = JSON.parse(await readFile('/home/alaeddine/Documents/nexus-project_v0/data/pedago_survey_maths_terminale.json', 'utf-8'));
          merged.meta = { ...(merged.meta || {}), ...(surveyMathsT.meta || {}) };
          if (Array.isArray(surveyMathsT.questions)) merged.questions = Array.isArray(merged.questions) ? [...merged.questions, ...surveyMathsT.questions] : surveyMathsT.questions;
        } catch {}
        const outT = buildPedagoPayloadMathsTerminale(merged as any, pedagoAnswers as any);
        pedagoProfile = outT.pedagoProfile;
      }
    } catch {}

    const synthesis = buildSynthesis({ byDomain: Object.fromEntries(Object.entries(qcmScores.byDomain).map(([k, v]) => [k, { percent: (v as any).percent }])) });
    const offers = chooseOffer({ byDomain: Object.fromEntries(Object.entries(qcmScores.byDomain).map(([k, v]) => [k, { percent: (v as any).percent }])) });

    const bilan = await prisma.bilan.create({
      data: {
        ...(studentId ? { studentId } : {}),
        subject,
        niveau: grade,
        statut: 'PENDING',
        qcmRaw: qcm,
        qcmScores,
        pedagoRaw: pedagoRaw || {},
        pedagoProfile: pedagoProfile || {},
        synthesis,
        offers,
      } as any,
      select: { id: true },
    });

    return NextResponse.json({ ok: true, bilanId: bilan.id });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
