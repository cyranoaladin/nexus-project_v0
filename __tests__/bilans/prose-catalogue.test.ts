import {
  AFFIRMED_ITEM_THRESHOLD,
  CAUTIOUS_VARIANTS,
  PROSE_CATALOGUE_VERSION,
  VARIANTS_PER_PHRASE,
  buildCalibrationSentence,
  buildOpeningSynthesis,
  buildWorkPlan,
  selectThemeProse,
  type ThemeProseInput,
} from '@/lib/bilans/render/prose-catalogue';

/**
 * The catalogue is hand-written prose selected by the engine — never generated.
 * These tests lock the SELECTION rules, not the wording: which sentence applies,
 * at which confidence tier, in which order. The wording itself is editorial and
 * belongs to the pedagogical owner.
 */

function theme(over: Partial<ThemeProseInput> = {}): ThemeProseInput {
  return {
    domainId: 'calcul-numerique',
    category: 'Nombres relatifs et priorités opératoires',
    profile: 'MAITRISE',
    score: 90,
    itemCount: 2,
    nodeCount: 1,
    worstNodeLabel: null,
    ...over,
  };
}

describe('selectThemeProse — tier selection', () => {
  it('uses the cautious tier by default (2 items)', () => {
    const text = selectThemeProse(theme(), 'ELEVE', 0);
    expect(text).toContain('deux réponses');
  });

  it.each([
    ['exactly at the threshold', AFFIRMED_ITEM_THRESHOLD],
    ['above the threshold', 12],
  ])('uses the affirmed tier when a theme has enough items (%s)', (_label, itemCount) => {
    const text = selectThemeProse(theme({ itemCount, nodeCount: 4 }), 'ELEVE', 0);
    expect(text).toContain("sur l’ensemble des questions");
  });

  it('stays cautious just below the threshold', () => {
    const text = selectThemeProse(theme({ itemCount: AFFIRMED_ITEM_THRESHOLD - 1 }), 'ELEVE', 0);
    expect(text).not.toContain("sur l’ensemble des questions");
  });

  it('always embeds the human category label, never the slug', () => {
    const text = selectThemeProse(theme(), 'ELEVE', 0);
    expect(text).toContain('Nombres relatifs et priorités opératoires');
    expect(text).not.toContain('calcul-numerique');
  });
});

describe('selectThemeProse — multi-node nuance (score high, profile severe)', () => {
  const severe = { nodeCount: 3, score: 78, worstNodeLabel: 'Puissances et écriture scientifique' };

  it.each(['ERREUR_CONFIANTE', 'LACUNE_CONSCIENTE'] as const)(
    'uses the nuanced frame for %s when the score stays high',
    (profile) => {
      const text = selectThemeProse(theme({ ...severe, profile }), 'ELEVE', 0);
      expect(text).toContain('Puissances et écriture scientifique');
      expect(text).not.toContain("l’ensemble est fragile");
    },
  );

  it('does not use the nuanced frame on a single-node theme', () => {
    const text = selectThemeProse(
      theme({ ...severe, nodeCount: 1, profile: 'ERREUR_CONFIANTE' }),
      'ELEVE',
      0,
    );
    expect(text).not.toContain('Puissances et écriture scientifique');
  });

  it('does not use the nuanced frame when the score is low', () => {
    const text = selectThemeProse(
      theme({ ...severe, score: 30, profile: 'ERREUR_CONFIANTE' }),
      'ELEVE',
      0,
    );
    expect(text).not.toContain('Puissances et écriture scientifique');
  });

  it('does not use the nuanced frame for a non-severe profile', () => {
    const text = selectThemeProse(theme({ ...severe, profile: 'MAITRISE_FRAGILE' }), 'ELEVE', 0);
    expect(text).not.toContain('Puissances et écriture scientifique');
  });
});

describe('selectThemeProse — deterministic variant rotation', () => {
  it('is reproducible for the same theme index', () => {
    const a = selectThemeProse(theme(), 'ELEVE', 4);
    const b = selectThemeProse(theme(), 'ELEVE', 4);
    expect(a).toBe(b);
  });

  it('never gives two adjacent themes the same variant', () => {
    const texts = [0, 1, 2, 3, 4, 5].map((i) => selectThemeProse(theme(), 'ELEVE', i));
    for (let i = 1; i < texts.length; i += 1) {
      expect(texts[i]).not.toBe(texts[i - 1]);
    }
  });

  it('cycles through three distinct variants', () => {
    const texts = [0, 1, 2].map((i) => selectThemeProse(theme(), 'ELEVE', i));
    expect(new Set(texts).size).toBe(3);
  });
});

describe('selectThemeProse — audience register', () => {
  it('addresses the student informally and the parent formally', () => {
    const eleve = selectThemeProse(theme({ profile: 'MAITRISE_FRAGILE' }), 'ELEVE', 0);
    const parent = selectThemeProse(theme({ profile: 'MAITRISE_FRAGILE' }), 'PARENTS', 0);
    expect(eleve).not.toBe(parent);
    expect(eleve.toLowerCase()).toMatch(/\btu\b|\btes\b|\bton\b/);
    expect(parent.toLowerCase()).not.toMatch(/\btu\b|\btes\b/);
  });

  it('covers every profile for every audience', () => {
    const profiles = ['MAITRISE', 'MAITRISE_FRAGILE', 'ERREUR_CONFIANTE', 'LACUNE_CONSCIENTE', 'NON_TRAITE'] as const;
    for (const audience of ['ELEVE', 'PARENTS', 'NEXUS'] as const) {
      for (const profile of profiles) {
        const text = selectThemeProse(theme({ profile }), audience, 0);
        expect(text.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe('buildOpeningSynthesis — score bands', () => {
  it.each([
    [92, 'approfondissement'],
    [70, 'renforcer'],
    [50, 'consolider'],
    [20, 'fondamentaux'],
  ])('score %i selects the matching band', (score, marker) => {
    const text = buildOpeningSynthesis(score, { acquis: 1, aSecuriser: 1, aRevoir: 1, aRectifier: 1 }, 'ELEVE');
    expect(text.toLowerCase()).toContain(marker);
  });

  it('states the distribution over the evaluated themes', () => {
    const text = buildOpeningSynthesis(70, { acquis: 3, aSecuriser: 2, aRevoir: 1, aRectifier: 1 }, 'ELEVE');
    expect(text).toContain('7 thèmes');
    expect(text).toContain('3 acquis');
  });
});

describe('buildWorkPlan — severity ordering', () => {
  const themes = [
    theme({ domainId: 'a', category: 'Fragile A', profile: 'MAITRISE_FRAGILE' }),
    theme({ domainId: 'b', category: 'Lacune B', profile: 'LACUNE_CONSCIENTE' }),
    theme({ domainId: 'c', category: 'Erreur C', profile: 'ERREUR_CONFIANTE' }),
    theme({ domainId: 'd', category: 'Acquis D', profile: 'MAITRISE' }),
  ];

  it('orders confident errors first, then gaps, then fragile mastery', () => {
    const lines = buildWorkPlan(themes, 'ELEVE').join('\n');
    expect(lines.indexOf('Erreur C')).toBeLessThan(lines.indexOf('Lacune B'));
    expect(lines.indexOf('Lacune B')).toBeLessThan(lines.indexOf('Fragile A'));
  });

  it('never lists mastered themes in the work plan', () => {
    expect(buildWorkPlan(themes, 'ELEVE').join('\n')).not.toContain('Acquis D');
  });

  it('omits a severity line entirely when no theme matches', () => {
    const onlyFragile = [theme({ category: 'Fragile A', profile: 'MAITRISE_FRAGILE' })];
    const lines = buildWorkPlan(onlyFragile, 'ELEVE').join('\n');
    expect(lines).not.toMatch(/convictions à corriger/i);
  });

  it('returns nothing when everything is mastered', () => {
    expect(buildWorkPlan([theme({ profile: 'MAITRISE' })], 'ELEVE')).toEqual([]);
  });
});

describe('buildCalibrationSentence — three cases', () => {
  it('handles a null index (nothing answered)', () => {
    expect(buildCalibrationSentence(null, 'ELEVE')).toMatch(/sans réponse/i);
  });

  it.each([[59.9], [0]])('flags weak calibration below the threshold (%p)', (value) => {
    expect(buildCalibrationSentence(value, 'ELEVE')).toMatch(/ne coïncident pas/i);
  });

  it.each([[60], [95]])('praises reliable calibration at or above the threshold (%p)', (value) => {
    expect(buildCalibrationSentence(value, 'ELEVE')).toMatch(/fiable/i);
  });
});

describe('catalogue integrity', () => {
  it('provides exactly the expected number of variants for every audience and profile', () => {
    for (const [audience, byProfile] of Object.entries(CAUTIOUS_VARIANTS)) {
      for (const [profile, variants] of Object.entries(byProfile)) {
        expect(`${audience}.${profile}=${variants.length}`)
          .toBe(`${audience}.${profile}=${VARIANTS_PER_PHRASE}`);
        expect(new Set(variants).size).toBe(VARIANTS_PER_PHRASE);
      }
    }
  });

  it('is versioned', () => {
    expect(PROSE_CATALOGUE_VERSION).toMatch(/^prose-catalogue\./);
  });
});
