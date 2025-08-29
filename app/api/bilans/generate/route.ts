import { LocalStorage } from '@/apps/web/lib/storage';
import { compileLatex, generateBilan, renderLatex } from '@/apps/web/server/bilan/orchestrator';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { studentId, variant, qcm, volet2 } = body;
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return NextResponse.json({ error: 'student not found' }, { status: 404 });

  const out = await generateBilan({
    variant, student: {
      name: `${student.firstName} ${student.lastName}`,
      level: (student as any).grade || 'Terminale', subjects: 'Spé Maths + NSI', status: 'Scolarisé',
    }, qcm, volet2, traceUserId: student.id
  });

  const rows = out.table_domain_rows.map(r => `${r.domain} & ${r.points} / ${r.max} & ${r.masteryPct}\\% & ${r.remark ?? ''} \\\\`).join('\n');
  const view = {
    student_name: `${student.firstName} ${student.lastName}`,
    level: (student as any).grade || 'Terminale', subjects: 'Spé Maths + NSI', status: 'Scolarisé',
    qcm_total: qcm.total, qcm_max: qcm.max, score_global: Math.round(qcm.scoreGlobalPct),
    intro_text: out.intro_text, diagnostic_text: out.diagnostic_text, profile_text: out.profile_text,
    roadmap_text: out.roadmap_text, offers_text: out.offers_text, conclusion_text: out.conclusion_text,
    table_domain_rows: rows,
    fig_radar_path: volet2.radarPath ?? 'public/sample-radar.png',
    badges_tex: (volet2.badges || []).map((b: string) => `\\badge{${b}}`).join(' '),
  };
  const tex = renderLatex(view);

  const pdfPath = compileLatex(tex, `./.build/${student.id}/${variant}`);
  const storage = new LocalStorage();
  const pdfUrl = await storage.put(pdfPath, `${student.id}/${variant}/bilan.pdf`);

  const record = await prisma.bilan.create({
    data: {
      studentId: student.id,
      qcmRaw: qcm, pedagoRaw: volet2, qcmScores: qcm, pedagoProfile: volet2,
      synthesis: { ok: true }, offers: { ok: true },
      pdfUrl,
    }
  });

  return NextResponse.json({ id: record.id, pdfUrl });
}
