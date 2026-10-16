/**
 * Catalogue des manuels, utilisable dans un composant « use client ».
 *
 * lib/pricing.ts est `server-only` : la page des manuels calcule les devis dans
 * le navigateur et ne peut pas l'importer. Ce module charge le seul fichier
 * engendré qui lui est nécessaire (~13 Ko), et rien d'autre du socle tarifaire.
 *
 * Fichier engendré par : node scripts/generate-pricing-client-data.js
 * Synchronisation garantie par __tests__/lib/manuels-client-sync.test.ts
 */
import type {
  ManuelDiscipline,
  ManuelsBareme,
  ManuelsCatalogue,
  ManuelVolume,
} from './types';
import manuelsData from '@/data/manuels-client.generated.json';

export const MANUELS_CATALOGUE = manuelsData as unknown as ManuelsCatalogue;

export function getManuelsBaremeClient(): ManuelsBareme {
  return MANUELS_CATALOGUE.bareme;
}

export function getManuelVolumesClient(): ManuelVolume[] {
  return MANUELS_CATALOGUE.volumes;
}

export function getManuelDisciplinesClient(): ManuelDiscipline[] {
  return MANUELS_CATALOGUE.disciplines;
}

export function getManuelVolumeClient(id: string): ManuelVolume | undefined {
  return MANUELS_CATALOGUE.volumes.find((v) => v.id === id);
}
