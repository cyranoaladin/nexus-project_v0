import fs from 'node:fs';
import path from 'node:path';

import {
  domainIn,
  domainLabel,
  domainTitle,
  domainWithArticle,
  enumerateFr,
  hasDomainLabel,
  sentenceStart,
} from '@/lib/bilans/render/domain-labels';
import type { BilanPackSubject } from '@/lib/bilans/catalog/subjects';

type RawPack = Readonly<{
  status: string;
  subject: BilanPackSubject;
  scoring: Readonly<{ domains: readonly string[] }>;
}>;

function loadValidatedPacks(): readonly RawPack[] {
  const banksDirectory = path.join(process.cwd(), 'data', 'bilans', 'banks');
  return fs.readdirSync(banksDirectory)
    .filter((name) => name.endsWith('.json') && !name.includes('manifest'))
    .map((name) => JSON.parse(fs.readFileSync(path.join(banksDirectory, name), 'utf8')) as RawPack)
    .filter((pack) => pack.status === 'VALIDATED');
}

describe('DOMAIN_LABELS — libellés humains des domaines', () => {
  const packs = loadValidatedPacks();

  it('couvre chaque domaine de chaque pack VALIDATED avec un libellé dédié', () => {
    expect(packs.length).toBeGreaterThanOrEqual(17);
    const missing: string[] = [];
    for (const pack of packs) {
      for (const domainId of pack.scoring.domains) {
        if (!hasDomainLabel(domainId, pack.subject)) missing.push(`${pack.subject}:${domainId}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('fournit trois formes accentuées, sans identifiant technique', () => {
    for (const pack of packs) {
      for (const domainId of pack.scoring.domains) {
        const forms = domainLabel(domainId, pack.subject);
        for (const form of [forms.title, forms.article, forms.en]) {
          expect(form).not.toContain('-');
          expect(form).not.toBe(domainId);
          expect(form.trim().length).toBeGreaterThan(2);
        }
        expect(forms.title.charAt(0)).toBe(forms.title.charAt(0).toLocaleUpperCase('fr-FR'));
      }
    }
  });

  it('gère les élisions et les accords annoncés', () => {
    expect(domainWithArticle('proportionnalite')).toBe('la proportionnalité');
    expect(domainWithArticle('calcul-litteral')).toBe('le calcul littéral');
    expect(domainWithArticle('calcul-numerique')).toBe('le calcul numérique');
    expect(domainWithArticle('trigonometrie')).toBe('la trigonométrie');
    expect(domainWithArticle('geometrie')).toBe('la géométrie');
    expect(domainWithArticle('poesie')).toBe('la poésie');
    expect(domainWithArticle('argumentation')).toBe('l’argumentation');
    expect(domainIn('geometrie')).toBe('en géométrie');
    expect(domainIn('proportionnalite')).toBe('en proportionnalité');
    expect(domainTitle('fonctions-reference')).toBe('Fonctions de référence');
  });

  it('distingue les homonymes par matière', () => {
    expect(domainTitle('lexique', 'FRANCAIS')).not.toBe(domainTitle('lexique', 'PHILOSOPHIE'));
  });

  it('capitalise une forme fléchie sans casser l’élision', () => {
    expect(sentenceStart('la géométrie')).toBe('La géométrie');
    expect(sentenceStart('l’argumentation')).toBe('L’argumentation');
    expect(sentenceStart('en calcul littéral')).toBe('En calcul littéral');
  });

  it('énumère à la française', () => {
    expect(enumerateFr(['la géométrie'])).toBe('la géométrie');
    expect(enumerateFr(['la géométrie', 'les fractions'])).toBe('la géométrie et les fractions');
    expect(enumerateFr(['a', 'b', 'c'])).toBe('a, b et c');
  });

  it('retombe sur une forme lisible pour un identifiant inconnu', () => {
    const fallback = domainLabel('nouveau-domaine-inconnu');
    expect(fallback.title).toBe('Nouveau domaine inconnu');
    expect(fallback.article).toBe('nouveau domaine inconnu');
  });
});
