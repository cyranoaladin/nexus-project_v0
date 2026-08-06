/** Data contract retained for the legacy parent-bilan route. Rendering is centralized in bilan-parent-pdfkit.ts. */
export interface BilanParentPDFData {
  studentName: string;
  stageTitle: string;
  subjectLabel: string;
  coachName: string | null;
  publishedAt: string;
  globalScore: number | null;
  parentsMarkdown: string;
}
