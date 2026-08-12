import fs from 'node:fs';
import path from 'node:path';

import { loadBilanPack } from '@/lib/bilans/catalog/load-pack';
import {
  assertBriefRespectsFacts,
  buildStableSystemPrompt,
  buildStudentFactsPayload,
  callTeacherBriefModel,
  estimateCostUsd,
  generateTeacherBrief,
  resolveTeacherBriefConfig,
  teacherBriefMonthlyUsage,
} from '@/lib/bilans/llm/teacher-brief-service';
import {
  TEACHER_BRIEF_DEFAULT_MAX_TOKENS,
} from '@/lib/bilans/llm/teacher-brief-service';
import {
  TEACHER_BRIEF_DOMAIN_MAX_CHARS,
  TEACHER_BRIEF_PROMPT_VERSION,
  teacherBriefSchema,
  type TeacherBriefContent,
} from '@/lib/bilans/llm/teacher-brief-schema';
import type { FactSheet } from '@/lib/bilans/facts/fact-sheet';

const PACK = loadBilanPack('data/bilans/banks/entree-seconde-maths-v1.json');

function factSheet(): FactSheet {
  return Object.freeze({
    engineVersion: '1.0.1',
    bankSlug: PACK.slug,
    bankVersion: PACK.version,
    student: Object.freeze({ alias: 'ELEVE_BRIEFTEST', level: 'SECONDE' }),
    globalScore: 45,
    coverage: 100,
    calibrationIndex: 50,
    domains: Object.freeze(PACK.scoring.domains.map((id, index) => Object.freeze({
      id,
      score: 20 + index * 8,
      profile: (['ERREUR_CONFIANTE', 'LACUNE_CONSCIENTE', 'MAITRISE_FRAGILE', 'MAITRISE'] as const)[index % 4],
    }))),
    nodes: Object.freeze([]),
    flags: Object.freeze([]),
    groupBand: 'CONSOLIDATION_STANDARD' as const,
  });
}

function answersAllWrongConfident(): Record<string, { optionId: string; confidence: 1 | 2 | 3 | 4 }> {
  const answers: Record<string, { optionId: string; confidence: 1 | 2 | 3 | 4 }> = {};
  for (const item of PACK.questionnaire.items) {
    const wrong = item.options.find(({ isCorrect }) => !isCorrect)!;
    answers[item.id] = { optionId: wrong.id, confidence: 4 };
  }
  return answers;
}

const FACTS = buildStudentFactsPayload(factSheet(), PACK, answersAllWrongConfident(), 'Mathématiques');

function validBriefContent(): TeacherBriefContent {
  return {
    version: TEACHER_BRIEF_PROMPT_VERSION,
    domaines: FACTS.domainesPrioritaires.map((domaine) => ({
      domainId: domaine.domainId,
      erreursTypiques: [{
        constat: 'L’élève applique la règle des signes à un produit de relatifs sans distinguer somme et produit.',
        origine: 'Confusion entre les règles d’addition et de multiplication des relatifs.',
        itemIds: [domaine.itemsRates[0]?.itemId ?? 'X'],
      }],
      prerequisAVerifier: ['Règle des signes pour la multiplication de deux relatifs.'],
      activite: {
        titre: 'Le tribunal des signes',
        objectif: 'Chaque élève justifie oralement le signe d’un produit avant de calculer.',
        materiel: 'Cartes signes, ardoises.',
        deroule: [
          { nom: 'Mise en défaut', dureeMin: 10, consigne: 'Proposez ce calcul piégé et laissez chacun répondre sur ardoise.' },
          { nom: 'Confrontation', dureeMin: 10, consigne: 'Comparez deux réponses opposées et faites verbaliser les règles utilisées.' },
          { nom: 'Reconstruction', dureeMin: 15, consigne: 'Reconstruisez la règle du produit avec les cartes, puis faites reformuler.' },
        ],
        differenciation: 'Pour les plus rapides : produits de trois facteurs ; pour les plus lents : retour aux déplacements sur l’axe.',
      },
      indicateurProgres: 'L’élève annonce le signe correct de trois produits successifs en justifiant à voix haute.',
    })),
  };
}

describe('teacher-brief — schéma et ancrage', () => {
  it('valide un brief conforme et rejette toute clé en plus, domaine vide ou version inconnue', () => {
    expect(teacherBriefSchema.safeParse(validBriefContent()).success).toBe(true);
    const extra = { ...validBriefContent(), inconnue: true } as unknown;
    expect(teacherBriefSchema.safeParse(extra).success).toBe(false);
    const badVersion = { ...validBriefContent(), version: 'teacher-brief.v0' } as unknown;
    expect(teacherBriefSchema.safeParse(badVersion).success).toBe(false);
    const emptyDomains = { ...validBriefContent(), domaines: [] } as unknown;
    expect(teacherBriefSchema.safeParse(emptyDomains).success).toBe(false);
  });

  it('exige la couverture exacte des domaines prioritaires fournis, dans le même ordre', () => {
    const wrongOrder = validBriefContent();
    const swapped = { ...wrongOrder, domaines: [...wrongOrder.domaines].reverse() };
    expect(() => assertBriefRespectsFacts(swapped, FACTS)).toThrow('TEACHER_BRIEF_DOMAIN_MISMATCH');
  });

  it('rejette une erreur typique qui ne cite aucun item réellement fourni', () => {
    const content = validBriefContent();
    const ungrounded = {
      ...content,
      domaines: content.domaines.map((domaine, index) => index === 0
        ? { ...domaine, erreursTypiques: [{ ...domaine.erreursTypiques[0], itemIds: ['ITEM-INVENTE'] }] }
        : domaine),
    };
    expect(() => assertBriefRespectsFacts(ungrounded, FACTS)).toThrow('TEACHER_BRIEF_UNGROUNDED_ERROR');
  });

  it('rejette le lexique interdit même accentué différemment', () => {
    const content = validBriefContent();
    const poisoned = {
      ...content,
      domaines: content.domaines.map((domaine, index) => index === 0
        ? { ...domaine, indicateurProgres: 'La réussite est garantie après cette séance.' }
        : domaine),
    };
    expect(() => assertBriefRespectsFacts(poisoned, FACTS)).toThrow('TEACHER_BRIEF_FORBIDDEN_TERM');
  });
});

describe('teacher-brief — pseudonymisation', () => {
  it('le payload ne contient ni nom, ni e-mail, ni téléphone — uniquement l’alias', () => {
    const serialized = JSON.stringify(FACTS);
    expect(serialized).toContain('ELEVE_BRIEFTEST');
    expect(serialized).not.toMatch(/firstName|lastName|email|phone|@/);
  });

  it('frontière fail-closed : une donnée identifiante dans les faits bloque AVANT tout appel réseau', () => {
    const contaminated = Object.freeze({
      ...factSheet(),
      student: Object.freeze({ alias: 'ELEVE_BRIEFTEST', level: 'contact: kamel.benrhouma@gmail.com' }),
    });
    expect(() => buildStudentFactsPayload(contaminated, PACK, answersAllWrongConfident(), 'Mathématiques'))
      .toThrow('TEACHER_BRIEF_PII_BOUNDARY');
  });

  it('la partie stable du prompt est identique d’un élève à l’autre (cache) et ne contient aucun fait élève', () => {
    const stable = buildStableSystemPrompt();
    expect(stable).toBe(buildStableSystemPrompt());
    expect(stable).not.toContain('ELEVE_BRIEFTEST');
    expect(stable).toContain('Schéma JSON exact');
    expect(stable).toContain('STRICTEMENT interdits');
  });
});

describe('teacher-brief — configuration et coût', () => {
  it('modèle par défaut Sonnet, contraint par l’allowlist, jamais hors liste', () => {
    const config = resolveTeacherBriefConfig({ OPENROUTER_API_KEY: 'k' });
    expect(config.model).toBe('anthropic/claude-sonnet-4.5');
    expect(config.supportsPromptCaching).toBe(true);
    expect(() => resolveTeacherBriefConfig({ OPENROUTER_API_KEY: 'k', NEXUS_TEACHER_BRIEF_MODEL: 'openai/gpt-3.5-turbo' }))
      .toThrow('TEACHER_BRIEF_MODEL_NOT_ALLOWLISTED');
  });

  it('le plafond par défaut couvre le pire cas d’UN domaine, marge comprise', () => {
    // Dimensionné sur le schéma, pas deviné : la sortie maximale d'un domaine
    // convertie en jetons doit tenir sous le plafond, marge incluse.
    const config = resolveTeacherBriefConfig({ OPENROUTER_API_KEY: 'k' });
    expect(config.maxTokens).toBe(TEACHER_BRIEF_DEFAULT_MAX_TOKENS);
    const pireCasEnJetons = TEACHER_BRIEF_DOMAIN_MAX_CHARS / 2.5;
    expect(config.maxTokens).toBeGreaterThan(pireCasEnJetons);
  });

  it('plafonne max_tokens dans la fourchette autorisée, toute valeur hors bornes retombe au défaut', () => {
    const base = { OPENROUTER_API_KEY: 'k' };
    expect(resolveTeacherBriefConfig({ ...base, NEXUS_TEACHER_BRIEF_MAX_TOKENS: '9000' }).maxTokens)
      .toBe(TEACHER_BRIEF_DEFAULT_MAX_TOKENS);
    expect(resolveTeacherBriefConfig({ ...base, NEXUS_TEACHER_BRIEF_MAX_TOKENS: '100' }).maxTokens)
      .toBe(TEACHER_BRIEF_DEFAULT_MAX_TOKENS);
    expect(resolveTeacherBriefConfig({ ...base, NEXUS_TEACHER_BRIEF_MAX_TOKENS: 'beaucoup' }).maxTokens)
      .toBe(TEACHER_BRIEF_DEFAULT_MAX_TOKENS);
    expect(resolveTeacherBriefConfig({ ...base, NEXUS_TEACHER_BRIEF_MAX_TOKENS: '8000' }).maxTokens).toBe(8_000);
  });

  it('modèle, plafond, température et délai sont tous configurables — aucune valeur figée dans le code', () => {
    const config = resolveTeacherBriefConfig({
      OPENROUTER_API_KEY: 'k',
      NEXUS_TEACHER_BRIEF_MODEL: 'mistralai/mistral-large-2512',
      NEXUS_TEACHER_BRIEF_MAX_TOKENS: '6000',
      NEXUS_TEACHER_BRIEF_TEMPERATURE: '0.7',
      NEXUS_TEACHER_BRIEF_TIMEOUT_MS: '60000',
      NEXUS_TEACHER_BRIEF_MONTHLY_BUDGET_USD: '50',
      OPENROUTER_BASE_URL: 'https://exemple.test/api/v1',
    });
    expect(config).toMatchObject({
      model: 'mistralai/mistral-large-2512',
      maxTokens: 6_000,
      temperature: 0.7,
      timeoutMs: 60_000,
      monthlyBudgetUsd: 50,
      baseUrl: 'https://exemple.test/api/v1',
      supportsPromptCaching: false,
    });
  });

  it('estime le coût, cache compris — un appel caché coûte nettement moins', () => {
    const usage = { promptTokens: 10_000, cachedPromptTokens: 0, completionTokens: 1_500 };
    const cachedUsage = { promptTokens: 10_000, cachedPromptTokens: 9_000, completionTokens: 1_500 };
    const fresh = estimateCostUsd('anthropic/claude-sonnet-4.5', usage);
    const cached = estimateCostUsd('anthropic/claude-sonnet-4.5', cachedUsage);
    expect(fresh).toBeCloseTo((10_000 * 3 + 1_500 * 15) / 1_000_000, 6);
    expect(cached).toBeCloseTo((1_000 * 3 + 9_000 * 0.3 + 1_500 * 15) / 1_000_000, 6);
    expect(cached).toBeLessThan(fresh);
  });
});

describe('teacher-brief — appel modèle, un appel par domaine', () => {
  const config = resolveTeacherBriefConfig({ OPENROUTER_API_KEY: 'test-key' });

  function fetchReturning(body: unknown): typeof fetch {
    return (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch;
  }

  /**
   * Modèle simulé fidèle au contrat v2 : il reçoit UN domaine et renvoie ce
   * domaine-là, développé au maximum autorisé par le schéma. `calls` retient
   * chaque requête pour vérifier le découpage et le dimensionnement.
   */
  function domainAwareFetch(calls: { body: unknown }[] = []): { fetch: typeof fetch; calls: { body: unknown }[] } {
    const impl: typeof fetch = (async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      calls.push({ body });
      const facts = JSON.parse(body.messages[1].content) as typeof FACTS;
      expect(facts.domainesPrioritaires).toHaveLength(1);
      const asked = facts.domainesPrioritaires[0];
      const full = validBriefContent().domaines.find((d) => d.domainId === asked.domainId)!;
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ version: TEACHER_BRIEF_PROMPT_VERSION, domaines: [full] }) } }],
        usage: { prompt_tokens: 2_300, completion_tokens: 1_200, prompt_tokens_details: { cached_tokens: 1_710 } },
      }), { status: 200 });
    }) as typeof fetch;
    return { fetch: impl, calls };
  }

  it('GARDE : un bilan à 4 domaines prioritaires produit un brief COMPLET, jamais tronqué', async () => {
    expect(FACTS.domainesPrioritaires).toHaveLength(4);
    const { fetch: impl, calls } = domainAwareFetch();
    const generation = await callTeacherBriefModel(config, FACTS, impl);

    // Un appel par domaine : la sortie d'un appel ne dépend pas du nombre de domaines.
    expect(calls).toHaveLength(4);
    // Le brief réassemblé couvre les 4 domaines, dans l'ordre des priorités.
    expect(generation.content.domaines.map((d) => d.domainId))
      .toEqual(FACTS.domainesPrioritaires.map((d) => d.domainId));
    // Chaque domaine porte les 4 éléments attendus, aucun tronqué.
    for (const domaine of generation.content.domaines) {
      expect(domaine.erreursTypiques.length).toBeGreaterThanOrEqual(1);
      expect(domaine.prerequisAVerifier.length).toBeGreaterThanOrEqual(1);
      expect(domaine.activite.deroule.length).toBeGreaterThanOrEqual(3);
      expect(domaine.indicateurProgres.trim().length).toBeGreaterThan(0);
    }
    // Le contenu réassemblé satisfait le schéma STOCKÉ, inchangé.
    expect(teacherBriefSchema.safeParse(generation.content).success).toBe(true);
    // Usage agrégé sur les 4 appels.
    expect(generation.promptTokens).toBe(4 * 2_300);
    expect(generation.cachedPromptTokens).toBe(4 * 1_710);
    expect(generation.completionTokens).toBe(4 * 1_200);
  });

  it('chaque appel est dimensionné sur le pire cas d’UN domaine et garde le cache prompting', async () => {
    const { fetch: impl, calls } = domainAwareFetch();
    await callTeacherBriefModel(config, FACTS, impl);
    for (const { body } of calls) {
      const sent = body as { max_tokens: number; messages: { content: unknown }[] };
      expect(sent.max_tokens).toBe(TEACHER_BRIEF_DEFAULT_MAX_TOKENS);
      const system = sent.messages[0].content as { text: string; cache_control?: { type: string } }[];
      expect(Array.isArray(system)).toBe(true);
      expect(system[0].cache_control).toEqual({ type: 'ephemeral' });
      // La partie mise en cache est rigoureusement identique d'un appel à l'autre.
      expect(system[0].text).toBe(buildStableSystemPrompt());
    }
  });

  it('une sortie coupée au plafond est nommée pour ce qu’elle est, jamais confondue avec un JSON invalide', async () => {
    const truncated = fetchReturning({
      choices: [{ finish_reason: 'length', message: { content: '{"version":"teacher-brief.v2","domaines":[{"domainId":"calcul' } }],
    });
    await expect(callTeacherBriefModel(config, FACTS, truncated)).rejects.toThrow('TEACHER_BRIEF_TRUNCATED');
  });

  it('rejette une réponse portant plusieurs domaines alors qu’un seul était demandé', async () => {
    const multi = fetchReturning({ choices: [{ message: { content: JSON.stringify(validBriefContent()) } }] });
    await expect(callTeacherBriefModel(config, FACTS, multi)).rejects.toThrow('TEACHER_BRIEF_SCHEMA_REJECTED');
  });

  it('rejette une sortie non conforme au schéma — jamais rafistolée', async () => {
    const bad = fetchReturning({ choices: [{ message: { content: JSON.stringify({ version: TEACHER_BRIEF_PROMPT_VERSION, domaines: [{}] }) } }] });
    await expect(callTeacherBriefModel(config, FACTS, bad)).rejects.toThrow('TEACHER_BRIEF_SCHEMA_REJECTED');
  });

  it('rejette un JSON invalide et un contenu vide', async () => {
    await expect(callTeacherBriefModel(config, FACTS, fetchReturning({ choices: [{ message: { content: 'pas du json' } }] })))
      .rejects.toThrow('TEACHER_BRIEF_INVALID_JSON');
    await expect(callTeacherBriefModel(config, FACTS, fetchReturning({ choices: [{ message: { content: '' } }] })))
      .rejects.toThrow('TEACHER_BRIEF_EMPTY');
  });

  it('GARDE : un domaine prioritaire SANS item raté produit un brief valide, jamais un repli', async () => {
    // Profil de la maîtrise fragile : l'élève répond juste mais sans
    // assurance. Le domaine est prioritaire et n'a pourtant rien à citer.
    // Exiger une citation ici faisait perdre le brief ENTIER.
    const sansItems = FACTS.domainesPrioritaires.find((d) => d.itemsRates.length === 0)
      ?? { ...FACTS.domainesPrioritaires[0], itemsRates: [] };
    const facts = { ...FACTS, domainesPrioritaires: [sansItems, FACTS.domainesPrioritaires[1]] } as typeof FACTS;

    const impl: typeof fetch = (async (_url: unknown, init?: RequestInit) => {
      const asked = (JSON.parse(JSON.parse(String(init?.body)).messages[1].content) as typeof FACTS)
        .domainesPrioritaires[0];
      const modele = validBriefContent().domaines.find((d) => d.domainId === asked.domainId)!;
      const domaine = {
        ...modele,
        // Aucun item raté => aucune citation possible.
        erreursTypiques: modele.erreursTypiques.map((erreur) => ({
          ...erreur,
          itemIds: asked.itemsRates.length === 0 ? [] : erreur.itemIds,
        })),
      };
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ version: TEACHER_BRIEF_PROMPT_VERSION, domaines: [domaine] }) } }],
        usage: { prompt_tokens: 2_300, completion_tokens: 1_400 },
      }), { status: 200 });
    }) as typeof fetch;

    const generation = await callTeacherBriefModel(config, facts, impl);
    expect(generation.content.domaines).toHaveLength(2);
    expect(generation.content.domaines[0].erreursTypiques[0].itemIds).toEqual([]);
    expect(generation.content.domaines[0].activite.deroule.length).toBeGreaterThanOrEqual(3);
  });

  it('GARDE : dès qu’un domaine A des items ratés, l’absence de citation reste refusée', () => {
    const avecItems = FACTS.domainesPrioritaires.find((d) => d.itemsRates.length > 0)!;
    const content = validBriefContent();
    const nonAncre = {
      ...content,
      domaines: content.domaines.map((domaine) => (
        domaine.domainId === avecItems.domainId
          ? { ...domaine, erreursTypiques: [{ ...domaine.erreursTypiques[0], itemIds: [] }] }
          : domaine
      )),
    };
    expect(() => assertBriefRespectsFacts(nonAncre, FACTS)).toThrow('TEACHER_BRIEF_UNGROUNDED_ERROR');
  });

  it('fail-closed : un seul domaine en échec et AUCUN brief partiel n’est produit', async () => {
    let call = 0;
    const flaky: typeof fetch = (async (_url: unknown, init?: RequestInit) => {
      call += 1;
      const facts = JSON.parse(JSON.parse(String(init?.body)).messages[1].content) as typeof FACTS;
      if (call === 3) return new Response(JSON.stringify({ choices: [{ message: { content: 'panne' } }] }), { status: 200 });
      const full = validBriefContent().domaines.find((d) => d.domainId === facts.domainesPrioritaires[0].domainId)!;
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ version: TEACHER_BRIEF_PROMPT_VERSION, domaines: [full] }) } }],
        usage: { prompt_tokens: 2_300, completion_tokens: 1_200 },
      }), { status: 200 });
    }) as typeof fetch;
    await expect(callTeacherBriefModel(config, FACTS, flaky)).rejects.toThrow('TEACHER_BRIEF_INVALID_JSON');
  });
});

describe('teacher-brief — orchestration, repli, budget, idempotence', () => {
  function database(overrides: Partial<Record<string, unknown>> = {}) {
    const writes: string[] = [];
    const db = {
      teacherBrief: {
        findFirst: jest.fn(async () => null),
        aggregate: jest.fn(async () => ({ _sum: { estimatedCostUsd: 0 }, _count: { id: 0 } })),
        create: jest.fn(async () => { writes.push('teacherBrief.create'); return { id: 'brief-1', version: 1 }; }),
        updateMany: jest.fn(async () => ({ count: 0 })),
      },
      reportArtifact: { findUnique: jest.fn(async () => null) },
      reportRevision: { updateMany: jest.fn(async () => { writes.push('reportRevision.updateMany'); }) },
      reportMaterialization: { create: jest.fn(async () => { writes.push('reportMaterialization.create'); }) },
      $transaction: jest.fn(),
      ...overrides,
    };
    (db.$transaction as jest.Mock).mockImplementation(async (callback: (t: unknown) => Promise<unknown>) => callback(db));
    return { db, writes };
  }
  const actor = { userId: 'assistante-1', role: 'ASSISTANTE' } as const;

  it('REPLI : clé absente → PLANCHER, aucune écriture, aucune erreur bloquante', async () => {
    const { db, writes } = database();
    const result = await generateTeacherBrief({
      prisma: db as never, actor, reportArtifactId: 'art-1', environment: {},
    });
    expect(result).toEqual({ mode: 'PLANCHER', reason: 'OPENROUTER_API_KEY_MISSING' });
    expect(writes).toHaveLength(0);
  });

  it('REPLI : budget mensuel dépassé → PLANCHER', async () => {
    const { db } = database({
      teacherBrief: {
        findFirst: jest.fn(async () => null),
        aggregate: jest.fn(async () => ({ _sum: { estimatedCostUsd: 25 }, _count: { id: 40 } })),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    });
    const result = await generateTeacherBrief({
      prisma: db as never, actor, reportArtifactId: 'art-1',
      environment: { OPENROUTER_API_KEY: 'k', NEXUS_TEACHER_BRIEF_MONTHLY_BUDGET_USD: '20' },
    });
    expect(result).toEqual({ mode: 'PLANCHER', reason: 'TEACHER_BRIEF_BUDGET_EXCEEDED' });
  });

  it('cache applicatif : un brief déjà présent (relu ou en attente) ne se régénère jamais', async () => {
    const { db } = database({
      teacherBrief: {
        findFirst: jest.fn(async () => ({ id: 'brief-42' })),
        aggregate: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    });
    const result = await generateTeacherBrief({
      prisma: db as never, actor, reportArtifactId: 'art-1', environment: { OPENROUTER_API_KEY: 'k' },
    });
    expect(result).toEqual({ mode: 'ALREADY_PRESENT', briefId: 'brief-42' });
  });

  it('GARDE : le service brief n’écrit JAMAIS dans les révisions ni les matérialisations (élève/parents 100 % déterministes)', async () => {
    const answers = answersAllWrongConfident();
    const { db, writes } = database({
      reportArtifact: {
        findUnique: jest.fn(async () => ({
          id: 'art-1',
          assessmentAttempt: {
            answers,
            assessmentPackId: PACK.slug,
            assessmentPackVersion: String(PACK.version),
            assessmentPackChecksum: 'checksum-pack',
          },
          revisions: [{ scoreSnapshotId: 'snap-1', scoreSnapshot: { result: factSheet() } }],
        })),
      },
    });
    // Un appel par domaine : le modèle simulé renvoie le domaine demandé.
    const fetchOk: typeof fetch = (async (_url: unknown, init?: RequestInit) => {
      const facts = JSON.parse(JSON.parse(String(init?.body)).messages[1].content) as typeof FACTS;
      const domaine = validBriefContent().domaines
        .find((d) => d.domainId === facts.domainesPrioritaires[0].domainId)!;
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ version: TEACHER_BRIEF_PROMPT_VERSION, domaines: [domaine] }) } }],
        usage: { prompt_tokens: 2_300, completion_tokens: 1_100, prompt_tokens_details: { cached_tokens: 1_710 } },
      }), { status: 200 });
    }) as typeof fetch;
    const result = await generateTeacherBrief({
      prisma: db as never, actor, reportArtifactId: 'art-1',
      environment: { OPENROUTER_API_KEY: 'k' },
      resolvePack: () => ({ pack: PACK, validatedPack: null as never, checksum: 'checksum-pack', path: 'x' }),
      fetchImpl: fetchOk,
    });
    expect(result.mode).toBe('GENERATED');
    expect(writes).toEqual(['teacherBrief.create']);
    expect(writes).not.toContain('reportRevision.updateMany');
    expect(writes).not.toContain('reportMaterialization.create');
  });

  it('REPLI : transport en erreur → PLANCHER, rien n’est écrit', async () => {
    const answers = answersAllWrongConfident();
    const { db, writes } = database({
      reportArtifact: {
        findUnique: jest.fn(async () => ({
          id: 'art-1',
          assessmentAttempt: {
            answers,
            assessmentPackId: PACK.slug,
            assessmentPackVersion: String(PACK.version),
            assessmentPackChecksum: 'checksum-pack',
          },
          revisions: [{ scoreSnapshotId: 'snap-1', scoreSnapshot: { result: factSheet() } }],
        })),
      },
    });
    const fetch500: typeof fetch = (async () => new Response('{}', { status: 500 })) as typeof fetch;
    const result = await generateTeacherBrief({
      prisma: db as never, actor, reportArtifactId: 'art-1',
      environment: { OPENROUTER_API_KEY: 'k' },
      resolvePack: () => ({ pack: PACK, validatedPack: null as never, checksum: 'checksum-pack', path: 'x' }),
      fetchImpl: fetch500,
    });
    expect(result).toEqual({ mode: 'PLANCHER', reason: 'TEACHER_BRIEF_HTTP_500' });
    expect(writes).toHaveLength(0);
  });

  it('refuse tout autre rôle que l’assistante', async () => {
    const { db } = database();
    await expect(generateTeacherBrief({
      prisma: db as never, actor: { userId: 'coach', role: 'COACH' }, reportArtifactId: 'art-1',
    })).rejects.toThrow('NOT_FOUND');
  });
});

describe('teacher-brief — verrou de narration familles', () => {
  it('le worker familles reste déterministe même clé présente, tant que le flag explicite est absent', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'lib/bilans/worker/generate-report-job.ts'), 'utf8');
    expect(source).toContain('NEXUS_BILAN_FAMILY_NARRATION_ENABLED');
    const lockIndex = source.indexOf("process.env.NEXUS_BILAN_FAMILY_NARRATION_ENABLED");
    const flipIndex = source.indexOf('\u2500\u2500 FLIP POINT');
    expect(lockIndex).toBeGreaterThan(-1);
    expect(flipIndex).toBeGreaterThan(-1);
    // Le verrou est évalué AVANT le FLIP POINT.
    expect(lockIndex).toBeLessThan(flipIndex);
  });
});

describe('teacher-brief — usage mensuel consultable', () => {
  it('agrège briefs, jetons (cache compris) et coût estimé', async () => {
    const db = {
      teacherBrief: {
        aggregate: jest.fn(async () => ({
          _count: { id: 7 },
          _sum: { promptTokens: 70_000, cachedPromptTokens: 54_000, completionTokens: 9_100, estimatedCostUsd: 0.42 },
        })),
      },
    };
    const usage = await teacherBriefMonthlyUsage({ prisma: db as never });
    expect(usage).toEqual({
      briefs: 7, promptTokens: 70_000, cachedPromptTokens: 54_000, completionTokens: 9_100, estimatedCostUsd: 0.42,
    });
  });
});
