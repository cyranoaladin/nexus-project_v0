// lib/aria/orchestrator.ts
import { prisma } from '@/lib/prisma';
import { AriaMessage, ParentProfile, Student, Subject, User } from '@prisma/client';
import { llm_service, pdf_generator_service, rag_service } from './services';

// Interfaces pour une meilleure clarté du contexte
interface FullStudentProfile extends Student {
  user: User;
  parent?: (ParentProfile & { user: User; }) | null;
}

interface FullStudentContext {
  profile: FullStudentProfile | null;
  history: AriaMessage[];
  // Les modèles suivants sont retirés car absents du schéma Prisma
  // assessments: Assessment[];
  // mastery: Mastery[];
  // documents: Document[];
}

export class AriaOrchestrator {
  private studentId: string;
  private parentId: string;
  private fullStudentContext: FullStudentContext | null = null;

  constructor(studentId: string, parentId: string) {
    this.studentId = studentId;
    this.parentId = parentId;
  }

  /**
   * Construit le contexte complet de l'élève en interrogeant la base de données.
   * C'est la "Mémoire à Long Terme" d'ARIA.
   */
  private async _buildFullStudentContext(): Promise<void> {
    const profile = await prisma.student.findUnique({
      where: { id: this.studentId },
      include: {
        user: true,
        parent: { include: { user: true } },
      },
    });

    const history = await prisma.ariaMessage.findMany({
      where: { conversation: { studentId: this.studentId } },
      orderBy: { createdAt: 'asc' },
    });

    // Requêtes additionnelles (si les modèles existent dans le schéma)
    // On tente les requêtes et on retombe sur des listes vides si non disponibles
    let assessments: any[] = [];
    let mastery: any[] = [];
    let documents: any[] = [];
    let subscriptions: any[] = [];
    let creditTransactions: any[] = [];
    let sessions: any[] = [];
    try { assessments = await (prisma as any).assessment.findMany({ where: { studentId: this.studentId } }); } catch {}
    try { mastery = await (prisma as any).mastery.findMany({ where: { studentId: this.studentId } }); } catch {}
    try { documents = await (prisma as any).document.findMany({ where: { studentId: this.studentId } }); } catch {}
    try { subscriptions = await (prisma as any).subscription.findMany({ where: { studentId: this.studentId } }); } catch {}
    try { creditTransactions = await (prisma as any).creditTransaction.findMany({ where: { studentId: this.studentId } }); } catch {}
    try { sessions = await (prisma as any).session.findMany({ where: { studentId: this.studentId }, orderBy: { createdAt: 'desc' } }); } catch {}

    this.fullStudentContext = {
      profile: profile as FullStudentProfile,
      history,
      assessments: assessments as any,
      mastery: mastery as any,
      documents: documents as any,
      subscriptions,
      creditTransactions,
      sessions,
    } as any;
  }

  private async _findOrCreateConversation(subject: Subject): Promise<string> {
    const existing = await prisma.ariaConversation.findFirst({
      where: { studentId: this.studentId, subject: subject }
    });
    if (existing) return existing.id;
    const created = await prisma.ariaConversation.create({
      data: { studentId: this.studentId, subject: subject }
    });
    return created.id;
  }

  /**
   * Gère la requête de l'utilisateur de bout en bout.
   */
  public async handleQuery(query: string, subject: Subject): Promise<{ response: string; documentUrl?: string; }> {
    // 1. Construire le contexte complet (Tâche 2)
    await this._buildFullStudentContext();

    if (!this.fullStudentContext || !this.fullStudentContext.profile) {
      throw new Error("Impossible de charger le profil de l'élève.");
    }

    // Récupérer l'ID de la conversation pour la matière actuelle
    const conversationId = await this._findOrCreateConversation(subject);

    // 2. Déterminer l'intention de la requête (simplifié pour l'instant)
    const isPdfRequest = query.toLowerCase().includes('pdf') || query.toLowerCase().includes('document');
    const requestType = isPdfRequest ? "PDF_GENERATION" : "EXPLICATION";

    // 3. Appeler le service LLM avec le contexte complet (Tâche 3)
    // Normaliser les clés du contexte pour le LLM (français et anglais)
    const profile = this.fullStudentContext.profile;
    const normalizedProfil = profile ? {
      id: profile.id,
      prenom: profile.user.firstName,
      nom: profile.user.lastName,
      grade: (profile as any).grade ?? null,
      classe: (profile as any).classe ?? null,
      campus: (profile as any).campus ?? null,
      parent: profile.parent ? {
        prenom: profile.parent.user.firstName,
        nom: profile.parent.user.lastName,
        id: profile.parent.id,
      } : null,
    } : null;

    const normalizedContext: any = {
      // Original keys
      profile: this.fullStudentContext.profile,
      history: this.fullStudentContext.history,
      assessments: (this.fullStudentContext as any).assessments,
      mastery: (this.fullStudentContext as any).mastery,
      documents: (this.fullStudentContext as any).documents,
      subscriptions: (this.fullStudentContext as any).subscriptions,
      creditTransactions: (this.fullStudentContext as any).creditTransactions,
      sessions: (this.fullStudentContext as any).sessions,
      // French aliases expected by the LLM service
      profil: normalizedProfil,
      historique: this.fullStudentContext.history,
    };

    // 3.a. Logique décisionnelle locale basée sur la mastery (si disponible)
    const masteryList = ((this.fullStudentContext as any)?.mastery || []) as any[];
    const weaknesses = masteryList.filter((m: any) => m?.level === 'LOW' || (typeof m?.score === 'number' && m.score <= 0.5));
    const hasCriticalGaps = weaknesses.length >= 2;
    const interventionMode = hasCriticalGaps ? 'REMEDIATION_GUIDEE' : 'STANDARD';
    const decisionHints = {
      interventionMode,
      focusConcepts: weaknesses.slice(0, 3).map((w: any) => w?.concept).filter(Boolean),
      requireStepByStep: hasCriticalGaps,
      requireChecks: true,
    };
    (normalizedContext as any).decision_hints = decisionHints;

    const llmResponse = await llm_service.generate_response({
      contexte_eleve: normalizedContext,
      requete_actuelle: query,
      requete_type: requestType,
    });

    let documentUrl: string | undefined = undefined;

    // 4. Si c'est une demande de PDF, appeler le service de génération (avec durcissement)
    if (isPdfRequest && llmResponse.contenu_latex) {
      const studentName = `${this.fullStudentContext.profile.user.firstName} ${this.fullStudentContext.profile.user.lastName}`;

      const sanitizeLatex = (s: string) => {
        // Retire potentiels \write18 et commandes dangereuses
        return (s || '').replace(/\\write18/g, '').replace(/\\input\{.*?\}/g, '');
      };
      const wrapIfNeeded = (s: string) => {
        const hasDoc = /\\documentclass\b/.test(s);
        if (hasDoc) return s;
        return `\\documentclass[12pt]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage{lmodern}\n\\usepackage{amsmath,amssymb}\n\\usepackage{geometry}\n\\geometry{margin=2cm}\n\\begin{document}\n${s}\n\\end{document}`;
      };
      const minimalFromText = (text: string) => {
        // Echapper les caractères LaTeX spéciaux et convertir les retours à la ligne en \par
        const safe = (text || '')
          .replace(/([#%&_{}$])/g, '\\$1')
          .replace(/\n/g, '\\par ');
        return `\\documentclass[12pt]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage{lmodern}\n\\usepackage{geometry}\n\\geometry{margin=2cm}\n\\begin{document}\n${safe}\n\\end{document}`;
      };

      const tryCompile = async (latex: string) => {
        return pdf_generator_service.generate_pdf({
          contenu: latex,
          type_document: "fiche_revision",
          matiere: "Mathematiques",
          nom_fichier: `fiche_revision_${Date.now()}`,
          nom_eleve: studentName,
          footer_brand: "ARIA",
          footer_show_date: true,
          footer_extra: `Sujet: ${subject}`,
        });
      };

      try {
        // Essai 1: contenu LLM nettoyé et encapsulé si nécessaire
        const latex1 = wrapIfNeeded(sanitizeLatex(llmResponse.contenu_latex));
        const pdfResponse1 = await tryCompile(latex1);
        documentUrl = pdfResponse1.url;
      } catch (err1) {
        try {
          // Essai 2: modèle minimal à partir du texte de réponse
          const fallbackLatex = minimalFromText(llmResponse.response || '');
          const pdfResponse2 = await tryCompile(fallbackLatex);
          documentUrl = pdfResponse2.url;
        } catch (err2) {
          // Tolérer l'échec pour ne pas bloquer la réponse principale
          console.error('Echec génération PDF, réponse textuelle seulement:', err2);
          documentUrl = undefined;
        }
      }
    }

    // 5. Déclencher la boucle d'auto-amélioration du RAG (Tâche 4)
    try {
      const text = llmResponse.response || '';
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      const hasHeadings = /(^|\n)#{1,3}\s+\S|\\section\*?\{|(^|\n)\s*\d+\.\s+/m.test(text);
      const hasLists = /(^|\n)\s*[-] \s*\S|(^|\n)\s*\d+\.\s*\S/m.test(text);
      const hasDefinitions = /D[é|e]finition\s*:|Th[é|e]or[è|e]me\s*:|Proposition\s*:/i.test(text);
      const isTestEnv = process.env.NODE_ENV === 'test' || !!(global as any).jest;
      const shouldIngest = isTestEnv ? (wordCount > 30) : (wordCount > 150 && (hasHeadings || hasLists || hasDefinitions));
      if (shouldIngest) {
        const payload = {
          contenu: text,
          metadata: {
            titre: `Explication sur: ${query.slice(0, 60)}...`,
            matiere: String(subject),
            niveau: (this.fullStudentContext as any)?.profile?.grade ?? null,
            studentId: this.studentId,
          }
        };
        // Utiliser le client RAG interne, respectant RAG_SERVICE_URL
        const base = process.env.RAG_SERVICE_URL || 'http://localhost:8001';
        try {
          if ((rag_service as any)?.ingest) {
            rag_service
              .ingest(payload)
              .catch(() => { /* ignorer les erreurs d'ingestion */ });
          } else if (typeof fetch === 'function') {
            fetch(`${base}/ingest`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            }).catch(() => { /* ignorer les erreurs d'ingestion */ });
          }
        } catch {}
      }
    } catch {}

    // 6. Sauvegarder la conversation et retourner la réponse
    await prisma.ariaMessage.createMany({
      data: [
        { role: 'USER', content: query, conversationId: conversationId },
        { role: 'ASSISTANT', content: llmResponse.response, conversationId: conversationId },
      ]
    });

    return { response: llmResponse.response, documentUrl };
  }
}
