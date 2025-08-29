import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DocumentProps } from "@react-pdf/renderer";
import React from "react";

// Helper pour éviter les répétitions de code
const getStudentInfo = (bilan: any) => ({
  firstName: bilan.student.user.firstName ?? undefined,
  lastName: bilan.student.user.lastName ?? undefined,
  niveau: bilan.niveau ?? undefined,
});

export async function GET(req: Request, { params }: { params: { bilanId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bilan = await prisma.bilan.findUnique({
    where: { id: params.bilanId },
    include: {
      student: {
        include: {
          user: true,
          parent: { include: { user: true } },
        },
      },
    },
  });

  if (!bilan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Vérification des permissions
  const { role, id: sessionId } = session.user as any;
  const isOwner = bilan.student.userId === sessionId;
  const isParent = bilan.student.parent?.userId === sessionId;
  const isAdmin = role === "ADMIN";

  if (!isOwner && !isParent && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Gestion de la variante de PDF demandée
  const url = new URL(req.url);
  const variant = (url.searchParams.get('variant') || '').toLowerCase();
  const isE2E = process.env.E2E === '1';
  const force = process.env.FORCE_PDF_REGEN === '1';

  // Si un PDF est déjà stocké en base, le servir directement
  if (!force && (!variant || (variant === 'general')) && !isE2E && bilan.pdfBlob) {
    const pdfUint8Array = new Uint8Array(bilan.pdfBlob as Buffer);

    return new NextResponse(pdfUint8Array, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="bilan-${bilan.id}${variant ? '-' + variant : ''}.pdf"`,
      },
    });
  }

  // --- Génération du PDF à la volée ---
  const { pdf } = await import('@react-pdf/renderer');
  let doc: React.ReactElement;

  const niv = (bilan.niveau || '').toLowerCase();
  const subj = (bilan.subject || '').toUpperCase();
  const qcmScores = (bilan.qcmScores as any) || {};

  try {
    if (variant === 'parent') {
      const { BilanPdfParent } = await import('@/lib/pdf/BilanPdfParent');
      let data: any;
      try {
        if (subj === 'NSI' && niv === 'terminale') {
          const { buildPdfPayloadNSITerminale } = await import('@/lib/scoring/adapter_nsi_terminale');
          data = buildPdfPayloadNSITerminale(qcmScores);
        } else if (subj === 'NSI' && (niv === 'première' || niv === 'premiere')) {
          const { buildPdfPayloadNSIPremiere } = await import('@/lib/scoring/adapter_nsi_premiere');
          data = buildPdfPayloadNSIPremiere(qcmScores);
        } else if (niv === 'première' || niv === 'premiere') {
          const { buildPdfPayloadPremiere } = await import('@/lib/scoring/adapter_premiere');
          data = buildPdfPayloadPremiere(qcmScores, { firstName: bilan.student.user.firstName ?? 'Élève' });
        } else if (niv === 'terminale') {
          const { buildPdfPayloadTerminale } = await import('@/lib/scoring/adapter_terminale');
          data = buildPdfPayloadTerminale(qcmScores, { firstName: bilan.student.user.firstName ?? 'Élève' });
        }
      } catch (e: any) {
        console.error('[PDF][AdapterError][parent]', { niveau: niv, matiere: subj, message: String(e?.message || e) });
      }

      const byDomain = qcmScores.byDomain || {};
      const baseData = {
        eleve: getStudentInfo(bilan),
        createdAt: bilan.createdAt.toISOString(),
        scoresByDomain: Object.keys(byDomain).map((k) => ({ domain: k, percent: byDomain[k].percent ?? 0 })),
        forces: (bilan.synthesis as any)?.forces || [],
        faiblesses: (bilan.synthesis as any)?.faiblesses || [],
        feuilleDeRoute: (bilan.synthesis as any)?.feuilleDeRoute || [],
        recommandation: (data?.recommandation || bilan.offers) as any,
        pricing: { Cortex: 90, "Studio Flex": 100, "Académies": 200, "Odyssée": 6000 },
        horizonMois: 6,
        chargeHebdoHeures: 2,
      };
      doc = React.createElement(BilanPdfParent, { data: { ...data, ...baseData } }) as any;

    } else if (variant === 'eleve') {
      const { BilanPdfEleve } = await import('@/lib/pdf/BilanPdfEleve');
      let data: any;
      try {
        if (subj === 'NSI' && (niv === 'première' || niv === 'premiere')) {
          const { buildPdfPayloadNSIPremiere } = await import('@/lib/scoring/adapter_nsi_premiere');
          data = buildPdfPayloadNSIPremiere(qcmScores);
        }
      } catch (e: any) {
        console.error('[PDF][AdapterError][eleve]', { niveau: niv, matiere: subj, message: String(e?.message || e) });
      }

      const byDomain = qcmScores.byDomain || {};
      const baseData = {
        eleve: getStudentInfo(bilan),
        createdAt: bilan.createdAt.toISOString(),
        scoresByDomain: Object.keys(byDomain).map((k) => ({ domain: k, percent: byDomain[k].percent ?? 0 })),
        feuilleDeRoute: (bilan.synthesis as any)?.feuilleDeRoute || [],
        pedago: (bilan.pedagoProfile as any) || {},
      };
      doc = React.createElement(BilanPdfEleve, { data: { ...data, ...baseData } }) as any;

    } else { // 'standard' ou variante inconnue
      const { BilanPdf } = await import('@/lib/pdf/BilanPdf');
      doc = React.createElement(BilanPdf, {
        bilan: {
          id: bilan.id,
          createdAt: bilan.createdAt.toISOString(),
          qcmScores: bilan.qcmScores,
          pedagoProfile: bilan.pedagoProfile,
          synthesis: bilan.synthesis,
          offers: bilan.offers,
        },
        student: getStudentInfo(bilan),
      }) as any;
    }

    // --- CORRECTION FINALE APPLIQUÉE ICI ---
    // 1. On récupère l'instance du document
    const instance = pdf(doc as React.ReactElement<DocumentProps>);
    
    // 2. On obtient le résultat de toBuffer(), qui est un ReadableStream
    const pdfStream = await instance.toBuffer();

    // 3. On convertit manuellement le ReadableStream en un Buffer Node.js
    const chunks: Uint8Array[] = [];
    for await (const chunk of pdfStream as any) {
        chunks.push(chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);
    
    // 4. On envoie le Buffer final, qui est un type compatible avec NextResponse
    return new NextResponse(pdfBuffer, {
      headers: { 
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="bilan-${bilan.id}.pdf"`,
      }
    });

  } catch (error) {
    console.error("PDF generation failed:", error);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
