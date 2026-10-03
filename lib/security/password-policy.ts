import { z } from 'zod';

/** Only for setting credentials; existing passwords remain valid at login. */
export const newPasswordSchema = z.string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .max(72, 'Le mot de passe doit tenir dans 72 octets UTF-8')
  .refine((password) => new TextEncoder().encode(password).length <= 72, {
    message: 'Le mot de passe doit tenir dans 72 octets UTF-8',
  });
