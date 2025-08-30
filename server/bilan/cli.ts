/**
 * CLI pour générer un bilan premium en ligne de commande.
 *
 * Usage:
 * tsx server/bilan/cli.ts --studentId=<ID_ETUDIANT> --variant=<parent|eleve>
 */
import { prisma } from "@/lib/prisma";
import { generateBilan, renderLatex, compileLatex } from "@/server/bilan/orchestrator";
import { LocalStorage } from "@/lib/storage";
import path from "path";

async function main() {
  const args = process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.split('=');
    acc[key.replace('--', '')] = value;
    return acc;
  }, {} as Record<string, string>);

  const { studentId, variant } = args;

  if (!studentId || !variant || !['parent', 'eleve'].includes(variant)) {
    console.error("Usage: tsx server/bilan/cli.ts --studentId=<ID> --variant=<parent|eleve>");
    process.exit(1);
  }

  console.log(`Génération du bilan pour l'étudiant ${studentId}, variante ${variant}...`);

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) {
    console.error("Étudiant non trouvé.");
    process.exit(1);
  }
  
  // Données factices pour QCM et Volet 2
  const qcm = {
      total: 32, max: 40, scoreGlobalPct: 80, weakDomainsCount: 1,
      domains: [{ domain: 'Algèbre', points: 8, max: 10, masteryPct: 80, note: 'Bonne maîtrise' }],
  };
  const volet2 = {
      indices: { AUTONOMIE: 3, ORGANISATION: 4, MOTIVATION: 5, STRESS: 2, SUSPECT_DYS: 1 },
      portraitText: "Élève sérieux via CLI.", badges: ["CLI", "Test"],
      radarPath: path.resolve(process.cwd(), "public/images/sample-radar.png"),
  };

  try {
    const out = await generateBilan({
      variant: variant as 'parent' | 'eleve',
      student: {
        name: `${student.firstName} ${student.lastName}`,
        level: student.grade || 'N/A', subjects: 'N/A', status: 'Scolarisé',
      },
      qcm,
      volet2,
    });
    
    const rows = out.table_domain_rows.map(r => `${r.domain} & ${r.points}/${r.max} & ${Math.round(r.masteryPct)}\\% & ${r.remark ?? ''} \\\\`).join("\\n");
    const view = {
      student_name: `${student.firstName} ${student.lastName}`,
      level: student.grade, subjects: 'N/A', status: 'Scolarisé',
      qcm_total: qcm.total, qcm_max: qcm.max, score_global: Math.round(qcm.scoreGlobalPct),
      ...out,
      table_domain_rows: rows,
      fig_radar_path: volet2.radarPath,
      badges_tex: (volet2.badges || []).map((b: string) => `\\badge{${b}}`).join(" "),
    };
    const tex = renderLatex(view);

    const pdfPath = compileLatex(tex, `./.build/cli/${student.id}/${variant}`);
    console.log(`PDF compilé avec succès: ${pdfPath}`);
    
    const storage = new LocalStorage();
    const pdfUrl = await storage.put(pdfPath, `cli/${student.id}/${variant}/bilan.pdf`);
    console.log(`PDF stocké à l'URL: ${pdfUrl}`);

    const record = await prisma.bilanPremium.create({
      data: {
        studentId: student.id,
        variant: variant === "parent" ? "PARENT" : "ELEVE", status: "READY",
        meta: qcm as any, pdfUrl,
      },
    });
    console.log(`Enregistrement Bilan créé avec l'ID: ${record.id}`);

  } catch (error) {
    console.error("La génération du bilan a échoué:", error);
    process.exit(1);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});



