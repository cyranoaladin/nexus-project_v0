import { z } from 'zod';
import {
  AcademicTrack,
  FamilyRequestType,
  GradeLevel,
  SchoolingStatus,
  StmgPathway,
  type Prisma,
} from '@prisma/client';

/**
 * Version du texte de consentement présenté au moment d'une demande famille
 * (bilan gratuit public ou ajout d'enfant côté parent). Une seule version
 * existe à ce jour -- volontairement pas un système de versionnage complet
 * (YAGNI), juste un repère stable pour l'audit.
 */
export const FAMILY_REQUEST_CONSENT_VERSION = 'family-request-v1';

/** Une demande famille ne porte jamais plus d'enfants qu'une saisie papier. */
export const FAMILY_REQUEST_MAX_CHILDREN = 6;

const familyRequestChildSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  birthDate: z.date().nullable().optional(),
  schoolingStatus: z.nativeEnum(SchoolingStatus).nullable().optional(),
  gradeLevel: z.nativeEnum(GradeLevel),
  academicTrack: z.nativeEnum(AcademicTrack).nullable().optional(),
  stmgPathway: z.nativeEnum(StmgPathway).nullable().optional(),
  school: z.string().trim().max(120).nullable().optional(),
  academicCourseKeys: z.array(z.string()).optional(),
}).strict();

const createFamilyRequestSchema = z.object({
  type: z.nativeEnum(FamilyRequestType),
  requestingParentProfileId: z.string().trim().min(1).nullable().optional(),
  contactFirstName: z.string().trim().min(1).max(80),
  contactLastName: z.string().trim().min(1).max(80),
  contactEmail: z.string().trim().email().max(160).nullable().optional(),
  contactPhone: z.string().trim().min(1).max(40),
  contactPhoneNormalized: z.string().trim().min(1).max(40),
  notes: z.string().max(4000).nullable().optional(),
  now: z.date(),
  children: z.array(familyRequestChildSchema).min(1).max(FAMILY_REQUEST_MAX_CHILDREN),
}).strict();

export type FamilyRequestChildInput = z.infer<typeof familyRequestChildSchema>;
export type CreateFamilyRequestInput = z.infer<typeof createFamilyRequestSchema>;

export type CreatedFamilyRequest = Readonly<{ id: string }>;

/**
 * Persiste une `FamilyRequest` (+ ses enfants) sans jamais créer de compte
 * `User`/`Student` : c'est tout l'objet d'Amendement 7 -- une soumission
 * publique (bilan gratuit) ou un ajout d'enfant côté parent capture
 * l'intention brute, jamais un accès direct. La conversion en foyer réel
 * n'appartient qu'au staff (ADMIN/ASSISTANTE), via
 * `POST /api/assistante/family-requests/[requestId]/convert`.
 *
 * L'écriture Prisma imbriquée (`children: { create: [...] }`) est déjà
 * atomique en elle-même -- pas besoin d'un `$transaction` local. Le
 * paramètre reste un `Prisma.TransactionClient` pour permettre à l'appelant
 * de composer cette écriture avec d'autres écritures (ex: le lead de
 * campagne du bilan gratuit) dans une transaction plus large.
 */
export async function createFamilyRequest(
  transaction: Prisma.TransactionClient,
  input: CreateFamilyRequestInput,
): Promise<CreatedFamilyRequest> {
  const parsed = createFamilyRequestSchema.parse(input);
  return transaction.familyRequest.create({
    data: {
      type: parsed.type,
      requestingParentProfileId: parsed.requestingParentProfileId ?? null,
      contactFirstName: parsed.contactFirstName,
      contactLastName: parsed.contactLastName,
      contactEmail: parsed.contactEmail ?? null,
      contactPhone: parsed.contactPhone,
      contactPhoneNormalized: parsed.contactPhoneNormalized,
      consentVersion: FAMILY_REQUEST_CONSENT_VERSION,
      consentAt: parsed.now,
      notes: parsed.notes ?? null,
      children: {
        create: parsed.children.map((child) => ({
          firstName: child.firstName,
          lastName: child.lastName,
          birthDate: child.birthDate ?? null,
          schoolingStatus: child.schoolingStatus ?? null,
          gradeLevel: child.gradeLevel,
          academicTrack: child.academicTrack ?? null,
          stmgPathway: child.stmgPathway ?? null,
          school: child.school ?? null,
          academicCourseKeys: child.academicCourseKeys ?? [],
        })),
      },
    },
    select: { id: true },
  });
}
