// ═══════════════════════════════════════════════════════════════════════════════
// NPC AI - Prompts for Each Analysis Type
// Structured prompts for consistent AI outputs
// ═══════════════════════════════════════════════════════════════════════════════

import { Subject, GradeLevel } from '@prisma/client';

// ─── System Prompts ───

export const SYSTEM_CONTEXT = `Tu es Nexus Pédagogie, un système expert d'analyse de copies pour l'enseignement secondaire français.

PRINCIPES DIRECTEURS:
- Analyse constructive et bienveillante
- Focus sur la progression, pas la punition
- Recommandations concrètes et actionnables
- Langage accessible au lycéen (évite le jargon inutile)
- Respect du programme officiel de l'Éducation Nationale`;

// ─── Pedagogical Diagnosis Prompt ───

export interface DiagnosisPromptParams {
  subject: Subject;
  gradeLevel: GradeLevel | null | undefined;
  ocrText: string;
  pageCount: number;
  title?: string;
  description?: string;
}

export function buildDiagnosisPrompt(params: DiagnosisPromptParams): string {
  return `${SYSTEM_CONTEXT}

ANALYSE DEMANDÉE: Diagnostic pédagogique complet

CONTEXTE:
- Matière: ${params.subject}
- Niveau: ${params.gradeLevel}
- Titre: ${params.title || 'Non spécifié'}
- Nombre de pages: ${params.pageCount}
- Description: ${params.description || 'Non spécifiée'}

TEXTE DE LA COPIE (OCR):
---
${params.ocrText.slice(0, 8000)}
---

INSTRUCTIONS:
1. Analyse le contenu en profondeur
2. Identifie les forces et faiblesses pédagogiques
3. Évalue le niveau global de maîtrise
4. Propose des recommandations prioritaires

FORMAT DE RÉPONSE (JSON strict):
{
  "summary": "Analyse globale en 3-4 phrases",
  "overallLevel": "beginner|developing|proficient|advanced|expert",
  "confidenceScore": 0.85,
  "strengths": [
    {
      "title": "Titre court",
      "description": "Description détaillée",
      "evidence": "Exemple concret dans la copie"
    }
  ],
  "weaknesses": [
    {
      "title": "Titre court",
      "description": "Description détaillée",
      "severity": "low|medium|high|critical",
      "evidence": "Exemple concret"
    }
  ],
  "keyRecommendations": ["Recommandation 1", "Recommandation 2"]
}`;
}

// ─── Competence Matrix Prompt ───

export interface MatrixPromptParams {
  subject: Subject;
  gradeLevel: GradeLevel;
  ocrText: string;
  diagnostic: {
    strengths: Array<{ title: string }>;
    weaknesses: Array<{ title: string; severity: string }>;
    overallLevel: string;
  };
}

export function buildMatrixPrompt(params: MatrixPromptParams): string {
  const competenceBlocks = getCompetenceBlocks(params.subject, params.gradeLevel);

  return `${SYSTEM_CONTEXT}

ANALYSE DEMANDÉE: Matrice de compétences détaillée

CONTEXTE:
- Matière: ${params.subject}
- Niveau: ${params.gradeLevel}
- Niveau global estimé: ${params.diagnostic.overallLevel}

BLOCS DE COMPÉTENCES À ÉVALUER:
${competenceBlocks.map(b => `- ${b.code}: ${b.name}`).join('\n')}

TEXTE DE LA COPIE:
---
${params.ocrText.slice(0, 6000)}
---

INSTRUCTIONS:
1. Évalue chaque compétence sur 100 points
2. Détermine le niveau: not_acquired (<50), partially_acquired (50-69), acquired (70-84), mastered (≥85)
3. Justifie chaque score avec des preuves de la copie
4. Calcule le score global pondéré

FORMAT DE RÉPONSE (JSON strict):
{
  "blocks": [
    {
      "code": "CODE_BLOC",
      "name": "Nom du bloc",
      "items": [
        {
          "name": "Nom compétence",
          "score": 75,
          "maxScore": 100,
          "level": "acquired",
          "evidence": "Preuve dans la copie",
          "recommendations": ["Rec 1"]
        }
      ]
    }
  ],
  "globalScore": 72.5,
  "globalLevel": "acquired"
}`;
}

// ─── Remediation Roadmap Prompt ───

export interface RoadmapPromptParams {
  subject: Subject;
  gradeLevel: GradeLevel;
  diagnostic: {
    weaknesses: Array<{ title: string; severity: string }>;
    keyRecommendations: string[];
  };
  competenceMatrix: {
    blocks: Array<{
      items: Array<{
        name: string;
        level: string;
        score: number;
      }>;
    }>;
    globalScore: number;
  };
  studentName?: string;
}

export function buildRoadmapPrompt(params: RoadmapPromptParams): string {
  const weakCompetences = params.competenceMatrix.blocks
    .flatMap(b => b.items)
    .filter(i => i.level === 'not_acquired' || i.level === 'partially_acquired')
    .map(i => i.name);

  return `${SYSTEM_CONTEXT}

ANALYSE DEMANDÉE: Plan de remédiation personnalisé

CONTEXTE:
- Matière: ${params.subject}
- Niveau: ${params.gradeLevel}
- Score global: ${params.competenceMatrix.globalScore}/100
- Points faibles identifiés: ${weakCompetences.join(', ') || 'À déterminer'}

RECOMMANDATIONS PRIORITAIRES:
${params.diagnostic.keyRecommendations.map(r => `- ${r}`).join('\n')}

INSTRUCTIONS:
1. Crée un plan progressif et réaliste
2. 5-15 tâches ordonnées par priorité
3. Chaque tâche doit être actionnable et mesurable
4. Inclure des ressources concrètes (exercices, vidéos, fiches)
5. Estimations de temps réalistes (pas plus de 2h par séquence)

FORMAT DE RÉPONSE (JSON strict):
{
  "title": "Titre accrocheur du parcours",
  "description": "Description motivante de 2-3 phrases",
  "estimatedTotalDuration": "X heures sur Y semaines",
  "recommendedPace": "intensive|regular|relaxed",
  "difficultyLevel": "beginner|intermediate|advanced",
  "tasks": [
    {
      "id": "task-1",
      "title": "Titre actionnable",
      "description": "Description détaillée",
      "type": "knowledge_gap|skill_practice|method_learning|deep_dive|consolidation",
      "estimatedDuration": "30 min",
      "difficultyLevel": "beginner",
      "resources": [
        {"type": "exercise", "title": "Exercice recommandé"}
      ],
      "prerequisiteTaskIds": [],
      "targetCompetences": ["Compétence ciblée"]
    }
  ]
}`;
}

// ─── Mentor Advice Prompt ───

export interface MentorPromptParams {
  studentName: string;
  subject: Subject;
  diagnostic: {
    summary: string;
    overallLevel: string;
    strengths: Array<{ title: string }>;
    weaknesses: Array<{ title: string }>;
  };
  competenceMatrix: {
    globalScore: number;
  };
}

export function buildMentorPrompt(params: MentorPromptParams): string {
  return `${SYSTEM_CONTEXT}

RÔLE: Mentor bienveillant et encourageant

CONTEXTE:
- Élève: ${params.studentName}
- Matière: ${params.subject}
- Score: ${params.competenceMatrix.globalScore}/100
- Niveau: ${params.diagnostic.overallLevel}

POINTS FORTS:
${params.diagnostic.strengths.map(s => `- ${s.title}`).join('\n')}

POINTS À TRAVAILLER:
${params.diagnostic.weaknesses.map(w => `- ${w.title}`).join('\n')}

ANALYSE GLOBALE:
${params.diagnostic.summary}

INSTRUCTIONS:
1. Adopte un ton chaleureux et encourageant
2. Mentionne spécifiquement les forces de l'élève
3. Encadre les points à améliorer positivement
4. Donne des conseils de méthode concrets
5. Propose des prochaines étapes claires
6. Termine par un message de motivation personnalisé

FORMAT DE RÉPONSE (JSON strict):
{
  "personalizedAdvice": "Conseil personnalisé 200-500 mots",
  "motivationMessage": "Message court et punchy",
  "studyTips": ["Astuce 1", "Astuce 2", "Astuce 3"],
  "nextSteps": ["Étape 1", "Étape 2"],
  "encouragement": "Phrase d'encouragement finale"
}`;
}

// ─── Helper: Competence Blocks by Subject ───

interface CompetenceBlock {
  code: string;
  name: string;
}

function getCompetenceBlocks(subject: Subject, _gradeLevel: GradeLevel): CompetenceBlock[] {
  const blocksBySubject: Record<string, CompetenceBlock[]> = {
    'MATHS': [
      { code: 'ALG', name: 'Algèbre et analyse' },
      { code: 'GEO', name: 'Géométrie' },
      { code: 'STAT', name: 'Statistiques et probabilités' },
      { code: 'LOG', name: 'Logique et raisonnement' },
      { code: 'CALC', name: 'Calcul et technique' },
    ],
    'PHYSIQUE_CHIMIE': [
      { code: 'PHY', name: 'Physique' },
      { code: 'CHIM', name: 'Chimie' },
      { code: 'METH', name: 'Méthodologie scientifique' },
      { code: 'CALC', name: 'Calcul et technique' },
    ],
    'SVT': [
      { code: 'BIO', name: 'Biologie' },
      { code: 'GEO', name: 'Géologie' },
      { code: 'ECO', name: 'Écologie' },
      { code: 'METH', name: 'Méthodologie scientifique' },
    ],
    'ANGLAIS': [
      { code: 'COMP', name: 'Compréhension' },
      { code: 'EXPR', name: 'Expression' },
      { code: 'GRAM', name: 'Grammaire et vocabulaire' },
      { code: 'CULT', name: 'Culture et civilisation' },
    ],
    'FRANCAIS': [
      { code: 'COMP', name: 'Compréhension' },
      { code: 'EXPR', name: 'Expression écrite' },
      { code: 'ORAL', name: 'Expression orale' },
      { code: 'GRAM', name: 'Grammaire' },
      { code: 'LITT', name: 'Littérature' },
      { code: 'METH', name: 'Méthodologie' },
    ],
    'HISTOIRE_GEO': [
      { code: 'HIST', name: 'Histoire' },
      { code: 'GEO', name: 'Géographie' },
      { code: 'EMC', name: 'Enseignement moral et civique' },
      { code: 'METH', name: 'Méthodologie' },
    ],
    'SES': [
      { code: 'ECON', name: 'Économie' },
      { code: 'SOC', name: 'Sociologie' },
      { code: 'POL', name: 'Science politique' },
      { code: 'METH', name: 'Méthodologie' },
    ],
    'NSI': [
      { code: 'PROG', name: 'Programmation' },
      { code: 'DATA', name: 'Données' },
      { code: 'SYS', name: 'Systèmes' },
      { code: 'ALGO', name: 'Algorithmique' },
    ],
    'PHILOSOPHIE': [
      { code: 'ANA', name: 'Analyse' },
      { code: 'ARG', name: 'Argumentation' },
      { code: 'EXP', name: 'Expression' },
      { code: 'CULT', name: 'Culture philosophique' },
    ],
  };

  return blocksBySubject[subject] || [
    { code: 'COMP', name: 'Compréhension' },
    { code: 'EXPR', name: 'Expression' },
    { code: 'METH', name: 'Méthodologie' },
  ];
}
