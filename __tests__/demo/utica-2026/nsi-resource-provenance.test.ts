/**
 * P3.1 §4-6 — audit de provenance NSI, gate obligatoire.
 *
 * Question posée par la mission : peut-on prouver structurellement que la
 * carte "programme" NSI constitue une représentation du programme OFFICIEL
 * (BO/Éduscol) ?
 *
 * Résultat de l'audit : NON. `programmes/mapping/nsi_terminale.skills.map.
 * yml` et son dérivé `programmes/generated/nsi_terminale.skills.generated.
 * json` sont un mapping de compétences INTERNE à Nexus — utilisé par le
 * diagnostic pré-stage (le YAML se présente lui-même comme
 * `label: "Diagnostic Pré-Stage NSI — Terminale Spécialité"`) — sans aucun
 * champ source/url/référence officielle nulle part dans le schéma ou les
 * métadonnées générées.
 *
 * Verdict : NSI_PROVENANCE=NEXUS_DERIVED (Cas B). La ressource ne porte
 * donc jamais le mot "officiel" côté visiteur, et `origin` reste
 * NEXUS_CONTENT — jamais OFFICIAL_PUBLIC.
 */
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { getResourceById } from '@/lib/demo/utica-2026/resources';

const SCHEMA_PATH = require.resolve('@/programmes/mapping/skills.schema.json');
const MAPPING_PATH = require.resolve('@/programmes/mapping/nsi_terminale.skills.map.yml');
const GENERATED_PATH = require.resolve('@/programmes/generated/nsi_terminale.skills.generated.json');

describe('Audit de provenance NSI — programme officiel non prouvé (Cas B)', () => {
  test('le schéma de mapping ne modélise aucun champ de source/référence officielle', () => {
    const schema = readFileSync(SCHEMA_PATH, 'utf8');
    expect(schema).not.toMatch(/"source"|"sourceUrl"|"officialReference"|\bBO\b|Eduscol/i);
  });

  test('le mapping YAML source ne cite aucune référence officielle (BO/Éduscol) — c\'est un outil de diagnostic interne', () => {
    const raw = readFileSync(MAPPING_PATH, 'utf8');
    const parsed = yaml.load(raw) as { label?: string; domains?: Array<{ domainId: string }> };
    // Le fichier s'auto-décrit comme un outil de diagnostic Nexus, pas comme
    // une transcription d'un texte réglementaire.
    expect(parsed.label ?? '').toMatch(/diagnostic/i);
    expect(raw).not.toMatch(/bulletin officiel|eduscol\.education\.fr|legifrance/i);
    expect(parsed.domains?.some((d) => d.domainId === 'data_structures')).toBe(true);
  });

  test('les métadonnées du JSON généré ne portent aucune référence officielle', () => {
    const generated = JSON.parse(readFileSync(GENERATED_PATH, 'utf8')) as Record<string, unknown>;
    const metaKeys = Object.keys(generated).filter((k) => k !== 'sections');
    expect(metaKeys).toEqual(['programmeKey', 'generatedAt', 'schemaVersion']);
    expect(JSON.stringify(generated)).not.toMatch(/bulletin officiel|eduscol|legifrance|sourceUrl/i);
  });

  test('NSI_PROVENANCE=NEXUS_DERIVED — la ressource NSI programme ne revendique jamais "officiel"', () => {
    const resource = getResourceById('nsi-programme-structures-donnees')!;
    expect(resource.origin).toBe('NEXUS_CONTENT');
    expect(resource.origin).not.toBe('OFFICIAL_PUBLIC');
    expect(resource.title).not.toMatch(/officiel/i);
    expect(resource.sourceLabel).not.toMatch(/officiel/i);
    expect(resource.description).not.toMatch(/officiel/i);
    expect(resource.preview).not.toMatch(/officiel/i);
  });

  test('aucune ressource OFFICIAL_PUBLIC n\'existe dans le catalogue sans une source officielle prouvée (garde négative générale)', () => {
    // Contrat : si une future ressource déclare origin OFFICIAL_PUBLIC, son
    // sourceRef doit obligatoirement pointer vers une source à référence
    // officielle vérifiable (jamais un fichier généré Nexus seul). Pour
    // l'instant, aucune ressource du catalogue n'utilise OFFICIAL_PUBLIC —
    // ce test verrouille cette absence tant qu'aucune preuve n'est apportée.
    const { getResourceCatalog } = require('@/lib/demo/utica-2026/resources');
    const officialPublicResources = getResourceCatalog().filter(
      (r: { origin: string }) => r.origin === 'OFFICIAL_PUBLIC',
    );
    for (const r of officialPublicResources as Array<{ sourceRef: string }>) {
      expect(r.sourceRef).not.toMatch(/programmes\/generated\/|programmes\/mapping\//);
    }
  });

  test('"Listes chaînées" (compétence actuelle de Lina) est un skill réel du mapping, pas une invention', () => {
    const raw = readFileSync(MAPPING_PATH, 'utf8');
    const parsed = yaml.load(raw) as {
      domains: Array<{ domainId: string; skills: Array<{ label: string }> }>;
    };
    const domain = parsed.domains.find((d) => d.domainId === 'data_structures')!;
    expect(domain.skills.some((s) => s.label === 'Listes chaînées')).toBe(true);
    expect(domain.skills.some((s) => s.label === 'Piles & Files')).toBe(true);
  });
});
