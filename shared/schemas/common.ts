import { z } from 'zod';
import { Subject } from '@/types/enums';

export const zUUID = z.string().uuid({ message: 'Identifiant invalide' });
export const zISODate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'Date invalide (YYYY-MM-DD)');
export const zTimeHHMM = z
  .string()
  .regex(/^\d{2}:\d{2}$/u, 'Heure invalide (HH:MM)');

export const zSubject = z.nativeEnum(Subject, {
  errorMap: () => ({ message: 'Matière invalide' }),
});

export const zAttachment = z.object({
  url: z.string().url(),
  name: z.string().min(1),
  type: z.string().min(1),
  size: z.number().int().nonnegative(),
});

export type UUID = z.infer<typeof zUUID>;
export type ISODate = z.infer<typeof zISODate>;
export type HHMM = z.infer<typeof zTimeHHMM>;

