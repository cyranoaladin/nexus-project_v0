import { createStorageFromEnv } from '@/apps/web/lib/storage';
import { compileLatex, generateBilan, renderLatex } from '@/apps/web/server/bilan/orchestrator';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { studentId, variant, qcm, volet2 } = body;
  const student = await prisma.student.findUnique({ where: { id: studentId }, include: { user: true } });
  if (!student) return NextResponse.json({ error: 'student not found' }, { status: 404 });

  const out = await generateBilan({
    variant, student: {
      name: `${(student as any).user?.firstName ?? ''} ${(student as any).user?.lastName ?? ''}`.trim(),
      level: (student as any).grade || 'Terminale', subjects: 'Spé Maths + NSI', status: 'Scolarisé',
    }, qcm, volet2, traceUserId: student.id
  });

  const rows = (out.table_domain_rows as Array<{ domain: string; points: number; max: number; masteryPct: number; remark?: string; }>)
    .map((r) => `${r.domain} & ${r.points} / ${r.max} & ${r.masteryPct}\\% & ${r.remark ?? ''} \\`)
    .join('\n');
  const view = {
    student_name: `${(student as any).user?.firstName ?? ''} ${(student as any).user?.lastName ?? ''}`.trim(),
    level: (student as any).grade || 'Terminale', subjects: 'Spé Maths + NSI', status: 'Scolarisé',
    qcm_total: qcm.total, qcm_max: qcm.max, score_global: Math.round(qcm.scoreGlobalPct),
    intro_text: out.intro_text, diagnostic_text: out.diagnostic_text, profile_text: out.profile_text,
    roadmap_text: out.roadmap_text, offers_text: out.offers_text, conclusion_text: out.conclusion_text,
    table_domain_rows: rows,
    fig_radar_path: volet2.radarPath ?? 'public/sample-radar.png',
    badges_tex: (volet2.badges || []).map((b: string) => `\\badge{${b}}`).join(' '),
  };
  const tex = renderLatex(view);

  const outDir = `./.build/${student.id}/${variant}`;
  let pdfPath: string;
  if (process.env.TEST_PDF_FAKE === '1') {
    const fs = await import('fs/promises');
    const path = await import('path');
    await fs.mkdir(outDir, { recursive: true });
    pdfPath = path.join(outDir, 'bilan.pdf');
    await fs.writeFile(pdfPath, Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF'));
  } else {
    pdfPath = compileLatex(tex, outDir);
  }
  const storage = createStorageFromEnv();
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
