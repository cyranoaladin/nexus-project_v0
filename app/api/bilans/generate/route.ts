import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateBilan, renderLatex, compileLatex } from "@/server/bilan/orchestrator";
import { LocalStorage } from "@/lib/storage";
import { z } from "zod";
import { requireRole } from "@/lib/server/authz";
import { UserRole } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calculateQcmScores } from "@/packages/shared/scoring/qcm_scoring";
import path from "path";

const GenerateRequestSchema = z.object({
  bilanPremiumId: z.string(),
  variant: z.enum(["parent", "eleve"]),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    requireRole([UserRole.ADMIN, UserRole.ASSISTANTE, UserRole.PARENT], session);

    const body = await req.json();
    const validation = GenerateRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request body", details: validation.error.format() }, { status: 400 });
    }
    
    const { bilanPremiumId, variant } = validation.data;

    const bilan = await prisma.bilanPremium.findUnique({
      where: { id: bilanPremiumId },
      include: { student: true }
    });

    if (!bilan) {
      return NextResponse.json({ error: "BilanPremium not found" }, { status: 404 });
    }
    
    // Le `meta` contient les réponses brutes du QCM, nous le passons au scoreur
    // Le `volet2Summary` est déjà le payload traité.
    const qcm = calculateQcmScores(bilan.meta as any);
    const volet2 = bilan.volet2Summary as any;
    const { student } = bilan;

    if (!qcm || !volet2) {
      return NextResponse.json({ error: "QCM or Volet 2 data is missing" }, { status: 400 });
    }

    // ACL Check for PARENT role
    if (session?.user?.role === UserRole.PARENT) {
      const parent = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: { children: { select: { id: true } } },
      });
      if (!parent || !parent.children.some(child => child.id === student.id)) {
        return NextResponse.json({ error: "Forbidden: You can only generate reports for your own children." }, { status: 403 });
      }
    }

    await prisma.bilanPremium.update({ where: { id: bilanPremiumId }, data: { status: 'GENERATING' } });

    // 1) Appel OpenAI → sections texte + lignes tableau
    const out = await generateBilan({
      variant,
      student: {
        name: `${student.firstName} ${student.lastName}`,
        level: student.grade || 'N/A',
        subjects: 'N/A', // TODO: Ajouter la matière au modèle Student
        status: 'Scolarisé', // TODO: Ajouter le statut au modèle Student
      },
      qcm,
      volet2,
    });

    // 2) Fusion Mustache→LaTeX
    const rows = out.table_domain_rows.map(r => `${r.domain} & ${r.points} / ${r.max} & ${Math.round(r.masteryPct)}\\% & ${r.remark ?? ''} \\\\`).join("\\n");
    
    const view = {
      student_name: `${student.firstName} ${student.lastName}`,
      level: student.grade,
      subjects: 'N/A', // TODO
      status: 'Scolarisé', // TODO
      qcm_total: qcm.total,
      qcm_max: qcm.max,
      score_global: Math.round(qcm.scoreGlobalPct),
      intro_text: out.intro_text,
      diagnostic_text: out.diagnostic_text,
      profile_text: out.profile_text,
      roadmap_text: out.roadmap_text,
      offers_text: out.offers_text,
      conclusion_text: out.conclusion_text,
      table_domain_rows: rows,
      fig_radar_path: volet2.radarPath ?? path.resolve(process.cwd(), "public/images/sample-radar.png"),
      badges_tex: (volet2.badges || []).map((b: string) => `\\badge{${b}}`).join(" "),
    };
    const tex = renderLatex(view);

    // 3) Compile → PDF local + stockage
    await prisma.bilanPremium.update({ where: { id: bilanPremiumId }, data: { status: 'COMPILING' } });
    const pdfPath = compileLatex(tex, `./.build/${student.id}/${variant}`);
    const storage = new LocalStorage();
    const pdfUrl = await storage.put(pdfPath, `${student.id}/${variant}/${bilanPremiumId}.pdf`);

    // 4) Persist Bilan
    await prisma.bilanPremium.update({
      where: { id: bilanPremiumId },
      data: {
        variant: variant === "parent" ? "PARENT" : "ELEVE",
        status: "READY",
        pdfUrl,
      },
    });

    return NextResponse.json({ id: bilanPremiumId, pdfUrl });
  } catch (error) {
    console.error("Bilan generation failed:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: "Bilan generation failed", details: errorMessage }, { status: 500 });
  }
}
