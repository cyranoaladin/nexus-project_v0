import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getAuthFromRequest } from '@/lib/api/auth';
import { NextResponse } from "next/server";
import React from "react";

// GET /api/bilan/pdf?niveau=premiere|terminale&variant=eleve|parent|general&studentId=...&bilanId=...
// Fallbacks:
// - if bilanId provided, fetch by id (auth: owner/parent/admin)
// - else if studentId + niveau provided, fetch latest for that student and niveau
// - else if niveau provided and session user is ELEVE, fetch latest for self
// - otherwise 400
export async function GET(req: Request) {
  const auth = await getAuthFromRequest(req as any);
  let session = await getServerSession(authOptions);
  if (!session?.user && !auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const bilanId = url.searchParams.get("bilanId") || undefined;
  const niveauParam = (url.searchParams.get("niveau") || "").toLowerCase();
  const variantParam = (url.searchParams.get("variant") || "").toLowerCase();
  const studentId = url.searchParams.get("studentId") || undefined;

  const variant = variantParam === "parent" ? "parent" : variantParam === "eleve" ? "eleve" : "general";

  const role = (session?.user as any)?.role || (auth?.user as any)?.role;
  const isAdmin = role === "ADMIN";

  // Resolve bilan
  let bilan: any | null = null;
  if (bilanId) {
    bilan = await prisma.bilan.findUnique({
      where: { id: bilanId },
      include: { student: { include: { user: true, parent: { include: { user: true } } } } },
    });
    if (!bilan) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const isOwner = bilan.student.userId === session.user.id;
    const isParent = bilan.student.parent?.userId === session.user.id;
    if (!(isOwner || isParent || isAdmin)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else {
    // Find latest by (studentId?, niveau?)
    if (!niveauParam) return NextResponse.json({ error: "Missing niveau" }, { status: 400 });
    let student: any | null = null;
    if (studentId) {
      student = await prisma.student.findUnique({ where: { id: studentId }, include: { user: true, parent: { include: { user: true } } } });
      if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
      const sessionUserId = (session?.user as any)?.id;
      const isOwner = sessionUserId ? (student.userId === sessionUserId) : !!auth;
      const isParent = sessionUserId ? (student.parent?.userId === sessionUserId) : !!auth;
      if (!(isOwner || isParent || isAdmin)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } else {
      // default to current student if any
      student = await prisma.student.findFirst({ where: { userId: (session?.user as any)?.id }, include: { user: true, parent: { include: { user: true } } } });
      if (!student) return NextResponse.json({ error: "No student context" }, { status: 400 });
    }
    const niveauText = niveauParam === "terminale" ? "Terminale" : niveauParam === "premiere" ? "Première" : niveauParam;
    bilan = await prisma.bilan.findFirst({
      where: { studentId: student.id, niveau: niveauText },
      orderBy: { createdAt: "desc" },
      include: { student: { include: { user: true, parent: { include: { user: true } } } } },
    });
    if (!bilan) return NextResponse.json({ error: "No bilan for niveau" }, { status: 404 });
  }

  // If general variant and we have stored blob, serve it directly
  const isE2E = process.env.E2E === '1';
  if (variant === 'general' && bilan.pdfBlob && !isE2E) {
    return new NextResponse(bilan.pdfBlob as unknown as Buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=bilan-${bilan.id}.pdf`,
      },
    });
  }

  // Build doc depending on variant and niveau using adapters when relevant
  const { pdf } = await import('@react-pdf/renderer');
  const niv = (bilan.niveau || '').toLowerCase();
  const subj = (bilan.subject || '').toUpperCase();

  let doc: any;
  if (variant === 'parent') {
    const { BilanPdfParent } = await import('@/lib/pdf/BilanPdfParent');
    // Prefer adapter for clean payload if niveau/subject recognized
    let data: any;
    try {
      if (subj === 'NSI' && (niv === 'terminale')) {
        const { buildPdfPayloadNSITerminale } = await import('@/lib/scoring/adapter_nsi_terminale');
        data = buildPdfPayloadNSITerminale((bilan.qcmScores as any) || {} as any);
        data.eleve = { firstName: bilan.student.user.firstName, lastName: bilan.student.user.lastName, niveau: bilan.niveau, statut: bilan.statut };
        data.recommandation = data.recommandation || data.offers;
      } else if (subj === 'NSI' && (niv === 'première' || niv === 'premiere')) {
        const { buildPdfPayloadNSIPremiere } = await import('@/lib/scoring/adapter_nsi_premiere');
        data = buildPdfPayloadNSIPremiere((bilan.qcmScores as any) || {} as any);
        data.eleve = { firstName: bilan.student.user.firstName, lastName: bilan.student.user.lastName, niveau: bilan.niveau, statut: bilan.statut };
        data.recommandation = data.recommandation || data.offers;
      } else if (niv === 'première' || niv === 'premiere') {
        const { buildPdfPayloadPremiere } = await import('@/lib/scoring/adapter_premiere');
        data = buildPdfPayloadPremiere((bilan.qcmScores as any) || {}, { firstName: bilan.student.user.firstName, lastName: bilan.student.user.lastName, niveau: bilan.niveau, statut: bilan.statut });
      } else if (niv === 'terminale') {
        const { buildPdfPayloadTerminale } = await import('@/lib/scoring/adapter_terminale');
        data = buildPdfPayloadTerminale((bilan.qcmScores as any) || {}, { firstName: bilan.student.user.firstName, lastName: bilan.student.user.lastName, niveau: bilan.niveau, statut: bilan.statut });
      }
    } catch {}
    if (!data) {
      // fallback to simple derivation
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
      };
    }
    doc = React.createElement(BilanPdfParent as any, { data } as any);
  } else if (variant === 'eleve') {
    const { BilanPdfEleve } = await import('@/lib/pdf/BilanPdfEleve');
    let data: any;
    try {
      if (subj === 'NSI' && (niv === 'terminale')) {
        const { buildPdfPayloadNSITerminale } = await import('@/lib/scoring/adapter_nsi_terminale');
        data = buildPdfPayloadNSITerminale((bilan.qcmScores as any) || {} as any);
        data.eleve = { firstName: bilan.student.user.firstName, lastName: bilan.student.user.lastName, niveau: bilan.niveau, statut: bilan.statut };
      } else if (subj === 'NSI' && (niv === 'première' || niv === 'premiere')) {
        const { buildPdfPayloadNSIPremiere } = await import('@/lib/scoring/adapter_nsi_premiere');
        data = buildPdfPayloadNSIPremiere((bilan.qcmScores as any) || {} as any);
        data.eleve = { firstName: bilan.student.user.firstName, lastName: bilan.student.user.lastName, niveau: bilan.niveau, statut: bilan.statut };
      } else if (niv === 'première' || niv === 'premiere') {
        const { buildPdfPayloadPremiere } = await import('@/lib/scoring/adapter_premiere');
        data = buildPdfPayloadPremiere((bilan.qcmScores as any) || {}, { firstName: bilan.student.user.firstName, lastName: bilan.student.user.lastName, niveau: bilan.niveau, statut: bilan.statut });
      } else if (niv === 'terminale') {
        const { buildPdfPayloadTerminale } = await import('@/lib/scoring/adapter_terminale');
        data = buildPdfPayloadTerminale((bilan.qcmScores as any) || {}, { firstName: bilan.student.user.firstName, lastName: bilan.student.user.lastName, niveau: bilan.niveau, statut: bilan.statut });
      }
    } catch {}
    if (!data) {
      const q = (bilan.qcmScores as any) || { byDomain: {} };
      const byDomain = q.byDomain || {};
      const scoresByDomain = Object.keys(byDomain).map((k) => ({ domain: k, percent: byDomain[k].percent ?? 0 }));
      data = {
        eleve: { firstName: bilan.student.user.firstName, lastName: bilan.student.user.lastName, niveau: bilan.niveau },
        createdAt: bilan.createdAt.toISOString(),
        scoresByDomain,
        feuilleDeRoute: (bilan.synthesis as any)?.feuilleDeRoute || [],
        pedago: (bilan.pedagoProfile as any) || {},
      };
    }
    doc = React.createElement(BilanPdfEleve as any, { data } as any);
  } else {
    const { BilanPdf } = await import('@/lib/pdf/BilanPdf');
    doc = React.createElement(BilanPdf as any, {
      bilan: {
        id: bilan.id,
        createdAt: bilan.createdAt.toISOString(),
        qcmScores: bilan.qcmScores,
        pedagoProfile: bilan.pedagoProfile,
        synthesis: bilan.synthesis,
        offers: bilan.offers,
      }, student: { firstName: bilan.student.user.firstName || undefined, lastName: bilan.student.user.lastName || undefined }
    } as any);
  }

  // Convert to Buffer
  let buffer: Buffer | null = null;
  try {
    // @ts-ignore
    const instance = pdf(doc);
    // @ts-ignore
    if (typeof instance.toBuffer === 'function') {
      // @ts-ignore
      const maybe = await instance.toBuffer();
      if (maybe instanceof Uint8Array) buffer = Buffer.from(maybe);
      else if (maybe && typeof (maybe as any).getReader === 'function') {
        const ab = await new Response(maybe as any).arrayBuffer(); buffer = Buffer.from(new Uint8Array(ab));
      } else if (maybe && typeof (maybe as any).arrayBuffer === 'function') {
        const ab = await (maybe as any).arrayBuffer(); buffer = Buffer.from(new Uint8Array(ab));
      } else buffer = Buffer.from(maybe as any);
    }
  } catch {}

  if (!buffer) {
    // Fallback helper path
    try {
      // @ts-ignore
      const instance = pdf(doc);
      // @ts-ignore
      const blob: Blob = await instance.toBlob();
      const ab = await blob.arrayBuffer();
      buffer = Buffer.from(new Uint8Array(ab));
    } catch (e) {
      return NextResponse.json({ error: 'PDF rendering failed', details: String(e) }, { status: 500 });
    }
  }

  return new NextResponse(buffer, { headers: { 'Content-Type': 'application/pdf' } });
}
