/**
 * Code personnel des élèves de l'espace pédagogique.
 *
 * 8 caractères tirés d'un alphabet de 31 symboles sans ambiguïté visuelle
 * (ni 0/O, ni 1/I/L) ≈ 40 bits. Il n'est jamais stocké en clair : seule
 * l'empreinte bcrypt l'est (`User.pinHash`). Il ne sert QU'à ce chemin de
 * connexion : il n'est jamais accepté comme mot de passe du flux email.
 */
import { randomInt } from 'node:crypto';

import bcrypt from 'bcryptjs';

export const PIN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const PIN_LENGTH = 8;
export const PIN_BCRYPT_COST = 11;
const MAX_INPUT_LENGTH = 64;

export function generatePin(): string {
  let pin = '';
  for (let i = 0; i < PIN_LENGTH; i += 1) pin += PIN_ALPHABET[randomInt(PIN_ALPHABET.length)];
  return pin;
}

/** Affichage lisible : `ABCD-2345`. */
export function formatPin(pin: string): string {
  return `${pin.slice(0, 4)}-${pin.slice(4)}`;
}

/** Saisie tolérante : casse, espaces et tirets sont sans effet. */
export function normalizePin(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_INPUT_LENGTH) return null;
  const cleaned = value.replace(/[\s-]/g, '').toUpperCase();
  return cleaned.length > 0 ? cleaned : null;
}

export function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, PIN_BCRYPT_COST);
}

export async function verifyPin(input: unknown, hash: string): Promise<boolean> {
  const normalized = normalizePin(input);
  if (!normalized) return false;
  return bcrypt.compare(normalized, hash);
}
