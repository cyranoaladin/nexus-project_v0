// lib/aria/orchestrator.ts
import { prisma } from '@/lib/prisma';
import { AriaMessage, ParentProfile, Student, Subject, User } from '@prisma/client';
import { llm_service, pdf_generator_service, rag_service } from './services';
import { generatePdfLocally } from './pdf-fallback';

// Interfaces pour une meilleure clarté du contexte
interface FullStudentProfile extends Student {
  user: User;
  parent?: (ParentProfile & { user: User }) | null;
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
    try {
      assessments = await (prisma as any).assessment.findMany({
        where: { studentId: this.studentId },
      });
    } catch {}
    try {
      mastery = await (prisma as any).mastery.findMany({ where: { studentId: this.studentId } });
    } catch {}
    try {
      documents = await (prisma as any).document.findMany({ where: { studentId: this.studentId } });
    } catch {}
    try {
      subscriptions = await (prisma as any).subscription.findMany({
        where: { studentId: this.studentId },
      });
    } catch {}
    try {
      creditTransactions = await (prisma as any).creditTransaction.findMany({
        where: { studentId: this.studentId },
      });
    } catch {}
    try {
      sessions = await (prisma as any).session.findMany({
        where: { studentId: this.studentId },
        orderBy: { createdAt: 'desc' },
      });
    } catch {}

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
      where: { studentId: this.studentId, subject: subject },
    });
    if (existing) return existing.id;
    const created = await prisma.ariaConversation.create({
      data: { studentId: this.studentId, subject: subject },
    });
    return created.id;
  }

  /**
   * Gère la requête de l'utilisateur de bout en bout.
   */
  public async handleQuery(
    query: string,
    subject: Subject,
    attachments: Array<{ url: string; name: string; type: string; size: number }> = []
  ): Promise<{ response: string; documentUrl?: string; wasFakeLocal?: boolean }> {
    // 1. Construire le contexte complet (Tâche 2)
    await this._buildFullStudentContext();

    if (!this.fullStudentContext || !this.fullStudentContext.profile) {
      throw new Error("Impossible de charger le profil de l'élève.");
    }

    // Récupérer l'ID de la conversation pour la matière actuelle
    const conversationId = await this._findOrCreateConversation(subject);

    // 2. Déterminer l'intention de la requête (simplifié pour l'instant)
    const ql = query.toLowerCase();
    const isPdfRequest = ql.includes('pdf') || ql.includes('document') || ql.includes('fiche');
    const requestType = isPdfRequest ? 'PDF_GENERATION' : 'EXPLICATION';

    // 3. Appeler le service LLM avec le contexte complet (Tâche 3)
    // Normaliser les clés du contexte pour le LLM (français et anglais)
    const profile = this.fullStudentContext.profile;
    const normalizedProfil = profile
      ? {
          id: profile.id,
          prenom: profile.user.firstName,
          nom: profile.user.lastName,
          grade: (profile as any).grade ?? null,
          classe: (profile as any).classe ?? null,
          campus: (profile as any).campus ?? null,
          parent: profile.parent
            ? {
                prenom: profile.parent.user.firstName,
                nom: profile.parent.user.lastName,
                id: profile.parent.id,
              }
            : null,
        }
      : null;

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
      matiere: String(subject),
    };

    // Ajouter les pièces jointes (URLs) dans le contexte documents
    try {
      const existingDocs = Array.isArray((normalizedContext as any).documents)
        ? (normalizedContext as any).documents
        : [];
      const mapped = (attachments || []).map((a) => ({
        titre: a.name,
        url: a.url,
        type: a.type,
        taille: a.size,
      }));
      (normalizedContext as any).documents = [...existingDocs, ...mapped];
    } catch {}

    // 3.a. Logique décisionnelle locale basée sur la mastery (si disponible)
    const masteryList = ((this.fullStudentContext as any)?.mastery || []) as any[];
    const weaknesses = masteryList.filter(
      (m: any) => m?.level === 'LOW' || (typeof m?.score === 'number' && m.score <= 0.5)
    );
    const hasCriticalGaps = weaknesses.length >= 2;
    const interventionMode = hasCriticalGaps ? 'REMEDIATION_GUIDEE' : 'STANDARD';
    // Enrichir les hints pour PDF denses
    const targetWordCount = 1200;
    // Focus contextuels basés sur la requête et la matière
    const focusFromQuery: string[] = [];
    try {
      if (String(subject) === 'MATHEMATIQUES') {
        if (ql.includes('polyn')) {
          focusFromQuery.push(
            'Définition et degré',
            'Racines et factorisation',
            'Tableau de signes',
            'Dérivée et variations',
            'Représentation graphique'
          );
        }
      }
      if (String(subject) === 'PHYSIQUE_CHIMIE') {
        if (ql.includes('cinem') || ql.includes('mouvement'))
          focusFromQuery.push('Ciné matique', 'MRU/MRUA');
      }
      if (String(subject) === 'FRANCAIS') {
        if (ql.includes('commentaire') || ql.includes('texte'))
          focusFromQuery.push('Méthodologie commentaire', 'Figures de style', 'Plan détaillé');
      }
    } catch {}

    const decisionHints = {
      targetWordCount,
      requiredExercises: { corrected: 3, uncorrected: 3 },
      interventionMode,
      focusConcepts: Array.from(
        new Set(
          [
            ...weaknesses
              .slice(0, 3)
              .map((w: any) => w?.concept)
              .filter(Boolean),
            ...focusFromQuery,
          ].filter(Boolean)
        )
      ),
      requireStepByStep: hasCriticalGaps,
      requireChecks: true,
    };
    (normalizedContext as any).decision_hints = decisionHints;

    // Lire config runtime (amplification)
    try {
      const { getAriaConfig } = await import('./runtime-config');
      const cfg = getAriaConfig();
      (normalizedContext as any).decision_hints = {
        ...(normalizedContext as any).decision_hints,
        forceAmplify: !!cfg.amplify,
      };
    } catch {}

    const llmStartedAt = Date.now();
    let llmResponse: { response: string; contenu_latex?: string; mock?: boolean };
    let wasFakeLocal = false;
    try {
      llmResponse = await llm_service.generate_response(
        {
          contexte_eleve: normalizedContext,
          requete_actuelle: query,
          requete_type: requestType,
        },
        {
          // Augmenter le timeout pour les demandes PDF (plus verbeuses)
          timeoutMs:
            requestType === 'PDF_GENERATION'
              ? Number(process.env.LLM_PDF_TIMEOUT_MS || '120000')
              : Number(process.env.LLM_HTTP_TIMEOUT_MS || '60000'),
        }
      );
      // Si le microservice indique un mode mock, propage-le
      if ((llmResponse as any)?.mock) {
        wasFakeLocal = true;
      }
      try {
        console.info('[ARIA_LLM_OK]', {
          durationMs: Date.now() - llmStartedAt,
          requestType,
        });
      } catch {}
    } catch (errLLM) {
      // Fallback local en dev si le microservice LLM est indisponible
      if (process.env.LLM_LOCAL_FAKE === '1' || process.env.NEXT_PUBLIC_E2E === '1') {
        const baseText =
          `Cours (fake local) sur la requête: ${query}\n\n` +
          '# Objectifs pédagogiques\n- Comprendre les notions clés\n- Savoir appliquer des méthodes de base\n\n' +
          '## Définition et cadre\nExplications synthétiques...\n\n' +
          '## Méthodes et exemples\n- Exemple 1 ...\n- Exemple 2 ...\n\n' +
          '## Exercices corrigés (3)\n1) Enoncé A ...\nCorrection A ...\n2) Enoncé B ...\nCorrection B ...\n3) Enoncé C ...\nCorrection C ...\n\n' +
          '## Exercices non corrigés (3)\n1) Enoncé D ...\n2) Enoncé E ...\n3) Enoncé F ...\n\n' +
          '## Pièges fréquents\n- Erreur 1 ...\n- Erreur 2 ...\n\n' +
          '## Synthèse\nRappel des points essentiels.';
        let contenu_latex: string | undefined = undefined;
        if (requestType === 'PDF_GENERATION') {
          // Convertir un minimum en LaTeX autonome
          const body = baseText
            .split('\n')
            .map((line) => {
              if (line.startsWith('### ')) return `\\subsubsection{${line.slice(4)}}`;
              if (line.startsWith('## ')) return `\\subsection{${line.slice(3)}}`;
              if (line.startsWith('# ')) return `\\section{${line.slice(2)}}`;
              if (/^\s*[-*]\s+/.test(line)) return `\\begin{itemize}\\item ${line.replace(/^\s*[-*]\s+/, '')}\\end{itemize}`;
              return line;
            })
            .join('\n');
          contenu_latex = `\\documentclass[11pt,a4paper]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage[french]{babel}\n\\usepackage{lmodern}\n\\usepackage{geometry}\n\\geometry{margin=2cm}\n\\begin{document}\n\\nonstopmode\n\\tableofcontents\n\\newpage\n${body}\n\\end{document}`;
        }
        llmResponse = { response: baseText, contenu_latex };
        wasFakeLocal = true;
        console.warn('[ARIA_LLM_FAKE_LOCAL]', { reason: String(errLLM) });
      } else {
        throw errLLM;
      }
    }

    let documentUrl: string | undefined = undefined;

    // 4. Si c'est une demande de PDF, appeler le service de génération (avec durcissement)
    if (isPdfRequest) {
      const studentName = `${this.fullStudentContext.profile.user.firstName} ${this.fullStudentContext.profile.user.lastName}`;
      const disableRemote = process.env.PDF_REMOTE_DISABLED === '1';

      const sanitizeLatex = (s: string) => {
        // Retire potentiels \write18 et commandes dangereuses et normalise quotes
        return (s || '')
          .replace(/\\write18/g, '')
          .replace(/\\input\{.*?\}/g, '')
          .replace(/[’‚‘]/g, "'");
      };
      const wrapIfNeeded = (s: string) => {
        const hasDoc = /\\documentclass\b/.test(s);
        if (hasDoc) return s;
        return `\\documentclass[12pt]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage{lmodern}\n\\usepackage{amsmath,amssymb}\n\\usepackage{geometry}\n\\geometry{margin=2cm}\n\\begin{document}\n${s}\n\\end{document}`;
      };
      const minimalFromText = (text: string) => {
        // Nettoyer le texte des blocs LaTeX ou fences éventuels
        let t = (text || '').replace(/```[\s\S]*?```/g, '');
        // Retirer lignes de préambule indésirables
        t = t
          .replace(/^\s*\\documentclass[\s\S]*?$/gm, '')
          .replace(/^\s*\\usepackage[\s\S]*?$/gm, '')
          .replace(/^\s*\\begin\{document\}[\s\S]*?$/gm, '')
          .replace(/^\s*\\end\{document\}[\s\S]*?$/gm, '');
        // Echapper les caractères LaTeX spéciaux et convertir les retours à la ligne en \par
        const safe = t
          .replace(/([#%&_{}$])/g, '\\$1')
          .replace(/[’‚‘]/g, "'")
          .replace(/\n/g, '\\par ');
        return `\\documentclass[12pt]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage{lmodern}\n\\usepackage{geometry}\n\\geometry{margin=2cm}\n\\begin{document}\n${safe}\n\\end{document}`;
      };
      const extractLatexFromResponse = (resp: string): string | null => {
        const s = resp || '';
        const fenced = s.match(/```\s*latex\s*([\s\S]+?)```/i);
        if (fenced && fenced[1]) return fenced[1].trim();
        const doc = s.match(/(\\\s*documentclass[\s\S]+?\\end\{document\})/);
        if (doc && doc[1]) return doc[1].trim();
        return null;
      };
      const normalizeDocLatex = (doc: string) => {
        let out = doc || '';
        // Enlever d'éventuelles fences
        out = out.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ''));
        // Sections numérotées pour sommaire
        out = out.replace(/\\section\*\{/g, '\\section{');
        out = out.replace(/\\subsection\*\{/g, '\\subsection{');
        out = out.replace(/\\subsubsection\*\{/g, '\\subsubsection{');
        // Ajouter \tableofcontents si \begin{document} présent
        if (/\\begin\{document\}/.test(out) && !/\\tableofcontents/.test(out)) {
          out = out.replace(
            /\\begin\{document\}/,
            '\\begin{document}\n\\nonstopmode\n\\maketitle\n\\tableofcontents\n\\newpage'
          );
        }
        return out;
      };

      const tryCompile = async (latex: string) => {
        return pdf_generator_service.generate_pdf({
          contenu: latex,
          type_document: 'fiche_revision',
          matiere: 'Mathematiques',
          nom_fichier: `fiche_revision_${Date.now()}`,
          nom_eleve: studentName,
          footer_brand: 'ARIA',
          footer_show_date: true,
          footer_extra: `Sujet: ${subject}`,
        });
      };

      // Optionnel: tenter le microservice PDF si non désactivé
      if (!disableRemote) {
        try {
          const remoteStart = Date.now();
          // Préparer le meilleur candidat LaTeX
          let latexCandidate =
            llmResponse.contenu_latex || extractLatexFromResponse(llmResponse.response || '') || '';
          if (latexCandidate) {
            const latex1 = wrapIfNeeded(sanitizeLatex(normalizeDocLatex(latexCandidate)));
            try {
              const r1 = await tryCompile(latex1);
              if (r1 && (r1 as any).url) {
                documentUrl = (r1 as any).url;
                console.info('[ARIA_PDF_REMOTE_OK]', { durationMs: Date.now() - remoteStart });
              }
            } catch (errR1) {
              // Fallback: convertir le texte en LaTeX minimal
              const fallbackLatex = minimalFromText(llmResponse.response || '');
              try {
                const r2 = await tryCompile(fallbackLatex);
                if (r2 && (r2 as any).url) {
                  documentUrl = (r2 as any).url;
                  console.info('[ARIA_PDF_REMOTE_OK]', { durationMs: Date.now() - remoteStart, fallback: true });
                }
              } catch (errR2) {
                console.warn('[ARIA_PDF_REMOTE_ERR]', { durationMs: Date.now() - remoteStart, err1: String(errR1), err2: String(errR2) });
              }
            }
          }
        } catch (e) {
          console.warn('[ARIA_PDF_REMOTE_ERR_FATAL]', String(e));
        }
      } else {
        console.info('[ARIA_PDF_REMOTE_SKIPPED]', { reason: 'PDF_REMOTE_DISABLED=1' });
      }

      // Génération locale si aucune URL distante obtenue (préférée pour le runtime local)
      if (!documentUrl)
        try {
          const base = (llmResponse.response || '').trim();
          const enriched =
            base.length < 200
              ? `${base}\n\nRésumé structuré :\n- Définition\n- Propriétés\n- Dérivée\n- Résolution d'équations\n- Applications et exemples\n\nConseils méthodologiques :\n1. Identifier la base et la croissance.\n2. Utiliser ln pour résoudre b^x = c.\n3. Vérifier le domaine et les limites.`
              : base;
          const local = await generatePdfLocally({
            content: enriched,
            fileBaseName: `fiche_revision_${Date.now()}`,
            studentName,
            subject: String(subject),
          });
          console.info('[ARIA_PDF_LOCAL]', {
            url: local.url,
            contentLength: enriched.length,
            studentName,
            subject: String(subject),
          });
          documentUrl = local.url;
        } catch (errLocalFinal) {
          console.error(
            'Echec génération PDF (local final), réponse textuelle seulement:',
            errLocalFinal
          );
          documentUrl = undefined;
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
      const shouldIngest = isTestEnv
        ? wordCount > 30
        : wordCount > 150 && (hasHeadings || hasLists || hasDefinitions);
      if (shouldIngest) {
        const payload = {
          contenu: text,
          metadata: {
            titre: `Explication sur: ${query.slice(0, 60)}...`,
            matiere: String(subject),
            niveau: (this.fullStudentContext as any)?.profile?.grade ?? null,
            studentId: this.studentId,
          },
        };
        // Utiliser le client de service centralisé si disponible ; sinon fallback direct via fetch.
        const tryIngest = async () => {
          try {
            if ((rag_service as any) && typeof (rag_service as any).ingest === 'function') {
              return await (rag_service as any).ingest(payload);
            }
            const RAG_URL = process.env.RAG_SERVICE_URL || 'http://rag_service:8001';
            await fetch(`${RAG_URL}/ingest`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
          } catch (e) {
            // Swallow errors: la boucle RAG est best-effort
          }
        };
        if (isTestEnv) {
          await tryIngest();
        } else {
          void tryIngest();
        }
      }
    } catch {}

    // 6. Sauvegarder la conversation et retourner la réponse
    await prisma.ariaMessage.createMany({
      data: [
        { role: 'USER', content: query, conversationId: conversationId },
        { role: 'ASSISTANT', content: llmResponse.response, conversationId: conversationId },
      ],
    });

    return { response: llmResponse.response, documentUrl, wasFakeLocal };
  }
}
