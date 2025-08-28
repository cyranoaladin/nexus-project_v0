import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import React from "react";

export async function GET(req: Request, { params }: { params: { bilanId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bilan = await prisma.bilan.findUnique({ where: { id: params.bilanId }, include: { student: { include: { user: true, parent: { include: { user: true } } } } } });
  if (!bilan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = (session.user as any).role;
  const isOwner = bilan.student.userId === session.user.id;
  const isParent = bilan.student.parent?.userId === session.user.id;
  const isAdmin = role === "ADMIN";
  if (!(isOwner || isParent || isAdmin)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Variant handling: standard (from blob if present) or generate parent/eleve/standard dynamically
  const url = new URL(req.url);
  const variant = (url.searchParams.get('variant') || '').toLowerCase();
  const isE2E = process.env.E2E === '1';
  if (bilan.pdfBlob && (!variant || isE2E)) {
    return new NextResponse(bilan.pdfBlob as unknown as Buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=bilan-${bilan.id}${variant ? '-' + variant : ''}.pdf`,
      }
    });
  }

  // Generate on the fly
  const { pdf } = await import('@react-pdf/renderer');
  const { BilanPdf } = await import('@/lib/pdf/BilanPdf');
  let doc: any;
  if (variant === 'parent') {
    const { BilanPdfParent } = await import('@/lib/pdf/BilanPdfParent');
    const niv = (bilan.niveau || '').toLowerCase();
    const subj = (bilan.subject || '').toUpperCase();
    let data: any = null;
    if (subj === 'NSI' && niv === 'terminale') {
      try {
        const { buildPdfPayloadNSITerminale } = await import('@/lib/scoring/adapter_nsi_terminale');
        data = buildPdfPayloadNSITerminale((bilan.qcmScores as any) || {} as any);
        data.eleve = { firstName: bilan.student.user.firstName, lastName: bilan.student.user.lastName, niveau: bilan.niveau, statut: bilan.statut };
        data.recommandation = data.recommandation || data.offers;
      } catch {}
    } else if (subj === 'NSI' && (niv === 'première' || niv === 'premiere')) {
      try {
        const { buildPdfPayloadNSIPremiere } = await import('@/lib/scoring/adapter_nsi_premiere');
        data = buildPdfPayloadNSIPremiere((bilan.qcmScores as any) || {} as any);
        data.eleve = { firstName: bilan.student.user.firstName, lastName: bilan.student.user.lastName, niveau: bilan.niveau, statut: bilan.statut };
        data.recommandation = data.recommandation || data.offers;
      } catch {}
    } else if (niv === 'première' || niv === 'premiere') {
      try {
        const { buildPdfPayloadPremiere } = await import('@/lib/scoring/adapter_premiere');
        data = buildPdfPayloadPremiere((bilan.qcmScores as any) || {}, { firstName: bilan.student.user.firstName ?? undefined, lastName: bilan.student.user.lastName ?? undefined, niveau: bilan.niveau ?? undefined, statut: bilan.statut ?? undefined });
      } catch {}
    } else if (niv === 'terminale') {
      try {
        const { buildPdfPayloadTerminale } = await import('@/lib/scoring/adapter_terminale');
        data = buildPdfPayloadTerminale((bilan.qcmScores as any) || {}, { firstName: bilan.student.user.firstName ?? undefined, lastName: bilan.student.user.lastName ?? undefined, niveau: bilan.niveau ?? undefined, statut: bilan.statut ?? undefined });
      } catch {}
    }
    if (!data) {
      const q = (bilan.qcmScores as any) || { byDomain: {} };
      const byDomain = q.byDomain || {};
      const scoresByDomain = Object.keys(byDomain).map((k) => ({ domain: k, percent: byDomain[k].percent ?? 0 }));
      data = {
        eleve: { firstName: bilan.student.user.firstName, lastName: bilan.student.user.lastName, niveau: bilan.niveau, statut: bilan.statut },
        createdAt: bilan.createdAt.toISOString(),
        scoresByDomain,
        forces: (bilan.synthesis as any)?.forces || [],
        faiblesses: (bilan.synthesis as any)?.faiblesses || [],
        feuilleDeRoute: (bilan.synthesis as any)?.feuilleDeRoute || [],
        recommandation: (bilan.offers as any) || {},
        pricing: { Cortex: 90, "Studio Flex": 100, "Académies": 200, "Odyssée": 6000 },
        horizonMois: 6,
        chargeHebdoHeures: 2,
      };
    }
    doc = React.createElement(BilanPdfParent as any, { data } as any);
  } else if (variant === 'eleve') {
    const { BilanPdfEleve } = await import('@/lib/pdf/BilanPdfEleve');
    const niv = (bilan.niveau || '').toLowerCase();
    const subj = (bilan.subject || '').toUpperCase();
    let data: any = null;
    if (subj === 'NSI' && (niv === 'première' || niv === 'premiere')) {
      try {
        const { buildPdfPayloadNSIPremiere } = await import('@/lib/scoring/adapter_nsi_premiere');
        data = buildPdfPayloadNSIPremiere((bilan.qcmScores as any) || {} as any);
        data.eleve = { firstName: bilan.student.user.firstName, lastName: bilan.student.user.lastName, niveau: (bilan as any)?.niveau };
      } catch {}
    }
    if (!data) {
      const q = (bilan.qcmScores as any) || { byDomain: {} };
      const byDomain = q.byDomain || {};
      const scoresByDomain = Object.keys(byDomain).map((k) => ({ domain: k, percent: byDomain[k].percent ?? 0 }));
      data = {
        eleve: { firstName: bilan.student.user.firstName, lastName: bilan.student.user.lastName, niveau: (bilan as any)?.niveau },
        createdAt: bilan.createdAt.toISOString(),
        scoresByDomain,
        feuilleDeRoute: (bilan.synthesis as any)?.feuilleDeRoute || [],
        pedago: (bilan.pedagoProfile as any) || {},
      };
    }
    doc = React.createElement(BilanPdfEleve as any, { data } as any);
  } else {
    // standard
    doc = React.createElement(BilanPdf as any, { bilan: {
      id: bilan.id,
      createdAt: bilan.createdAt.toISOString(),
      qcmScores: bilan.qcmScores,
      pedagoProfile: bilan.pedagoProfile,
      synthesis: bilan.synthesis,
      offers: bilan.offers,
    }, student: { firstName: bilan.student.user.firstName || undefined, lastName: bilan.student.user.lastName || undefined } } as any);
  }
  const instance: any = pdf(doc);
  const buffer: any = await instance.toBuffer();
  return new NextResponse(buffer, { headers: { 'Content-Type': 'application/pdf' } });
}

