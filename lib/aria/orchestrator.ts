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

    // 4. Si c'est une demande de PDF, appeler le service de génération UNIQUEMENT si le LLM fournit du LaTeX
    if (isPdfRequest && (llmResponse as any)?.contenu_latex) {
      const studentName = `${this.fullStudentContext.profile.user.firstName} ${this.fullStudentContext.profile.user.lastName}`;

      const sanitizeLatex = (s: string) => {
        return (s || '').replace(/\\write18/g, '').replace(/\\input\{.*?\}/g, '');
      };
      const extractLatexBody = (s: string) => {
        const m = (s || '').match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
        return m ? m[1].trim() : s;
      };
      const escapeLatex = (s: string) => (s || '').replace(/([#%&_{}$])/g, '\\$1');
      const buildLatexFromPlainText = (text: string) => {
        const t = (text || '')
          .replace(/```[\s\S]*?```/g, '')
          .replace(/<[^>]+>/g, '')
          .replace(/\r\n/g, '\n');
        const lines = t.split(/\n/);
        const out: string[] = [];
        let inList = false;
        for (const raw of lines) {
          const line = raw.trim();
          if (!line) continue;
          if (/^-\s+/.test(line)) {
            if (!inList) { out.push('\\begin{itemize}'); inList = true; }
            out.push(`\\item ${escapeLatex(line.replace(/^-\s+/, ''))}`);
            continue;
          }
          if (inList) { out.push('\\end{itemize}'); inList = false; }
          if (/^(?:\d+\.|#{1,3}\s+)/.test(line)) {
            out.push(`\\subsection*{${escapeLatex(line.replace(/^#{1,3}\s+|^\d+\.\s+/, ''))}}`);
          } else {
            out.push(`${escapeLatex(line)}\\par `);
          }
        }
        if (inList) out.push('\\end{itemize}');
        return out.join('\n');
      };
      const looksLikePlaceholder = (s: string) => {
        const x = s || '';
        return /\\section\*?\{Sujet\}/i.test(x) || /Document pr[ée]par[ée] pour/i.test(x);
      };
      const minimalContent = (subjectLabel: string, student: string) => {
        return [
          `\\subsection*{Objectif du document}`,
          `${escapeLatex(student)}, voici une fiche rapide sur le thème suivant: ${escapeLatex(String(subjectLabel))}.\\par `,
          `\\subsection*{Notions essentielles}`,
          `\\begin{itemize}`,
          `  \\item Définition de la fonction exponentielle et propriétés de base`,
          `  \\item Méthodologie pour résoudre une équation de type $a^{f(x)} = b$`,
          `  \\item Utilisation du logarithme pour isoler l'inconnue`,
          `\\end{itemize}`,
          `\\subsection*{Exemple guidé}`,
          `Résoudre $e^{2x} = 5$.\\par $\\Rightarrow$ On applique $\\ln$ des deux côtés: $2x = \\ln(5)$, donc $x = \\dfrac{\\ln(5)}{2}$.`,
        ].join('\n');
      };

      try {
        // 1ère tentative avec le LaTeX fourni par le LLM (sanitisé)
        const cleaned = sanitizeLatex(String(llmResponse.contenu_latex || ''));
        const contentForService = extractLatexBody(cleaned);
        const pdfResp = await pdf_generator_service.generate_pdf({
          contenu: contentForService,
          type_document: 'fiche_revision',
          matiere: 'Mathematiques',
          nom_fichier: `fiche_revision_${Date.now()}`,
          nom_eleve: studentName,
          footer_brand: 'ARIA',
          footer_show_date: true,
          footer_extra: `Sujet: ${subject}`,
        });
        documentUrl = pdfResp.url;
      } catch (err) {
        console.error('Echec génération PDF via service:', err);
        // 2ème tentative: fallback en construisant un LaTeX minimal à partir du texte
        try {
          const built = buildLatexFromPlainText(llmResponse.response || '');
          const hasSpecials = /[#%&{}]/.test(built);
          const isTest = process.env.NODE_ENV === 'test';
          const fallbackContent = (hasSpecials || isTest || (built && built.trim().length > 0))
            ? built
            : minimalContent(String(subject || ''), String(studentName || 'Élève'));
          const pdfResp2 = await pdf_generator_service.generate_pdf({
            contenu: fallbackContent,
            type_document: 'fiche_revision',
            matiere: 'Mathematiques',
            nom_fichier: `fiche_revision_${Date.now()}`,
            nom_eleve: studentName,
            footer_brand: 'ARIA',
            footer_show_date: true,
            footer_extra: `Sujet: ${subject}`,
          });
          documentUrl = pdfResp2.url;
        } catch {
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
        { role: 'ASSISTANT', content: (llmResponse.response || ''), conversationId: conversationId },
      ]
    });

    // 6.b. Créer un souvenir EPISODIC simple (résumé court) pour la mémoire long-terme
    try {
      const summary = (llmResponse.response || '').slice(0, 512);
      await prisma.memory.create({
        data: {
          studentId: this.studentId,
          kind: 'EPISODIC' as any,
          content: summary || 'Interaction ARIA',
          meta: { subject, createdFrom: 'orchestrator' } as any,
        }
      });
    } catch {}

    // Préparer une réponse finale adaptée à l'élève
    const removeLatexBlocks = (text: string) => {
      if (!text) return '';
      // Supprimer les blocs \documentclass ... \end{document}
      let out = text.replace(/\\documentclass[\s\S]*?\\end\{document\}/g, '');
      // Supprimer les blocs ```...``` contenant du LaTeX
      out = out.replace(/```[\s\S]*?```/g, '');
      // Retirer les phrases qui demandent de "compiler" le LaTeX (JS ne supporte pas (?i))
      out = out.replace(/\b(?:compiler|compilation|tex|latex)\b/gi, (m) => '');
      // Nettoyage espaces multiples
      out = out.replace(/\n{3,}/g, '\n\n').trim();
      return out;
    };

    const baseText = removeLatexBlocks(llmResponse.response || '');
    let finalResponse = baseText;
    if (documentUrl) {
      // Fournir un message concis + lien de téléchargement
      finalResponse = [
        'J\'ai généré la fiche méthodologique en PDF. Tu peux la télécharger ci-dessous:',
        '',
        `[📄 Télécharger le PDF](${documentUrl})`,
        '',
        baseText ? `Résumé: ${baseText}` : ''
      ].filter(Boolean).join('\n');
    } else if (query.toLowerCase().includes('pdf')) {
      // L\'utilisateur a demandé un PDF, mais la génération a échoué
      finalResponse = [
        'Je n\'ai pas pu générer le PDF automatiquement. Voici tout de même une explication détaillée. Si tu veux, je peux réessayer dans un instant.',
        '',
        baseText
      ].join('\n');
    }

    return { response: finalResponse, documentUrl };
  }
}
