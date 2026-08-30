/**
 * ARIA Learning Cockpit — Contrats de domaine canoniques (V1).
 *
 * Ce module est ISOMORPHE (importable serveur ET client) :
 * il ne contient que des types, interfaces et constantes pures.
 *
 * ── Règle des quatre dimensions d'accès ──────────────────────────────────────
 *  1. academicallyRelevant  : L'élève suit-il ce cours dans son cursus réel ?
 *  2. productSupported      : ARIA dispose-t-elle des capacités réelles pour ce cours ?
 *  3. commerciallyEntitled  : L'abonnement de l'élève ouvre-t-il l'accès à ce cours ?
 *  4. pinnedForAria         : préférence d'affichage, jamais une vérité d'accès
 */

import type { AcademicTrack, GradeLevel, Subject } from '@prisma/client';
import type { CourseKind } from '@/lib/curriculum/catalog';

// ─── Clé de cours ────────────────────────────────────────────────────────────

export type AriaCourseKey = string;

// ─── Statut d'accès au cours ─────────────────────────────────────────────────

export type AriaCourseStatus =
  | 'AVAILABLE'       // Éligible + supporté + abonné
  | 'LOCKED'          // Éligible + supporté + NON abonné
  | 'UNSUPPORTED';    // Éligible + NON supporté

export interface AriaCourseAccess {
  readonly courseKey: AriaCourseKey;
  readonly academicallyRelevant: boolean;
  readonly productSupported: boolean;
  readonly commerciallyEntitled: boolean;
  readonly pinnedForAria: boolean;
  readonly status: AriaCourseStatus;
  readonly lockReason?: 'NOT_ENTITLED' | 'UNSUPPORTED' | 'NOT_ENROLLED';
}

// ─── Capacités réelles d'un cours ────────────────────────────────────────────

export interface AriaCourseCapabilities {
  readonly hasSkillGraph: boolean;
  readonly hasResources: boolean;
  readonly hasRagCorpus: boolean;
  readonly hasChat: boolean;
  readonly hasAssessmentContext: boolean;
  readonly generalChatAllowed?: boolean;
  readonly skillGraphRef: string | null;
  readonly resourceCount: number;
}

// ─── Résumé de cours ARIA ───────────────────────────────────────────────────

export interface AriaCourseSummary {
  readonly courseKey: AriaCourseKey;
  readonly label: string;
  readonly longLabel: string;
  readonly gradeLevel: GradeLevel;
  readonly tracks: readonly AcademicTrack[];
  readonly kind: CourseKind;
  readonly legacySubject: Subject | null;
  readonly capabilities: AriaCourseCapabilities;
  readonly access: AriaCourseAccess;
}

// ─── Profil d'apprentissage ARIA ────────────────────────────────────────────

export interface AriaLearningProfileDTO {
  readonly studentId: string;
  readonly preferences: {
    readonly version: 1;
    readonly pinnedCourseKeys: readonly AriaCourseKey[];
    readonly focusedCourseKey: AriaCourseKey | null;
    readonly courseOrder: readonly AriaCourseKey[];
    readonly showCitations: boolean;
  };
  readonly updatedAt: string;
}

// ─── Modèle de ressources ────────────────────────────────────────────────────

export type AriaResourceProvenance =
  | 'OFFICIEL_MEN'
  | 'NEXUS_METHODE'
  | 'ANNALE_BAC'
  | 'EXAM_POLICY';

export type AriaResourceType =
  | 'PDF'
  | 'EXERCICE'
  | 'SYNTHESE'
  | 'METHODE'
  | 'FICHE_REVISION'
  | 'ANNALE_BAC';

export interface AriaResource {
  readonly id: string;
  readonly courseKey: AriaCourseKey;
  readonly title: string;
  readonly description?: string;
  readonly type: AriaResourceType;
  readonly provenance: AriaResourceProvenance;
  readonly sourceLabel: string;
  readonly url?: string;
  readonly filename?: string;
  readonly sizeBytes?: number;
  readonly contentSha256?: string;
  readonly mimeType?: string;
}

// ─── Contrat RAG ─────────────────────────────────────────────────────────────

export interface AriaRetrievalPlan {
  readonly courseKey: AriaCourseKey;
  readonly collection: string;
  readonly corpusId: string;
  readonly corpusVersionId: string;
  readonly manifestSha256: string;
  readonly resourceRegistrySha256: string;
  readonly academicYear: string;
  readonly curriculumVersion: string;
  readonly resourceBindings: readonly {
    readonly resourceId: string;
    readonly resourceVersionId: string;
    readonly contentSha256: string;
    readonly chunks: readonly {
      readonly chunkId: string;
      readonly locator: Readonly<Record<string, string | number>>;
    }[];
  }[];
}

export interface AriaCitationHit {
  readonly id: string;
  readonly sourceTitle: string;
  readonly sourceDocument: string;
  readonly sourceLocation?: string;
  readonly courseKey: AriaCourseKey;
  readonly provenance: string;
  readonly url?: string;
  readonly snippet: string;
  readonly score?: number;
  readonly resourceId?: string;
  readonly resourceVersionId?: string;
  readonly contentSha256?: string;
  readonly chunkId?: string;
  readonly locator?: Readonly<Record<string, string | number | boolean>>;
  readonly corpusId?: string;
  readonly corpusVersionId?: string;
  readonly manifestSha256?: string;
}

export type AriaRagState =
  | { status: 'NOT_CONFIGURED'; reason: string }
  | { status: 'RUNTIME_UNAVAILABLE'; error: string; plan: AriaRetrievalPlan }
  | { status: 'NO_RESULTS'; plan: AriaRetrievalPlan }
  | { status: 'SUCCESS'; hits: readonly AriaCitationHit[]; plan: AriaRetrievalPlan };

// ─── Conversations & Messages ────────────────────────────────────────────────

export type AriaMessageRole = 'user' | 'assistant' | 'system';
export type AriaMessageStatus = 'PENDING' | 'STREAMING' | 'COMPLETED' | 'CANCELLED' | 'ERROR';

export interface AriaMessageCitationDTO {
  readonly id: string;
  readonly messageId: string;
  readonly sourceTitle: string;
  readonly sourceDocument: string;
  readonly sourceLocation?: string;
  readonly courseKey: AriaCourseKey;
  readonly provenance: string;
  readonly url?: string;
}

export interface AriaMessageDTO {
  readonly id: string;
  readonly conversationId: string;
  readonly role: AriaMessageRole;
  readonly content: string;
  readonly status: AriaMessageStatus;
  readonly metadata?: Record<string, unknown> | null;
  readonly citations?: readonly AriaMessageCitationDTO[];
  readonly feedback?: boolean | null;
  readonly createdAt: string;
}

export interface AriaConversationDTO {
  readonly id: string;
  readonly studentId: string;
  readonly courseKey: AriaCourseKey | null;
  readonly skillId?: string | null;
  readonly resourceId?: string | null;
  readonly title: string | null;
  readonly messages?: readonly AriaMessageDTO[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AriaFeedbackDTO {
  readonly id: string;
  readonly messageId: string;
  readonly studentId: string;
  readonly useful: boolean;
  readonly reason?: string | null;
  readonly createdAt: string;
}
