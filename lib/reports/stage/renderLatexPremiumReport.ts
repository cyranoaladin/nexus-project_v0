import type { PremiumPedagogicalReportJson } from './validateGeneratedReportJson';

function escapeLatex(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/&/g, '\\&')
    .replace(/#/g, '\\#')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\$/g, '\\$')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/~/g, '\\textasciitilde{}');
}

export function renderLatexPremiumReport(data: PremiumPedagogicalReportJson): string {
  const {
    cover,
    executiveSummary,
    competenceReview,
    studentPosture,
    actionPlan,
    parentSection,
  } = data;

  const header = `\\documentclass[11pt,a4paper]{article}

\\usepackage[a4paper,margin=1.7cm]{geometry}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[french]{babel}
\\usepackage{lmodern}
\\usepackage{microtype}
\\usepackage{xcolor}
\\usepackage{tabularx}
\\usepackage{array}
\\usepackage{enumitem}
\\usepackage{tcolorbox}
\\usepackage{titlesec}
\\usepackage{fancyhdr}
\\usepackage{lastpage}
\\usepackage{hyperref}

\\definecolor{NexusBlue}{HTML}{00D4FF}
\\definecolor{NexusViolet}{HTML}{7C3AED}
\\definecolor{NexusGold}{HTML}{F59E0B}
\\definecolor{NexusDark}{HTML}{0B1020}
\\definecolor{NexusSoft}{HTML}{F6F8FB}
\\definecolor{NexusGreen}{HTML}{10B981}
\\definecolor{NexusRed}{HTML}{EF4444}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyhead[L]{\\textcolor{NexusDark}{\\textbf{Nexus Réussite}}}
\\fancyhead[R]{\\textcolor{NexusDark}{Bilan Pédagogique Personnalisé}}
\\fancyfoot[C]{\\thepage\\ / \\pageref{LastPage}}

\\begin{document}
`;

  // Cover Page
  const coverPage = `
\\begin{titlepage}
  \\centering
  \\vspace*{2cm}
  {\\Huge \\textbf{\\textcolor{NexusViolet}{Nexus Réussite}}} \\\\
  \\vspace{1cm}
  {\\Large \\textbf{\\textcolor{NexusDark}{${escapeLatex(cover.title)}}}} \\\\
  \\vspace{0.5cm}
  {\\large \\textcolor{NexusDark}{${escapeLatex(cover.subtitle)}}} \\\\
  \\vspace{2cm}

  \\begin{tcolorbox}[colback=NexusSoft,colframe=NexusViolet,arc=10pt,width=12cm]
    \\centering
    \\vspace{0.5cm}
    {\\large \\textbf{Élève :}} \\\\
    {\\Large \\textbf{${escapeLatex(cover.studentName)}}} \\\\
    \\vspace{0.5cm}
    {\\textbf{Matière :}} ${escapeLatex(cover.subjectLabel)} \\\\
    {\\textbf{Stage :}} ${escapeLatex(cover.stageLabel)} \\\\
    \\vspace{0.5cm}
  \\end{tcolorbox}

  \\vfill
  {\\small Document généré automatiquement à partir des bilans élève et coach validés.} \\\\
  {\\small \\textbf{Confidentiel} - Réservé à l'usage des familles et de l'équipe pédagogique.}
\\end{titlepage}

\\newpage
`;

  // Page 2 — Synthèse exécutive
  const summaryPage = `
\\section*{\\textcolor{NexusViolet}{1. Synthèse Exécutive}}

\\begin{tcolorbox}[colback=NexusSoft,colframe=NexusBlue,title=\\textbf{Profil observé},arc=5pt]
  ${escapeLatex(executiveSummary.profileSummary)}
\\end{tcolorbox}

\\vspace{0.5cm}

\\begin{minipage}[t]{0.48\\textwidth}
  \\begin{tcolorbox}[colback=NexusSoft,colframe=NexusGreen,title=\\textbf{Forces principales},arc=5pt]
    \\begin{itemize}[leftmargin=*]
      ${executiveSummary.keyStrengths.map(s => `\\item ${escapeLatex(s)}`).join('\n')}
    \\end{itemize}
  \\end{tcolorbox}
\\end{minipage}
\\hfill
\\begin{minipage}[t]{0.48\\textwidth}
  \\begin{tcolorbox}[colback=NexusSoft,colframe=NexusRed,title=\\textbf{Points de vigilance},arc=5pt]
    \\begin{itemize}[leftmargin=*]
      ${executiveSummary.keyRisks.map(r => `\\item ${escapeLatex(r)}`).join('\n')}
    \\end{itemize}
  \\end{tcolorbox}
\\end{minipage}

\\vspace{0.5cm}

\\begin{tcolorbox}[colback=NexusSoft,colframe=NexusGold,title=\\textbf{Priorités pour l'élève},arc=5pt]
  ${escapeLatex(executiveSummary.priorityMessageForStudent)}
\\end{tcolorbox}

\\newpage
`;

  // Page 3 — Compétences
  const compLines = competenceReview.map(c => `
\\begin{tcolorbox}[colback=NexusSoft,colframe=NexusViolet,title=\\textbf{${escapeLatex(c.domain)} --- Niveau : ${escapeLatex(c.level)}},arc=5pt]
  \\textbf{Observations :} \\\\
  \\begin{itemize}[leftmargin=*,noitemsep]
    ${c.evidence.map(e => `\\item ${escapeLatex(e)}`).join('\n')}
  \\end{itemize}
  \\vspace{0.2cm}
  \\textbf{Analyse :} ${escapeLatex(c.analysis)} \\\\
  \\vspace{0.2cm}
  \\textbf{Recommandation :} ${escapeLatex(c.recommendation)}
\\end{tcolorbox}
`).join('\n');

  const compPage = `
\\section*{\\textcolor{NexusViolet}{2. Analyse par Domaine de Compétences}}
${compLines}

\\newpage
`;

  // Page 4 — Posture & Actions
  const actionPage = `
\\section*{\\textcolor{NexusViolet}{3. Posture de l'élève \\& Plan d'Action}}

\\begin{tcolorbox}[colback=NexusSoft,colframe=NexusBlue,title=\\textbf{Rapport à l'effort \\& Autonomie},arc=5pt]
  \\textbf{Confiance :} ${escapeLatex(studentPosture.confidence)} \\\\
  \\textbf{Autonomie :} ${escapeLatex(studentPosture.autonomy)} \\\\
  \\textbf{Méthode de travail :} ${escapeLatex(studentPosture.workingMethod)} \\\\
  \\vspace{0.2cm}
  \\textbf{Points d'attention :} \\\\
  \\begin{itemize}[leftmargin=*,noitemsep]
    ${studentPosture.attentionPoints.map(a => `\\item ${escapeLatex(a)}`).join('\n')}
  \\end{itemize}
\\end{tcolorbox}

\\vspace{0.5cm}

\\begin{tcolorbox}[colback=NexusSoft,colframe=NexusGold,title=\\textbf{Plan d'Action},arc=5pt]
  \\textbf{Dans les 7 prochains jours :} \\\\
  \\begin{itemize}[leftmargin=*,noitemsep]
    ${actionPlan.next7Days.map(a => `\\item ${escapeLatex(a)}`).join('\n')}
  \\end{itemize}
  \\vspace{0.2cm}
  \\textbf{Dans les 30 prochains jours :} \\\\
  \\begin{itemize}[leftmargin=*,noitemsep]
    ${actionPlan.next30Days.map(a => `\\item ${escapeLatex(a)}`).join('\n')}
  \\end{itemize}
  \\vspace{0.2cm}
  \\textbf{Avant les examens :} \\\\
  \\begin{itemize}[leftmargin=*,noitemsep]
    ${actionPlan.beforeExam.map(a => `\\item ${escapeLatex(a)}`).join('\n')}
  \\end{itemize}
\\end{tcolorbox}

\\vspace{0.5cm}

\\begin{tcolorbox}[colback=NexusSoft,colframe=NexusViolet,title=\\textbf{Conseils aux parents},arc=5pt]
  ${escapeLatex(parentSection.reassuringSummary)}
  \\vspace{0.2cm}
  \\begin{itemize}[leftmargin=*,noitemsep]
    ${parentSection.concreteSupportAdvice.map(a => `\\item ${escapeLatex(a)}`).join('\n')}
  \\end{itemize}
\\end{tcolorbox}

\\end{document}
`;

  return header + coverPage + summaryPage + compPage + actionPage;
}
