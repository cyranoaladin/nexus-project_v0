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
      include: { student: { include: { user: true, parent: { include: { user: true } } } } },
    });
    if (!bilan) return NextResponse.json({ error: "Bilan introuvable" }, { status: 404 });

    const eleveData = {
      prenom: bilan.student.user.firstName || "",
      nom: bilan.student.user.lastName || "",
      niveau: (bilan as any).niveau || bilan.niveau || "",
      matiere: (bilan as any).subject || bilan.subject || "",
      statut: (bilan as any).statut || bilan.statut || "",
      etablissement: (bilan as any).etablissement || "",
    };
    const parentData = {
      prenom: (bilan.student as any)?.parent?.user?.firstName || (bilan as any)?.parentFirstName || "",
      nom: (bilan.student as any)?.parent?.user?.lastName || (bilan as any)?.parentLastName || "",
      email: (bilan as any)?.parentEmail || (bilan.student as any)?.parent?.user?.email || "",
    };
    const qcmScoresData = (bilan.qcmScores as any) || {};
    const pedagoProfileData = (bilan.pedagoProfile as any) || {};
    const preAnalyzedData = (bilan as any).preAnalyzedData || {
      IDX_AUTONOMIE: 0,
      IDX_ORGANISATION: 0,
      IDX_MOTIVATION: 0,
      IDX_STRESS: 0,
      IDX_SUSPECT_DYS: 0,
    };

    const payload = {
      eleve: eleveData,
      parent: parentData,
      qcmScores: qcmScoresData,
      pedagoProfile: pedagoProfileData,
      pre_analyzed_data: preAnalyzedData,
    };

    const client = openai();
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const decisionMatrix = `Règles de décision:\n1) Si Statut = Candidat Libre → Offre principale: Programme Odyssée Candidat Libre.\n2) Élève autonome et performant (≥70% global, ≤1 domaine faible, Autonomie ≥3.8/5, Motivation ≥3.8/5) → Offre: Nexus Cortex.\n3) Besoins ciblés (55–70%, ≤2 faibles, Motivation ≥2.8/5, Organisation ≥5/10) → Offre: Studio Flex.\n4) Axes multiples/prep intensive (40–65% et ≥2 faibles ou Contrainte temps forte) → Offre: Académies Nexus.\n5) Encadrement complet (global <55% ou Autonomie <2.5/5 ou Motivation <2.5/5 ou Organisation <4/10 ou Stress ≥4/5 ou DYS ≥2.5/4) → Offre: Programme Odyssée.\nPriorité: Candidat Libre > Encadrement Complet > Lacunes Multiples > Besoins Ciblés > Autonome.`;

    const structure = `Structure stricte (6 sections):\n1. Introduction personnalisée (utiliser \"${eleveData.prenom}\" au lieu de \"l'élève\", citer parent si connu; 2–3 phrases riches).\n2. Diagnostic académique (forces/faiblesses par domaines QCM, citer pourcentages et notions).\n3. Profil d’apprentissage (exploiter pedagoProfile et pré-analyse IDX_: style, organisation, motivation, stress, concentration, mémorisation, analyse/synthèse; citer réponses clés du Volet 2).\n4. Feuille de route 3–6 mois (planning hebdo conseillé, étapes concrètes, ressources).\n5. Recommandations d’offres (appliquer la matrice; 1 offre principale + 1–2 alternatives, justification).\n6. Conclusion motivante (adressée à ${eleveData.prenom} et rassurante pour le parent).`;

    const guidelines = `Exigences:\n- Ton premium, clair, bienveillant; ne jamais mentionner l'IA.\n- Fidélité stricte aux réponses (Volet 1 et Volet 2): reformuler mais ne pas inventer.\n- Personnalisation: remplacer \"l’élève\" par \"${eleveData.prenom}\" dans tout le texte; mentionner le parent par nom si fourni.\n- Citer explicitement des éléments du Volet 2 (organisation, difficultés, modalité, objectifs).`;

    const prompt = `Tu es un expert pédagogique de Nexus Réussite.\n${structure}\n${decisionMatrix}\n${guidelines}\nDonnées (JSON):\n${JSON.stringify(payload, null, 2)}\n`;

    const resp = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "Tu écris en français un rapport premium, clair, bienveillant et structuré (titres et sous-titres)." },
        { role: "user", content: prompt },
      ] as any,
      temperature: 0.4,
      max_tokens: 2200,
    });
    const reportText = resp.choices?.[0]?.message?.content?.trim() || "";

    await prisma.bilan.update({
      where: { id: bilan.id },
      data: { reportText, generatedAt: new Date() },
    });

    return NextResponse.json({ reportText });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erreur interne" }, { status: 500 });
  }
}
