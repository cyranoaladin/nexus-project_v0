import { z } from 'zod';

export const publicStageInscriptionSchema = z.object({
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50),
  email: z.string().trim().email(),
  phone: z.string().trim().max(30).optional(),
  level: z.string().trim().min(1).max(50),
  parentFirstName: z.string().trim().max(50).optional(),
  parentLastName: z.string().trim().max(50).optional(),
  parentEmail: z.union([z.string().trim().email(), z.literal('')]).optional(),
  parentPhone: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(500).optional(),
  stageTermsAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Vous devez accepter les modalités du stage' }),
  }),
  dataProcessingAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Vous devez accepter le traitement des données personnelles' }),
  }),
}).strict();

export type PublicStageInscriptionInput = z.infer<typeof publicStageInscriptionSchema>;
