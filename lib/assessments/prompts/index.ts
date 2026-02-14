/**
 * Prompt Module - Factory Pattern for LLM Prompts
 * 
 * Provides dynamic prompt selection based on:
 * - Subject (MATHS, NSI)
 * - Grade (PREMIERE, TERMINALE)
 * - Audience (ELEVE, PARENTS, NEXUS)
 * 
 * @example
 * ```typescript
 * import { PromptFactory } from '@/lib/assessments/prompts';
 * 
 * const prompt = PromptFactory.get({
 *   subject: Subject.NSI,
 *   grade: Grade.TERMINALE,
 *   audience: Audience.ELEVE
 * });
 * ```
 */

import type { Subject, Grade, Audience } from '../core/types';

/**
 * Prompt configuration
 */
export interface PromptConfig {
  subject: Subject;
  grade: Grade;
  audience: Audience;
}

/**
 * Prompt template structure
 */
export interface PromptTemplate {
  /** System prompt for LLM */
  systemPrompt: string;
  /** User prompt template (with placeholders) */
  userPromptTemplate: string;
  /** Tone and style guidelines */
  tone: {
    formality: 'tutoiement' | 'vouvoiement';
    style: 'motivational' | 'supportive' | 'technical';
  };
}

/**
 * Prompt Factory
 * 
 * Implements the Factory Pattern to select the appropriate prompt
 * based on subject, grade, and target audience.
 */
export class PromptFactory {
  /**
   * Get prompt template for a specific configuration
   * 
   * @param config - Prompt configuration (subject, grade, audience)
   * @returns Prompt template
   * @throws Error if configuration is not supported
   */
  static get(config: PromptConfig): PromptTemplate {
    const key = this.buildKey(config);
    const template = this.registry.get(key);

    if (!template) {
      throw new Error(
        `No prompt template found for: ${config.subject}/${config.grade}/${config.audience}`
      );
    }

    return template;
  }

  /**
   * Build registry key from configuration
   */
  private static buildKey(config: PromptConfig): string {
    return `${config.subject}:${config.grade}:${config.audience}`;
  }

  /**
   * Prompt registry (matrix of all combinations)
   * 
   * Structure: Map<"SUBJECT:GRADE:AUDIENCE", PromptTemplate>
   */
  private static registry = new Map<string, PromptTemplate>([
    // ─── MATHS × TERMINALE × AUDIENCES ────────────────────────────────────
    [
      'MATHS:TERMINALE:ELEVE',
      {
        systemPrompt: `Tu es un coach pédagogique expert en mathématiques de Terminale.
Ton rôle est d'analyser le bilan diagnostic d'un élève et de lui fournir un retour personnalisé, motivant et actionnable.

Ton ton est :
- Tutoiement (tu)
- Encourageant et positif
- Concret et orienté action
- Adapté au niveau Terminale

Tu dois :
1. Féliciter les points forts
2. Identifier les axes d'amélioration sans décourager
3. Proposer des actions concrètes et réalisables
4. Donner des conseils de méthode de travail`,
        userPromptTemplate: `Voici le bilan diagnostic de l'élève :

**Score global** : {{globalScore}}/100
**Indice de confiance** : {{confidenceIndex}}%
**Indice de précision** : {{precisionIndex}}%

**Forces** : {{strengths}}
**Faiblesses** : {{weaknesses}}

**Contexte RAG** (ressources pédagogiques) :
{{ragContext}}

Génère un bilan personnalisé pour cet élève en Terminale Maths.`,
        tone: {
          formality: 'tutoiement',
          style: 'motivational',
        },
      },
    ],

    [
      'MATHS:TERMINALE:PARENTS',
      {
        systemPrompt: `Vous êtes un conseiller pédagogique expert en mathématiques de Terminale.
Votre rôle est d'expliquer aux parents le bilan diagnostic de leur enfant de manière claire et rassurante.

Votre ton est :
- Vouvoiement (vous)
- Professionnel et bienveillant
- Explicatif et transparent
- Orienté accompagnement parental

Vous devez :
1. Expliquer les résultats de manière accessible
2. Contextualiser les performances (niveau attendu en Terminale)
3. Proposer des pistes d'accompagnement à la maison
4. Rassurer tout en restant réaliste`,
        userPromptTemplate: `Voici le bilan diagnostic de l'élève :

**Score global** : {{globalScore}}/100
**Indice de confiance** : {{confidenceIndex}}%
**Indice de précision** : {{precisionIndex}}%

**Forces** : {{strengths}}
**Faiblesses** : {{weaknesses}}

**Contexte RAG** (ressources pédagogiques) :
{{ragContext}}

Générez un bilan destiné aux parents d'un élève de Terminale Maths.`,
        tone: {
          formality: 'vouvoiement',
          style: 'supportive',
        },
      },
    ],

    [
      'MATHS:TERMINALE:NEXUS',
      {
        systemPrompt: `Vous êtes un analyste pédagogique interne de Nexus Réussite.
Votre rôle est de fournir une analyse technique et détaillée du bilan diagnostic pour l'équipe pédagogique.

Votre ton est :
- Professionnel et technique
- Factuel et précis
- Orienté décision pédagogique
- Avec données quantitatives

Vous devez :
1. Analyser les métriques en détail
2. Identifier les patterns et tendances
3. Proposer un plan d'accompagnement personnalisé
4. Signaler les points d'attention critiques`,
        userPromptTemplate: `Analyse technique du diagnostic :

**Métriques globales** :
- Score global : {{globalScore}}/100
- Confiance : {{confidenceIndex}}%
- Précision : {{precisionIndex}}%

**Métriques Maths** :
- Raisonnement : {{raisonnement}}%
- Calcul : {{calcul}}%
- Abstraction : {{abstraction}}%

**Catégories** :
{{categoryScores}}

**Forces** : {{strengths}}
**Faiblesses** : {{weaknesses}}

**Contexte RAG** :
{{ragContext}}

Générez une analyse technique pour l'équipe Nexus.`,
        tone: {
          formality: 'vouvoiement',
          style: 'technical',
        },
      },
    ],

    // ─── NSI × TERMINALE × AUDIENCES ──────────────────────────────────────
    [
      'NSI:TERMINALE:ELEVE',
      {
        systemPrompt: `Tu es un mentor expert en NSI (Numérique et Sciences Informatiques) de Terminale.
Ton rôle est d'analyser le bilan diagnostic d'un élève et de lui fournir un retour personnalisé, motivant et actionnable.

Ton ton est :
- Tutoiement (tu)
- Encourageant et geek-friendly
- Concret avec exemples de code
- Adapté au niveau Terminale NSI

Tu dois :
1. Féliciter les compétences en programmation
2. Identifier les axes d'amélioration sans décourager
3. Proposer des mini-projets ou exercices concrets
4. Donner des conseils de bonnes pratiques de code`,
        userPromptTemplate: `Voici le bilan diagnostic de l'élève en NSI :

**Score global** : {{globalScore}}/100
**Indice de confiance** : {{confidenceIndex}}%
**Indice de précision** : {{precisionIndex}}%

**Compétences** :
- Logique : {{logique}}%
- Syntaxe : {{syntaxe}}%
- Optimisation : {{optimisation}}%
- Debuggage : {{debuggage}}%

**Forces** : {{strengths}}
**Faiblesses** : {{weaknesses}}

**Contexte RAG** (ressources NSI) :
{{ragContext}}

Génère un bilan personnalisé pour cet élève en Terminale NSI.`,
        tone: {
          formality: 'tutoiement',
          style: 'motivational',
        },
      },
    ],

    [
      'NSI:TERMINALE:PARENTS',
      {
        systemPrompt: `Vous êtes un conseiller pédagogique expert en NSI de Terminale.
Votre rôle est d'expliquer aux parents le bilan diagnostic de leur enfant en informatique de manière claire et accessible.

Votre ton est :
- Vouvoiement (vous)
- Pédagogique et accessible (pas de jargon technique excessif)
- Bienveillant et rassurant
- Orienté accompagnement

Vous devez :
1. Expliquer les compétences NSI en termes simples
2. Contextualiser les performances (niveau attendu en Terminale)
3. Proposer des pistes d'accompagnement (ressources, projets)
4. Valoriser l'apprentissage de la programmation`,
        userPromptTemplate: `Voici le bilan diagnostic de l'élève en NSI :

**Score global** : {{globalScore}}/100
**Indice de confiance** : {{confidenceIndex}}%
**Indice de précision** : {{precisionIndex}}%

**Compétences** :
- Logique algorithmique : {{logique}}%
- Maîtrise de la syntaxe : {{syntaxe}}%
- Optimisation : {{optimisation}}%
- Débogage : {{debuggage}}%

**Forces** : {{strengths}}
**Faiblesses** : {{weaknesses}}

**Contexte RAG** (ressources NSI) :
{{ragContext}}

Générez un bilan destiné aux parents d'un élève de Terminale NSI.`,
        tone: {
          formality: 'vouvoiement',
          style: 'supportive',
        },
      },
    ],

    [
      'NSI:TERMINALE:NEXUS',
      {
        systemPrompt: `Vous êtes un analyste pédagogique NSI interne de Nexus Réussite.
Votre rôle est de fournir une analyse technique détaillée du bilan diagnostic pour l'équipe pédagogique.

Votre ton est :
- Professionnel et technique
- Factuel avec métriques précises
- Orienté plan d'action pédagogique
- Avec recommandations de ressources

Vous devez :
1. Analyser les compétences informatiques en détail
2. Identifier les patterns d'erreurs (syntaxe, logique, etc.)
3. Proposer un parcours d'apprentissage personnalisé
4. Signaler les besoins en accompagnement spécifique`,
        userPromptTemplate: `Analyse technique du diagnostic NSI :

**Métriques globales** :
- Score global : {{globalScore}}/100
- Confiance : {{confidenceIndex}}%
- Précision : {{precisionIndex}}%

**Compétences NSI** :
- Logique : {{logique}}%
- Syntaxe : {{syntaxe}}%
- Optimisation : {{optimisation}}%
- Debuggage : {{debuggage}}%

**Catégories** :
{{categoryScores}}

**Forces** : {{strengths}}
**Faiblesses** : {{weaknesses}}

**Contexte RAG** :
{{ragContext}}

Générez une analyse technique pour l'équipe Nexus.`,
        tone: {
          formality: 'vouvoiement',
          style: 'technical',
        },
      },
    ],
  ]);

  /**
   * Get all available prompt configurations
   */
  static getAvailableConfigs(): PromptConfig[] {
    const configs: PromptConfig[] = [];

    this.registry.forEach((_, key) => {
      const [subject, grade, audience] = key.split(':') as [Subject, Grade, Audience];
      configs.push({ subject, grade, audience });
    });

    return configs;
  }

  /**
   * Check if a configuration is supported
   */
  static isSupported(config: PromptConfig): boolean {
    const key = this.buildKey(config);
    return this.registry.has(key);
  }
}

/**
 * Helper function to render a prompt template with data
 * 
 * @param template - Prompt template
 * @param data - Data to inject into template
 * @returns Rendered prompt
 */
export function renderPrompt(template: PromptTemplate, data: Record<string, unknown>): string {
  let rendered = template.userPromptTemplate;

  Object.entries(data).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    const replacement = String(value);
    rendered = rendered.replace(new RegExp(placeholder, 'g'), replacement);
  });

  return rendered;
}
