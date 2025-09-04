import { NextRequest, NextResponse } from 'next/server';
// Non-E2E imports will be loaded dynamically to avoid heavy module costs in E2E stub mode
import type { GenerateBilanPremiumInput } from '@/apps/web/server/bilan/orchestrator';
import { isE2EStubActive } from '@/apps/web/server/bilan/orchestrator';
import React from 'react';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function BilanPdfDoc({ data }: { data: any; }) {
  const Section = ({ title, children }: any) => (
    React.createElement('div', { style: { marginBottom: 8 } }, [
      React.createElement('h2', { key: 't', style: { fontSize: 14 } }, title),
      React.createElement('div', { key: 'c', style: { fontSize: 10 } }, children),
    ])
  );
  return React.createElement('div', { style: { padding: 16, fontFamily: 'InterE2E' } }, [
    React.createElement('h1', { key: 'h', style: { fontSize: 18 } }, 'Bilan Premium'),
    Section({ title: 'Profil', children: data?.overview?.profil || '' }),
    Section({ title: 'Objectifs', children: (data?.overview?.objectifs || []).join(' • ') }),
    Section({ title: 'Diagnostic', children: (data?.diagnostic || []).map((d: any) => `${d.matiere} [${d.priorite}] — Faiblesses: ${(d.faiblesses || []).join(', ')}`).join('\n') }),
    Section({ title: 'Plan 12 semaines', children: (data?.plan_12_semaines || []).slice(0, 4).map((w: any) => `S${w.semaine}: ${w.charge_h}h — ${(w.objectifs || []).join(', ')}`).join('\n') }),
  ]);
}

export async function POST(req: NextRequest) {
  try {
    const t0 = Date.now();
    const url = new URL(req.url);

    // MODE TEST FORCÉ: forceLatex=1 -> essaie LaTeX, sinon pdf-lib, indépendamment du stub
    if (url.searchParams.get('forceLatex') === '1') {
      const v = (url.searchParams.get('variant') || 'eleve') as 'eleve' | 'parent';
      const val: any = {
        meta: { variant: v, matiere: 'NSI', statut: 'fr', createdAtISO: new Date().toISOString() },
        eleve: { firstName: 'Alex', lastName: 'Martin', etab: 'Lycée Staging' },
        academic: {
          globalPercent: 72,
          scoresByDomain: [
            { domain: 'Algorithmes', percent: 68 },
            { domain: 'Python', percent: 72 },
            { domain: 'Programmation Objet', percent: 60 },
            { domain: 'Graphes', percent: 58 },
            { domain: 'BD/SQL', percent: 81 },
            { domain: 'Réseaux', percent: 77 },
            { domain: 'Web', percent: 65 },
          ],
        },
        pedagogue: { style: 'Visuel', autonomie: 'moyenne', organisation: 'moyenne', stress: 'moyen', flags: [] },
        plan: { horizonMois: 3, hebdoHeures: 2, etapes: ['Consolider Python', 'Revoir graphes', 'Exercices de modélisation', 'Évaluer en conditions réelles'] },
        offres: { primary: 'Flex', alternatives: ['Odyssée'], reasoning: 'Progression continue.' },
        rag: { citations: [{ title: 'Graphes — parcours', src: 'kb:nsi/graphes', snippet: 'BFS et DFS, complexités O(V+E).' }] },
      };
      // Essai LaTeX
      try {
        const { tryGeneratePremiumLatexPdf } = await import('@/apps/web/server/bilan/orchestrator');
        const pdfBuf = await tryGeneratePremiumLatexPdf(val as any);
        if (pdfBuf) return new NextResponse(pdfBuf as any, { headers: { 'Content-Type': 'application/pdf' } });
      } catch {}
      // Fallback pdf-lib
      const pdfLib = await import('pdf-lib');
      const { PDFDocument, StandardFonts, rgb } = pdfLib as any;
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      const pages = v === 'parent' ? 3 : 2;
      for (let p = 0; p < pages; p++) {
        const page = pdfDoc.addPage([595.28, 841.89]);
        const { height } = page.getSize();
        page.drawText('Nexus Reussite - Bilan Premium (Staging)', { x: 40, y: height - 60, size: 18, font, color: rgb(0, 0, 0) });
        page.drawText(`Score global : ${Math.round(val.academic.globalPercent)}%`, { x: 40, y: height - 90, size: 12, font });
        let y = height - 120;
        for (const d of val.academic.scoresByDomain) { page.drawText(`• ${d.domain}`, { x: 48, y, size: 12, font }); y -= 16; }
        y -= 16;
        for (let i = 0; i < (v === 'parent' ? 320 : 170) && y > 40; i++) { page.drawText(`Contenu ${i + 1}`, { x: 40, y, size: 10, font }); y -= 12; }
      }
      const bytes = await pdfDoc.save();
      return new NextResponse(Buffer.from(bytes) as any, { headers: { 'Content-Type': 'application/pdf' } });
    }

    const E2E_MODE = isE2EStubActive();
    if (E2E_MODE) {
      console.log('[E2E-STUB] /api/bilan/generate active');
      const variant = (url.searchParams.get('variant') || 'parent').toLowerCase();
      const format = (url.searchParams.get('format') || 'pdf').toLowerCase();

      const stub = {
        meta: { schema: 'BilanPremiumV1', variant, renderer: 'react', e2e: true },
        eleve: { firstName: 'Alex', lastName: 'Martin', etab: 'Lycée E2E' },
        academic: {
          globalPercent: 68,
          scoresByDomain: [
            { domain: 'Algèbre', percent: 62 },
            { domain: 'Fonctions', percent: 71 },
            { domain: 'Géométrie', percent: 75 },
            { domain: 'Trigonométrie', percent: 53 },
            { domain: 'Proba/Stats', percent: 80 },
            { domain: 'Algorithmique', percent: 60 }
          ],
        },
        pedago: { style: 'Visuel', autonomie: 'moyenne', organisation: 'moyenne', stress: 'moyen', flags: [] },
        plan: {
          horizonMois: 3,
          hebdoHeures: 2,
          etapes: [
            'S1 Consolidation', 'S2 Consolidation', 'S3 Approfondissement', 'S4 Approfondissement',
            'S5 Entraînement', 'S6 Entraînement', 'S7 Entraînement', 'S8 Bilan'
          ]
        },
        offres: { primary: 'Studio Flex', alternatives: ['Académies'], reasoning: '1–2 axes <50%, besoin ciblé.', offerRuleMatched: 'STUDIO_FLEX_TARGETED' },
        rag: { citations: [] },
      } as const;

      if (format === 'json') {
        // map rag.snippets -> rag.citations if provided in body
        let body: any | null = null;
        const ct = (req.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('application/json')) {
          try { body = await req.json(); } catch { body = null; }
        }
        let out = { ...stub } as any;
        if ((!out.rag || out.rag.citations.length === 0) && (body?.rag?.snippets || []).length > 0) {
          const mapped = (body.rag.snippets as any[]).slice(0, 3).map(s => ({ title: s.title || 'Source', src: s.url || s.source || '', snippet: s.summary || '' }));
          out = { ...out, rag: { citations: mapped } };
        }
        return NextResponse.json(out);
      }

      // PDF stub via pdf-lib (aucune dépendance AFM, compatible Node/Next)
      try {
        const pdfLib = await import('pdf-lib');
        const { PDFDocument, StandardFonts, rgb } = pdfLib as any;

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);

        const pagesCount = variant === 'parent' ? 3 : 2;
        for (let p = 0; p < pagesCount; p++) {
          const page = pdfDoc.addPage([595.28, 841.89]); // A4 points
          const { width, height } = page.getSize();
          const fontSizeTitle = 18;
          const fontSizeText = 12;
          page.drawText('Nexus Reussite — Bilan Premium (E2E)', { x: 40, y: height - 60, size: fontSizeTitle, font, color: rgb(0, 0, 0) });
          page.drawText(`Score global : ${stub.academic.globalPercent}%`, { x: 40, y: height - 90, size: fontSizeText, font });
          page.drawText('Axes radar (texte) :', { x: 40, y: height - 110, size: fontSizeText, font });
          let y = height - 130;
          for (const d of stub.academic.scoresByDomain) {
            page.drawText(`• ${d.domain}`, { x: 48, y, size: fontSizeText, font });
            y -= 16;
          }
          page.drawText(`Timeline: ${stub.plan.etapes.join(' | ')}`, { x: 40, y: y - 10, size: fontSizeText, font });
          y -= 40;
          const fillerLines = variant === 'parent' ? 320 : 170;
          for (let i = 0; i < fillerLines && y > 40; i++) {
            page.drawText(`E2E filler ${i + 1} — contenu pédagogique`, { x: 40, y, size: 10, font });
            y -= 12;
            if (y <= 40 && i < fillerLines - 1) {
              // continue on a new page if needed
              const np = pdfDoc.addPage([595.28, 841.89]);
              y = 800;
            }
          }
        }
        const pdfBytes = await pdfDoc.save();
        const buffer = Buffer.from(pdfBytes);
        return new NextResponse(buffer as any, { headers: { 'Content-Type': 'application/pdf' } });
      } catch (e: any) {
        console.error('[E2E-STUB] pdf-lib generation failed:', e);
        return NextResponse.json({ error: 'e2e_pdf_stub_failed', message: e?.message || String(e) }, { status: 500 });
      }
    }
    const variant = (url.searchParams.get('variant') || 'eleve') as 'eleve' | 'parent';
    const format = url.searchParams.get('format') || 'pdf';
    const timeoutMs = Number(url.searchParams.get('timeoutMs') || 0) || undefined;

    let body: any | null = null;
    const ct = (req.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/json')) {
      try { body = await req.json(); } catch { body = null; }
    }

    // Build student context
    let studentProfile: any | null = body?.studentProfile || null;
    if (!studentProfile && body?.studentId) {
      try {
        const { prisma } = await import('@/lib/prisma');
        const s = await (prisma as any).student.findUnique({ where: { id: String(body.studentId) }, include: { user: true } });
        if (s) studentProfile = {
          id: s.id,
          prenom: s.user?.firstName || 'Prénom',
          nom: s.user?.lastName || 'Nom',
          niveau: ((s.grade || 'Terminale').toLowerCase().includes('prem')) ? 'Première' : 'Terminale',
          specialites: ['NSI', 'MATHS'],
          objectifs: [], contraintes: []
        };
      } catch {}
    }
    if (!studentProfile) {
      try {
        const { prisma } = await import('@/lib/prisma');
        const s = await (prisma as any).student.findFirst?.({ include: { user: true } }).catch(() => null);
        if (s) {
          studentProfile = {
            id: s.id,
            prenom: s.user?.firstName || 'Prénom',
            nom: s.user?.lastName || 'Nom',
            niveau: ((s.grade || 'Terminale').toLowerCase().includes('prem')) ? 'Première' : 'Terminale',
            specialites: ['NSI', 'MATHS'], objectifs: [], contraintes: []
          };
        }
      } catch {}
    }
    if (!studentProfile) {
      // Fallback robuste sans DB: profil minimal pour permettre la génération PDF en prod-like
      studentProfile = {
        id: 'stub-student', prenom: 'Élève', nom: 'Nexus', niveau: 'Première', specialites: ['NSI'], objectifs: [], contraintes: []
      };
    }

    const { generateBilanPremium } = await import('@/apps/web/server/bilan/orchestrator');
    const input: GenerateBilanPremiumInput = {
      variant,
      student: studentProfile,
      aria: { resume: body?.aria?.resume || 'Interactions récentes — synthèse automatique indisponible.', points_faibles: body?.aria?.points_faibles || [] },
      notes: body?.notes || {},
      echeances: body?.echeances || [],
      rag: { snippets: body?.rag?.snippets || [] },
    };

    const { BilanPremiumV1 } = await import('@/apps/web/server/bilan/schema');
    const data = await generateBilanPremium(input, { timeoutMs });
    let val = BilanPremiumV1.parse(data);

    // If citations missing but rag snippets provided in body, enrich to satisfy PDF references
    if ((!val.rag || val.rag.citations.length === 0) && (body?.rag?.snippets || []).length > 0) {
      const mapped = (body.rag.snippets as any[]).slice(0, 3).map(s => ({ title: s.title || 'Source', src: s.url || s.source || '', snippet: s.summary || '' }));
      val = { ...val, rag: { citations: mapped } } as any;
    }

    // Offer rules overlay (deterministic fallback)
    let offerRuleMatched: string | undefined;
    try {
      const { applyOfferOverlay } = await import('@/apps/web/server/bilan/offers');
      const res = applyOfferOverlay(val as any);
      val = res.updated as any;
      offerRuleMatched = res.offerRuleMatched;
    } catch {}

    if (format === 'json') {
      // Audit log (non bloquant)
      try {
        const { createHash } = await import('crypto');
        const { prisma } = await import('@/lib/prisma');
        const bodyHash = body ? createHash('sha256').update(JSON.stringify(body)).digest('hex') : undefined;
        const latencyMs = Date.now() - t0;
        await (prisma as any).auditLog.create({ data: { actor: 'SYSTEM', action: 'BILAN_PREMIUM_GENERATE', diff: { variant, studentId: (studentProfile as any)?.id, timeoutMs, ragSnippets: (body?.rag?.snippets || []).length, bodyHash, latencyMs, offerRuleMatched } } });
      } catch {}
      return NextResponse.json({ ...(val as any), meta: { ...(val as any).meta, schema: 'BilanPremiumV1' } });
    }

    // Renderer selection via flag; default: LaTeX then fallback pdf-lib (robuste)
    const force = (process.env.PDF_RENDERER_FORCE || '').toLowerCase();
    const tryLatex = force !== 'pdf-lib';

    if (tryLatex) {
      try {
        const { tryGeneratePremiumLatexPdf } = await import('@/apps/web/server/bilan/orchestrator');
        const pdfBuf = await tryGeneratePremiumLatexPdf(val as any);
        if (pdfBuf) {
          // audit log success
          try {
            const { createHash } = await import('crypto');
            const { prisma } = await import('@/lib/prisma');
            const bodyHash = body ? createHash('sha256').update(JSON.stringify(body)).digest('hex') : undefined;
            const latencyMs = Date.now() - t0;
            await (prisma as any).auditLog.create({ data: { actor: 'SYSTEM', action: 'BILAN_PREMIUM_GENERATE', diff: { variant, studentId: (studentProfile as any)?.id, timeoutMs, ragSnippets: (body?.rag?.snippets || []).length, bodyHash, latencyMs, renderer: 'latex', offerRuleMatched } } });
          } catch {}
          return new NextResponse(pdfBuf as any, { headers: { 'Content-Type': 'application/pdf' } });
        }
      } catch {}
    }

    // Fallback pdf-lib (robuste en Node, aucune dépendance AFM)
    try {
      const pdfLib = await import('pdf-lib');
      const { PDFDocument, StandardFonts, rgb } = pdfLib as any;

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      const pagesCount_real = val.meta.variant === 'parent' ? 3 : 2;

      for (let p = 0; p < pagesCount_real; p++) {
        const page = pdfDoc.addPage([595.28, 841.89]);
        const { width, height } = page.getSize();
        page.drawText('Nexus Reussite - Bilan Premium', { x: 40, y: height - 60, size: 18, font, color: rgb(0, 0, 0) });
        const score = Math.round(val.academic?.globalPercent ?? 0);
        page.drawText(`Score global : ${score}%`, { x: 40, y: height - 90, size: 12, font });
        page.drawText('Axes radar (texte) :', { x: 40, y: height - 110, size: 12, font });
        let y = height - 130;
        for (const d of (val.academic?.scoresByDomain || [])) {
          page.drawText(`• ${d.domain}`, { x: 48, y, size: 12, font });
          y -= 16;
        }
        page.drawText('Timeline S1...S8 :', { x: 40, y: y - 10, size: 12, font });
        y -= 30;
        const etapes = (val.plan?.etapes || []);
        for (let i = 0; i < (val.meta.variant === 'parent' ? 320 : 170); i++) {
          const txt = i < etapes.length ? `S${i + 1} — ${etapes[i]}` : `Contenu pédagogique — PDF fallback.`;
          page.drawText(txt, { x: 40, y, size: 10, font });
          y -= 12;
          if (y <= 40 && i < (val.meta.variant === 'parent' ? 319 : 169)) {
            const np = pdfDoc.addPage([595.28, 841.89]);
            y = 800;
          }
        }
      }

      const bytes = await pdfDoc.save();
      const buf = Buffer.from(bytes);
      // audit log fallback
      try {
        const { createHash } = await import('crypto');
        const { prisma } = await import('@/lib/prisma');
        const bodyHash = body ? createHash('sha256').update(JSON.stringify(body)).digest('hex') : undefined;
        const latencyMs = Date.now() - t0;
        await (prisma as any).auditLog.create({ data: { actor: 'SYSTEM', action: 'BILAN_PREMIUM_GENERATE', diff: { variant, studentId: (studentProfile as any)?.id, timeoutMs, ragSnippets: (body?.rag?.snippets || []).length, bodyHash, latencyMs, renderer: 'pdf-lib', offerRuleMatched } } });
      } catch {}
      return new NextResponse(buf as any, { headers: { 'Content-Type': 'application/pdf' } });
    } catch (e) {
      return NextResponse.json({ error: 'bilan_generate_failed_fallback', message: String((e as any)?.message || e) }, { status: 500 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: 'bilan_generate_failed', message: String(e?.message || e) }, { status: 500 });
  }
}
