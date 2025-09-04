import { prisma } from "@/lib/prisma";
import { openai } from "@/server/openai/client";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { bilanId } = await req.json();
    if (!bilanId) return NextResponse.json({ error: "bilanId est requis" }, { status: 400 });

    const bilan = await prisma.bilan.findUnique({
      where: { id: String(bilanId) },
      include: { student: { include: { user: true } } },
    });
    if (!bilan) return NextResponse.json({ error: "Bilan introuvable" }, { status: 404 });

    const payload = {
      eleve: { prenom: bilan.student.user.firstName || "", nom: bilan.student.user.lastName || "" },
      parent: { prenom: (bilan as any)?.parentFirstName || '', nom: (bilan as any)?.parentLastName || '' },
      qcmScores: (bilan.qcmScores as any) || {},
      pedagoProfile: (bilan.pedagoProfile as any) || {},
      pre_analyzed_data: (bilan as any).preAnalyzedData || {},
      objectifs: (bilan as any)?.objectifs || undefined,
    };

    const client = openai();
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const prompt = `Tu es un expert pédagogique de Nexus Réussite.\n` +
      `Rédige une synthèse courte (≈350 mots, 5 sections: Résumé global, Forces, Axes prioritaires, Recommandation Nexus, Mini-feuille de route) en français.\n` +
      `Ton: premium, clair et motivant. Ne pas mentionner l'IA. Remplacer systématiquement le mot "élève" par le prénom \"${payload.eleve.prenom}\".\n` +
      `Inclure des éléments concrets issus du Volet 2 (organisation, difficultés, motivation, modalités, contraintes) et des scores QCM.\n` +
      `Respecter la matrice de décision pour l'offre principale et citer 1 alternative si utile.\n` +
      `Données: ${JSON.stringify(payload, null, 2)}`;

    const resp = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "Tu écris une synthèse structurée, brève et percutante en français (≈350 mots)." },
        { role: "user", content: prompt },
      ] as any,
      temperature: 0.4,
      max_tokens: 900,
    });
    const summaryText = resp.choices?.[0]?.message?.content?.trim() || "";

    await prisma.bilan.update({ where: { id: bilan.id }, data: { summaryText } });
    return NextResponse.json({ summaryText });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erreur interne" }, { status: 500 });
  }
}
