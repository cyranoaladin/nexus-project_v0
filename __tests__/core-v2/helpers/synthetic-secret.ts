import { randomBytes } from 'node:crypto';

/** Valeur secrète synthétique, propre à l'exécution : aucun littéral de secret versionné. */
export const syntheticSecret = (): string => randomBytes(24).toString('hex');
