import { resolveQcmPath } from '@/lib/bilan/qcm-map';
import { prisma } from '@/lib/prisma';
import { readFile } from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subject = String(searchParams.get('subject') || searchParams.get('matiere') || '').toUpperCase();
    const grade = String(searchParams.get('grade') || searchParams.get('niveau') || '').toLowerCase();
    const studentId = String(searchParams.get('studentId') || '');
    if (!subject || !grade) {
      return NextResponse.json({ error: 'subject and grade are required' }, { status: 400 });
    }

    const qcmPath = resolveQcmPath(subject as any, grade as any);
    const qcmRaw = await readFile(qcmPath, 'utf-8');
    const qcm = JSON.parse(qcmRaw);

    // Volet 2 commun v2 (cahier des charges)
    let pedago: any = null;
    try {
      pedago = JSON.parse(await readFile('/home/alaeddine/Documents/nexus-project_v0/data/pedago_survey_commun.json', 'utf-8'));
    } catch {
      // Fallback NSI si commun manquant
      const pedagoCandidates = [
        '/home/alaeddine/Documents/nexus-project_v0/data/pedago_survey_nsi_premiere.json',
        '/home/alaeddine/Documents/nexus-project_v0/data/pedago_survey_nsi_terminale.json'
      ];
      for (const p of pedagoCandidates) {
        try { pedago = JSON.parse(await readFile(p, 'utf-8')); break; } catch {}
      }
      if (!pedago) pedago = { meta: { title: 'Volet 2', domains: [] }, questions: [] };
    }

    let hasPedago = false;
    if (studentId) {
      try {
        const mem = await prisma.memory.findFirst({ where: { studentId, content: 'PEDAGO_PROFILE_BASE' } });
        hasPedago = !!mem;
      } catch {}
    }

    return NextResponse.json({ qcm, pedago, hasPedago });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
