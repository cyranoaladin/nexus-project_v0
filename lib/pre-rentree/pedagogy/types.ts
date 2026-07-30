export const CONTENT_PUBLICATION_STATUSES = [
  'HUMAN_VALIDATION_REQUIRED',
  'CLASSROOM_READY',
  'PUBLICATION_APPROVED',
] as const;

export type ContentPublicationStatus = (typeof CONTENT_PUBLICATION_STATUSES)[number];
export type ContentUsePurpose = 'INTERNAL_REVIEW' | 'ASSIGNMENT' | 'PUBLICATION';

export type ContentVersion = Readonly<{
  campaignId: string;
  manifestVersion: number;
  manifestSha256: `sha256:${string}`;
  moduleCatalogVersion: string;
  moduleCatalogSha256: `sha256:${string}`;
}>;

export type AssessmentDefinitionRef = Readonly<{
  definitionId: string;
  moduleId: string;
  version: string;
  sha256: `sha256:${string}`;
}>;

export type SessionDefinition = Readonly<{
  id: string;
  moduleId: string;
  number: number;
  title: string;
  objective: string;
  topics: readonly string[];
  method: string;
  deliverable: string;
  sourceSha256: readonly `sha256:${string}`[];
}>;

export type ModuleDefinition = Readonly<{
  id: string;
  level: string;
  subject: string;
  title: string;
  subtitle: string;
  catalogStatus: string;
  publicationStatus: ContentPublicationStatus;
  sessions: readonly SessionDefinition[];
  assessmentRef: AssessmentDefinitionRef;
}>;

export type AssessmentOption = Readonly<{
  text: string;
  correct: boolean;
  targetedObstacle?: number;
}>;

export type AssessmentItem = Readonly<{
  id: string;
  nodeId: string;
  tier: 'A' | 'B' | 'C';
  prompt: string;
  rationale: string;
  responseMode: 'AUTOMATIC_QCM' | 'MANUAL_SHORT_RESPONSE';
  options?: readonly AssessmentOption[];
  maxCharacters?: number;
  gradingCriteria?: readonly string[];
  admissibleAnswerExample?: string;
}>;

export type AssessmentNode = Readonly<{
  id: string;
  order: number;
  evaluated: boolean;
  priorKnowledge: string;
  targetUse: string;
  obstacles: readonly string[];
  masteryCriterion: string;
  sessionNumber: number | null;
  itemIds: readonly string[];
}>;

export type AssessmentDefinition = Readonly<{
  id: string;
  moduleId: string;
  level: string;
  subject: string;
  edition: number;
  targetDurationMinutes: number;
  title: string;
  framing: string;
  publicationStatus: ContentPublicationStatus;
  ref: AssessmentDefinitionRef;
  nodes: readonly AssessmentNode[];
  items: readonly AssessmentItem[];
}>;

export type PublicAssessmentOption = Readonly<{
  index: number;
  text: string;
}>;

export type PublicAssessmentItem = Readonly<{
  id: string;
  nodeId: string;
  tier: 'A' | 'B' | 'C';
  prompt: string;
  responseMode: 'AUTOMATIC_QCM' | 'MANUAL_SHORT_RESPONSE';
  options?: readonly PublicAssessmentOption[];
  maxCharacters?: number;
}>;

export type PublicAssessmentDefinition = Readonly<{
  id: string;
  moduleId: string;
  version: string;
  sha256: `sha256:${string}`;
  level: string;
  subject: string;
  title: string;
  framing: string;
  targetDurationMinutes: number;
  items: readonly PublicAssessmentItem[];
}>;

export type PedagogyCatalogCounts = Readonly<{
  modules: number;
  sessions: number;
  cps: number;
  nodes: number;
  evaluatedNodes: number;
  items: number;
  manualResponses: number;
  sessionUnitFiles: number;
}>;

export type PedagogyCatalog = Readonly<{
  version: ContentVersion;
  counts: PedagogyCatalogCounts;
  modules: readonly ModuleDefinition[];
  assessments: readonly AssessmentDefinition[];
  getModule(id: string): ModuleDefinition;
  getAssessment(id: string, purpose: ContentUsePurpose): AssessmentDefinition;
  assertAssessmentRef(ref: AssessmentDefinitionRef): AssessmentDefinition;
}>;

export const ASSESSMENT_WORKFLOW_STATUSES = [
  'BROUILLON',
  'AFFECTE',
  'COMMENCE',
  'SOUMIS',
  'EN_ATTENTE_CORRECTION_MANUELLE',
  'CORRIGE',
  'RESULTAT_CALCULE',
  'BILAN_GENERE',
  'TRANSMIS_OU_PUBLIE',
] as const;

export type AssessmentWorkflowStatus = (typeof ASSESSMENT_WORKFLOW_STATUSES)[number];

export type ManualGrade = Readonly<{
  itemId: string;
  awardedPoints: number;
  maxPoints: number;
  reviewedBy: string;
  reviewedAt: string;
}>;

export type ManualGradingReadiness = Readonly<{
  workflowStatus: Extract<
    AssessmentWorkflowStatus,
    'EN_ATTENTE_CORRECTION_MANUELLE' | 'CORRIGE'
  >;
  pendingManualItemIds: readonly string[];
  manuallyGradedItemIds: readonly string[];
  automaticallyScorableItemIds: readonly string[];
}>;

export type FinalizationOperation =
  | 'FINAL_SCORE'
  | 'FINAL_GROUP_CALIBRATION'
  | 'FINAL_REPORT';
