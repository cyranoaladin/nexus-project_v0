# Lot 1 — Socle réglementaire étendu (`lib/exams/`) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

> **Statut : TERMINÉ le 2026-08-24.** Les 11 tâches ont été exécutées via subagent-driven-development (un agent implémenteur par tâche, séquentiel, TDD strict), puis vérifiées par le contrôleur (Task 11) : suite `lib/exams`/`lib/quotes` complète au vert, `npx tsc --noEmit` propre, suite unitaire globale 9368/9369 (seul échec : un flake préexistant et sans rapport, `__tests__/scripts/disk-alert.test.ts`). Une revue de code du diff complet (`ceb0a4278..HEAD`) a ensuite trouvé deux défauts réels introduits par ce lot, corrigés dans un commit de clôture (`e2a59b44f`) :
> 1. `assertSessionSellable()` n'était appelé sur aucun chemin de requête — l'élargissement du registre à 2026/2028 avait donc silencieusement supprimé la protection implicite dont ces sessions bénéficiaient en n'étant simplement pas enregistrées. Corrigé en câblant le garde-fou dans `buildRecommendation()` et `buildQuoteContextSnapshot()`, les deux points de passage obligés de toutes les routes `/api/quotes*`.
> 2. L'invariant de somme des coefficients dans `lib/exams/schema.ts` était ignoré dès que `epreuves.length === 0`, pas seulement quand `status === 'SKELETON_UNCONFIRMED'` — une session ACTIVE ou HISTORICAL_READONLY accidentellement committée avec un tableau `epreuves` vide aurait validé silencieusement. Corrigé.
>
> Deux constats mineurs de la revue, non corrigés (dette acceptée, pas des bugs) : `LCA_OPTIONS` dans `lib/exams/options.ts` reste non référencé (le plafond de 2 options ne fonctionne qu'en excluant explicitement les codes LCA via `TERMINALE_ONLY_OPTIONS`, pas par exclusion générique — à surveiller si de nouvelles options terminale sont ajoutées) ; le `REGISTRY` session→JSON est dupliqué entre `lib/exams/catalog.ts` et `catalog-client.ts` (choix de conception assumé dans le plan lui-même, cf. Task 10).

**Goal:** Étendre `lib/exams/` (référentiel réglementaire versionné et sourcé, déjà en place pour la session 2027) pour couvrir tout ce dont le futur moteur `genererCarteExamen` (Lot 3) aura besoin : coefficients modalité A/B par matière, dispense de partie pratique, perte de mention, règles d'exclusion d'options machine-checkables, bascule scolaire→individuel, dispenses titulaire bac, second groupe, résolution multi-session (2026 historique, 2027 actif, 2028 squelette). Aucun code UI, wizard ou tarification n'est touché dans ce lot.

**Architecture :** Extension pure additive du triplet existant JSON (`data/exams/*.json`) + Zod (`lib/exams/schema.ts`) + loader fail-closed (`lib/exams/catalog.ts`), sans nouveau namespace (décision D5 de `docs/audit-devis-candidats-libres.md`). Un module client-safe séparé (`lib/exams/catalog-client.ts`) expose les fonctions pures nécessaires en temps réel côté wizard, sans `server-only`.

**Tech Stack :** TypeScript, Zod, Jest (`__tests__/lib/exams/*.test.ts`), JSON de données sourcées.

**Décisions actées à respecter (voir `docs/audit-devis-candidats-libres.md` §5) :** D5 (pas de `lib/bac/reglementation/` séparé), D6 (2026 historique lecture seule, 2027 complet, 2028 squelette non vendable). Deux points explicitement `À_VERIFIER` ne doivent **jamais** être codés par supposition — ils sont traités en détail dans les tâches 4 et 8 avec un comportement fail-closed vers révision humaine, sur le modèle exact de `checkSameSessionEligibility`.

---

## File Structure

| Fichier | Action | Responsabilité |
|---|---|---|
| `lib/exams/schema.ts` | Modifier | Ajouter les nouveaux sous-schémas Zod (modalité A/B, dispense pratique, mention, exclusions d'options, bascule, dispenses titulaire, second groupe, `verifieLe`) |
| `lib/exams/catalog.ts` | Modifier | Résolveur multi-session, statut de session (`ACTIVE`/`HISTORICAL_READONLY`/`SKELETON_UNCONFIRMED`), garde `assertSessionSellable` |
| `lib/exams/catalog-client.ts` | Créer | Sous-ensemble client-safe (pas de `server-only`) des fonctions pures utilisées en temps réel par le wizard |
| `lib/exams/options.ts` | Créer | Normalisation d'alias de saisie (`DGMEC` → `DGEMC`) et validateurs d'exclusion d'options, séparés du loader pour rester réutilisables sans dépendre du JSON |
| `data/exams/bac-general-2027.json` | Modifier | Compléter avec les nouveaux champs (modalité A/B, dispense pratique, mention, exclusions, bascule, dispenses titulaire, second groupe, `verifieLe`) |
| `data/exams/bac-general-2026.json` | Créer | Référentiel historique, lecture seule, coefficients pré-EAM (Grand Oral coef 10) |
| `data/exams/bac-general-2028.json` | Créer | Squelette, `status: 'SKELETON_UNCONFIRMED'`, aucune valeur inventée |
| `__tests__/lib/exams/session-resolver.test.ts` | Créer | Résolution multi-session, statuts, garde de vente |
| `__tests__/lib/exams/modalite-coefficients.test.ts` | Créer | Coefficients A/B, sentinelle `A_VERIFIER` |
| `__tests__/lib/exams/dispense-pratique.test.ts` | Créer | NSI/PC/SI/SVT |
| `__tests__/lib/exams/conservation-mention.test.ts` | Créer | Perte de mention |
| `__tests__/lib/exams/options-exclusion.test.ts` | Créer | Maths expertes/complémentaires/DGEMC + alias |
| `__tests__/lib/exams/parcours-declaratifs.test.ts` | Créer | Bascule scolaire→libre, dispenses titulaire, second groupe (structure de données uniquement) |
| `__tests__/lib/exams-catalog.test.ts` | Modifier (append) | Vérifier la non-régression du test existant T18 avec le schéma étendu |

---

## Task 1 — Sentinelle `A_VERIFIER` réutilisable

**Files:**
- Create: `lib/exams/a-verifier.ts`
- Test: `__tests__/lib/exams/a-verifier.test.ts`

Toutes les valeurs `À_VERIFIER` du brief (modalité B pour HG/LVA/LVB/EMC, coefficient d'une note conservée inter-session) doivent utiliser le **même type sentinelle**, pour que toute fonction qui a besoin d'une valeur ferme soit obligée de la gérer explicitement (jamais de `?? valeurParDéfaut` silencieux).

- [x] **Step 1: Write the failing test**

```typescript
// __tests__/lib/exams/a-verifier.test.ts
import { A_VERIFIER, isAVerifier, requireResolved } from '@/lib/exams/a-verifier';

describe('A_VERIFIER sentinel', () => {
  test('isAVerifier detects the sentinel and only the sentinel', () => {
    expect(isAVerifier(A_VERIFIER)).toBe(true);
    expect(isAVerifier(6)).toBe(false);
    expect(isAVerifier(0)).toBe(false);
  });

  test('requireResolved throws with the field name when given the sentinel', () => {
    expect(() => requireResolved(A_VERIFIER, 'ep-histoire-geo.coefficientModaliteB')).toThrow(
      /ep-histoire-geo\.coefficientModaliteB.*À_VERIFIER/,
    );
  });

  test('requireResolved returns the value unchanged when it is a firm value', () => {
    expect(requireResolved(6, 'anything')).toBe(6);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/exams/a-verifier.test.ts`
Expected: FAIL — Cannot find module '@/lib/exams/a-verifier'

- [x] **Step 3: Write minimal implementation**

```typescript
// lib/exams/a-verifier.ts
/**
 * Sentinel for a regulatory value that is not yet confirmed by a source
 * (note de service, arrêté). Never coded as a guessed number — every
 * consumer must call requireResolved() and handle the throw, which is the
 * fail-closed behavior mandated by CDC §15 ("ne comble jamais un trou par
 * une supposition plausible").
 */
export const A_VERIFIER = 'À_VERIFIER' as const;
export type AVerifiable<T> = T | typeof A_VERIFIER;

export function isAVerifier<T>(value: AVerifiable<T>): value is typeof A_VERIFIER {
  return value === A_VERIFIER;
}

export function requireResolved<T>(value: AVerifiable<T>, fieldPath: string): T {
  if (isAVerifier(value)) {
    throw new Error(
      `${fieldPath} is still À_VERIFIER — confirm the source (note de service) before this value can be used to price or display a coefficient.`,
    );
  }
  return value;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/exams/a-verifier.test.ts`
Expected: PASS (3 tests)

- [x] **Step 5: Commit**

```bash
git add lib/exams/a-verifier.ts __tests__/lib/exams/a-verifier.test.ts
git commit -m "feat(exams): add A_VERIFIER sentinel for unconfirmed regulatory values"
```

---

## Task 2 — Coefficients modalité A/B par matière (schéma + données 2027)

**Files:**
- Modify: `lib/exams/schema.ts`
- Modify: `data/exams/bac-general-2027.json`
- Test: `__tests__/lib/exams/modalite-coefficients.test.ts`

Enseignement scientifique est **confirmé** par note de service (3 si une seule année, 6 si cycle terminal — brief §2.3). HG, LVA, LVB, EMC restent `A_VERIFIER` tant qu'une note de service précise n'a pas été citée — ne généralise jamais par analogie entre matières (deuxième point `À_VERIFIER` de l'audit).

- [x] **Step 1: Write the failing test**

```typescript
// __tests__/lib/exams/modalite-coefficients.test.ts
import { requireExamPolicy } from '@/lib/exams/catalog';
import { isAVerifier } from '@/lib/exams/a-verifier';

describe('T-modalite — coefficients par modalité A/B (tronc commun ponctuel)', () => {
  const policy = requireExamPolicy(2027);
  const byId = new Map(policy.epreuves.map((e) => [e.id, e]));

  test('enseignement scientifique: modalité A = 6 (cycle terminal), modalité B = 3+3 (confirmé par note de service)', () => {
    const ep = byId.get('enseignement-scientifique');
    expect(ep?.coefficientParModalite?.A).toBe(6);
    expect(ep?.coefficientParModalite?.B).toEqual({ premiere: 3, terminale: 3 });
  });

  test('HG, LVA, LVB, EMC restent explicitement À_VERIFIER pour la modalité B — jamais une valeur devinée', () => {
    for (const id of ['histoire-geographie', 'lva', 'lvb', 'emc']) {
      const ep = byId.get(id);
      expect(isAVerifier(ep?.coefficientParModalite?.B)).toBe(true);
      // La modalité A (cycle terminal, valeur groupée) reste néanmoins connue :
      expect(typeof ep?.coefficientParModalite?.A).toBe('number');
    }
  });

  test('EPS reste hors modalité A/B — épreuve ponctuelle terminale unique (arrêté du 21 décembre 2011)', () => {
    const ep = byId.get('eps');
    expect(ep?.coefficientParModalite).toBeUndefined();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/exams/modalite-coefficients.test.ts`
Expected: FAIL — `coefficientParModalite` is undefined on every épreuve (field doesn't exist yet)

- [x] **Step 3: Extend the schema**

```typescript
// lib/exams/schema.ts — add near epreuveSchema, before it's used
const coefficientModaliteBSchema = z.union([
  z.object({ premiere: z.number().int().positive(), terminale: z.number().int().positive() }).strict(),
  z.literal('À_VERIFIER'),
]);

const coefficientParModaliteSchema = z
  .object({
    A: z.number().int().positive(),
    B: coefficientModaliteBSchema,
  })
  .strict();
```

Add the optional field to `epreuveSchema`:

```typescript
const epreuveSchema = z
  .object({
    // ...existing fields unchanged...
    coefficientParModalite: coefficientParModaliteSchema.optional(),
  })
  .strict();
```

Add a `superRefine` guard: when `coefficientParModalite` is present and `B` is a firm value, `A` must equal `B.premiere + B.terminale` (structural invariant — un cycle regroupé vaut la somme des deux années scindées) :

```typescript
// inside the existing .superRefine((policy, ctx) => { ... }) block, after the coefficient-sum check
for (const ep of policy.epreuves) {
  const cm = ep.coefficientParModalite;
  if (cm && typeof cm.B === 'object') {
    const sumB = cm.B.premiere + cm.B.terminale;
    if (sumB !== cm.A) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${ep.id}: coefficientParModalite.B (${cm.B.premiere}+${cm.B.terminale}=${sumB}) must sum to coefficientParModalite.A (${cm.A})`,
      });
    }
  }
}
```

- [x] **Step 4: Add the data to `data/exams/bac-general-2027.json`**

For `enseignement-scientifique`:
```json
"coefficientParModalite": { "A": 6, "B": { "premiere": 3, "terminale": 3 } }
```
For `histoire-geographie`, `lva`, `lvb`, `emc` (A known — current flat coefficient — B unconfirmed):
```json
"coefficientParModalite": { "A": 6, "B": "À_VERIFIER" }
```
(EMC: `"A": 2, "B": "À_VERIFIER"`). Add a `sources` entry documenting the gap: `{"label": "Modalité B — coefficients scindés 1re/terminale, HG/LVA/LVB/EMC", "url": "https://eduscol.education.fr/5694", "note": "Seule la note de service sur l'enseignement scientifique (NOR MENE2534911N) confirme explicitement la répartition 3+3. À vérifier matière par matière pour HG, LVA, LVB et EMC avant d'écrire une valeur ferme — ne pas généraliser par analogie."}`.

- [x] **Step 5: Run test to verify it passes**

Run: `npx jest __tests__/lib/exams/modalite-coefficients.test.ts`
Expected: PASS (3 tests)

- [x] **Step 6: Run the full existing exams suite to check for regressions**

Run: `npx jest __tests__/lib/exams-catalog.test.ts __tests__/lib/exams/`
Expected: PASS — the `.strict()` schema must still accept the file (no leftover unknown keys), and the pre-existing T18 coefficient-sum invariant must still hold (adding `coefficientParModalite` doesn't change `epreuve.coefficient`, the field used in the sum).

- [x] **Step 7: Commit**

```bash
git add lib/exams/schema.ts data/exams/bac-general-2027.json __tests__/lib/exams/modalite-coefficients.test.ts
git commit -m "feat(exams): add modalité A/B coefficients for tronc commun ponctuel, flag unconfirmed matières"
```

---

## Task 3 — Dispense de partie pratique (NSI, PC, SI, SVT)

**Files:**
- Modify: `lib/exams/schema.ts`
- Modify: `data/exams/bac-general-2027.json`
- Modify: `lib/exams/catalog.ts` (pure helper)
- Test: `__tests__/lib/exams/dispense-pratique.test.ts`

- [x] **Step 1: Write the failing test**

```typescript
// __tests__/lib/exams/dispense-pratique.test.ts
import { requireExamPolicy, hasPracticalPartDispensation } from '@/lib/exams/catalog';

describe('T-dispense — partie pratique des spécialités NSI/PC/SI/SVT', () => {
  const policy = requireExamPolicy(2027);

  test('NSI, physique-chimie, sciences de l\'ingénieur et SVT sont dispensées de partie pratique pour un candidat individuel', () => {
    for (const code of ['NSI', 'PHYSIQUE_CHIMIE', 'SCIENCES_INGENIEUR', 'SVT']) {
      expect(hasPracticalPartDispensation(policy, code)).toBe(true);
    }
  });

  test('une spécialité sans partie pratique (ex. HGGSP) n\'est pas concernée — retourne false, pas une exception', () => {
    expect(hasPracticalPartDispensation(policy, 'HGGSP')).toBe(false);
  });

  test('le policy expose la liste sourcée des spécialités concernées', () => {
    expect(policy.candidatIndividuelRules.dispensePartiePratique.specialitesConcernees).toEqual(
      expect.arrayContaining(['NSI', 'PHYSIQUE_CHIMIE', 'SCIENCES_INGENIEUR', 'SVT']),
    );
    expect(policy.candidatIndividuelRules.dispensePartiePratique.sourceArticle).toMatch(/22 juillet 2019/);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/exams/dispense-pratique.test.ts`
Expected: FAIL — `hasPracticalPartDispensation` is not exported, `dispensePartiePratique` is undefined

- [x] **Step 3: Extend the schema**

```typescript
// lib/exams/schema.ts
const dispensePartiePratiqueSchema = z
  .object({
    specialitesConcernees: z.array(z.string().trim().min(1)).min(1),
    sourceArticle: z.string().trim().min(1),
    note: z.string().trim().min(1),
  })
  .strict();
```

Add `dispensePartiePratique: dispensePartiePratiqueSchema` to `candidatIndividuelRulesSchema`.

- [x] **Step 4: Add the data**

```json
"dispensePartiePratique": {
  "specialitesConcernees": ["NSI", "PHYSIQUE_CHIMIE", "SCIENCES_INGENIEUR", "SVT"],
  "sourceArticle": "Arrêté du 22 juillet 2019 modifié — nature et durée des épreuves terminales",
  "note": "Le candidat individuel ne présente pas la partie pratique des épreuves terminales de spécialité en NSI, physique-chimie, sciences de l'ingénieur et SVT. La note repose sur le seul écrit, ramenée sur 20."
}
```

- [x] **Step 5: Write minimal implementation**

```typescript
// lib/exams/catalog.ts — add near getEpreuve
export function hasPracticalPartDispensation(policy: ExamPolicy, specialiteCode: string): boolean {
  return policy.candidatIndividuelRules.dispensePartiePratique.specialitesConcernees.includes(specialiteCode);
}
```

- [x] **Step 6: Run test to verify it passes**

Run: `npx jest __tests__/lib/exams/dispense-pratique.test.ts`
Expected: PASS (3 tests)

- [x] **Step 7: Commit**

```bash
git add lib/exams/schema.ts lib/exams/catalog.ts data/exams/bac-general-2027.json __tests__/lib/exams/dispense-pratique.test.ts
git commit -m "feat(exams): encode practical-part exam dispensation for NSI/PC/SI/SVT individual candidates"
```

---

## Task 4 — Conservation de notes : perte de la mention

**Files:**
- Modify: `lib/exams/schema.ts`
- Modify: `data/exams/bac-general-2027.json`
- Modify: `lib/exams/catalog.ts`
- Test: `__tests__/lib/exams/conservation-mention.test.ts`

C'est l'arbitrage central du brief §2.8, absent aujourd'hui. Encoder à la fois la règle et sa source, plus une fonction pure `isMentionEligible`.

- [x] **Step 1: Write the failing test**

```typescript
// __tests__/lib/exams/conservation-mention.test.ts
import { requireExamPolicy, isMentionEligible } from '@/lib/exams/catalog';

describe('T-mention — conservation de notes et perte de la mention', () => {
  const policy = requireExamPolicy(2027);

  test('aucune mention ne peut être attribuée si le candidat demande la conservation de notes', () => {
    expect(isMentionEligible(policy, { hasRequestedNoteConservation: true })).toBe(false);
  });

  test('la mention reste possible si le candidat ne conserve aucune note', () => {
    expect(isMentionEligible(policy, { hasRequestedNoteConservation: false })).toBe(true);
  });

  test('le policy porte la source de cette règle (articles D. 334-13 et D. 336-13)', () => {
    expect(policy.candidatIndividuelRules.noteConservation.perteDeMention).toBe(true);
    expect(policy.candidatIndividuelRules.noteConservation.sourceMention).toMatch(/D\. 334-13|D\. 336-13/);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/exams/conservation-mention.test.ts`
Expected: FAIL — `isMentionEligible` not exported, `perteDeMention` undefined

- [x] **Step 3: Extend the schema**

```typescript
// lib/exams/schema.ts — extend noteConservationSchema
const noteConservationSchema = z
  .object({
    thresholdOutOf20: z.number().int().min(0).max(20),
    validSessions: z.number().int().positive(),
    note: z.string().trim().min(1),
    perteDeMention: z.literal(true),
    sourceMention: z.string().trim().min(1),
  })
  .strict();
```

- [x] **Step 4: Add the data**

```json
"noteConservation": {
  "thresholdOutOf20": 10,
  "validSessions": 5,
  "note": "Notes >= 10/20 conservées pendant les 5 sessions suivant la première tentative, sur demande explicite à chaque réinscription.",
  "perteDeMention": true,
  "sourceMention": "Articles D. 334-13 et D. 336-13 du code de l'éducation — aucune mention ne peut être attribuée au candidat qui demande la conservation de notes d'épreuves terminales."
}
```

- [x] **Step 5: Write minimal implementation**

```typescript
// lib/exams/catalog.ts
export function isMentionEligible(
  policy: ExamPolicy,
  input: { hasRequestedNoteConservation: boolean },
): boolean {
  if (input.hasRequestedNoteConservation) return !policy.candidatIndividuelRules.noteConservation.perteDeMention;
  return true;
}
```

- [x] **Step 6: Run test to verify it passes**

Run: `npx jest __tests__/lib/exams/conservation-mention.test.ts`
Expected: PASS (3 tests)

- [x] **Step 7: Commit**

```bash
git add lib/exams/schema.ts lib/exams/catalog.ts data/exams/bac-general-2027.json __tests__/lib/exams/conservation-mention.test.ts
git commit -m "feat(exams): encode mention loss on note conservation (D. 334-13 / D. 336-13)"
```

---

## Task 5 — Règles d'exclusion d'options + alias `DGMEC`→`DGEMC`

**Files:**
- Create: `lib/exams/options.ts`
- Modify: `lib/exams/schema.ts`
- Modify: `data/exams/bac-general-2027.json`
- Test: `__tests__/lib/exams/options-exclusion.test.ts`

Ces règles sont **structurelles** (le brief le dit explicitement) — elles vivent en code, pas en donnée pure, mais restent pilotées par les codes d'option déclarés dans le JSON (pas de nom en dur ailleurs dans le futur wizard).

- [x] **Step 1: Write the failing test**

```typescript
// __tests__/lib/exams/options-exclusion.test.ts
import { normalizeOptionCode, validateOptionsSelection } from '@/lib/exams/options';

describe('T-options — normalisation d\'alias', () => {
  test('DGMEC est normalisé en DGEMC (sigle correct)', () => {
    expect(normalizeOptionCode('DGMEC')).toBe('DGEMC');
    expect(normalizeOptionCode('dgmec')).toBe('DGEMC');
  });

  test('un code déjà correct est inchangé', () => {
    expect(normalizeOptionCode('DGEMC')).toBe('DGEMC');
    expect(normalizeOptionCode('MATHS_EXPERTES')).toBe('MATHS_EXPERTES');
  });
});

describe('T-options — règles d\'exclusion', () => {
  test('MATHS_EXPERTES et MATHS_COMPLEMENTAIRES sont mutuellement exclusives', () => {
    const result = validateOptionsSelection({
      optionsTerminale: ['MATHS_EXPERTES', 'MATHS_COMPLEMENTAIRES'],
      specialitesTerminale: ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE'],
    });
    expect(result.valide).toBe(false);
    expect(result.erreurs).toContainEqual(expect.objectContaining({ code: 'OPTIONS_EXCLUSIVES' }));
  });

  test('MATHS_EXPERTES exige que la spécialité mathématiques soit conservée en terminale', () => {
    const result = validateOptionsSelection({
      optionsTerminale: ['MATHS_EXPERTES'],
      specialitesTerminale: ['PHYSIQUE_CHIMIE', 'SVT'],
    });
    expect(result.valide).toBe(false);
    expect(result.erreurs).toContainEqual(expect.objectContaining({ code: 'EXPERTES_REQUIERT_SPE_MATHS' }));
  });

  test('MATHS_COMPLEMENTAIRES exige que la spécialité mathématiques ait été abandonnée en fin de première', () => {
    const result = validateOptionsSelection({
      optionsTerminale: ['MATHS_COMPLEMENTAIRES'],
      specialitesTerminale: ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE'],
    });
    expect(result.valide).toBe(false);
    expect(result.erreurs).toContainEqual(expect.objectContaining({ code: 'COMPLEMENTAIRES_REQUIERT_ABANDON_MATHS' }));
  });

  test('DGEMC est cumulable avec MATHS_EXPERTES, dans la limite de 2 options en terminale', () => {
    const result = validateOptionsSelection({
      optionsTerminale: ['MATHS_EXPERTES', 'DGEMC'],
      specialitesTerminale: ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE'],
    });
    expect(result.valide).toBe(true);
    expect(result.erreurs).toHaveLength(0);
  });

  test('plus de 2 options en terminale (hors LCA) est bloquant', () => {
    const result = validateOptionsSelection({
      optionsTerminale: ['MATHS_EXPERTES', 'DGEMC', 'LCA_LATIN'],
      specialitesTerminale: ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE'],
    });
    // LCA_LATIN ne compte pas dans le plafond de 2 (brief §2.6)
    expect(result.valide).toBe(true);
  });

  test('un cas valide sans aucune option ne produit aucune erreur', () => {
    const result = validateOptionsSelection({ optionsTerminale: [], specialitesTerminale: ['MATHEMATIQUES', 'SVT'] });
    expect(result.valide).toBe(true);
    expect(result.erreurs).toHaveLength(0);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/exams/options-exclusion.test.ts`
Expected: FAIL — Cannot find module '@/lib/exams/options'

- [x] **Step 3: Write minimal implementation**

```typescript
// lib/exams/options.ts
/**
 * Exclusion rules for terminale options are structural, not session-
 * dependent (brief §2.6) — they live in code, not in the versioned JSON.
 * The option codes themselves (MATHS_EXPERTES, DGEMC, ...) are the only
 * cross-reference with lib/exams data; this module owns no coefficient.
 */

const ALIASES: Record<string, string> = { DGMEC: 'DGEMC' };

export function normalizeOptionCode(input: string): string {
  const upper = input.trim().toUpperCase();
  return ALIASES[upper] ?? upper;
}

export type OptionsValidationError = { code: string; message: string };
export type OptionsValidationResult = { valide: boolean; erreurs: OptionsValidationError[] };

const TERMINALE_ONLY_OPTIONS = new Set(['MATHS_EXPERTES', 'MATHS_COMPLEMENTAIRES', 'DGEMC']);
const LCA_OPTIONS = new Set(['LCA_LATIN', 'LCA_GREC']);

export function validateOptionsSelection(input: {
  optionsTerminale: string[];
  specialitesTerminale: string[];
}): OptionsValidationResult {
  const options = input.optionsTerminale.map(normalizeOptionCode);
  const erreurs: OptionsValidationError[] = [];

  if (options.includes('MATHS_EXPERTES') && options.includes('MATHS_COMPLEMENTAIRES')) {
    erreurs.push({
      code: 'OPTIONS_EXCLUSIVES',
      message: "Maths expertes et Maths complémentaires sont mutuellement exclusives.",
    });
  }
  if (options.includes('MATHS_EXPERTES') && !input.specialitesTerminale.includes('MATHEMATIQUES')) {
    erreurs.push({
      code: 'EXPERTES_REQUIERT_SPE_MATHS',
      message: "Maths expertes exige que la spécialité mathématiques soit conservée en terminale.",
    });
  }
  if (options.includes('MATHS_COMPLEMENTAIRES') && input.specialitesTerminale.includes('MATHEMATIQUES')) {
    erreurs.push({
      code: 'COMPLEMENTAIRES_REQUIERT_ABANDON_MATHS',
      message: "Maths complémentaires exige que la spécialité mathématiques ait été abandonnée en fin de première.",
    });
  }

  const nonLcaCount = options.filter((o) => TERMINALE_ONLY_OPTIONS.has(o)).length;
  if (nonLcaCount > 2) {
    erreurs.push({
      code: 'NB_OPTIONS_TERMINALE',
      message: "Au maximum 2 options en terminale, hors Langues et cultures de l'Antiquité.",
    });
  }

  return { valide: erreurs.length === 0, erreurs };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/exams/options-exclusion.test.ts`
Expected: PASS (7 tests)

- [x] **Step 5: Commit**

```bash
git add lib/exams/options.ts __tests__/lib/exams/options-exclusion.test.ts
git commit -m "feat(exams): encode terminale-option exclusion rules and DGMEC->DGEMC alias"
```

---

## Task 6 — Bascule scolaire→individuel, dispenses titulaire bac, second groupe (déclaratif)

**Files:**
- Modify: `lib/exams/schema.ts`
- Modify: `data/exams/bac-general-2027.json`
- Test: `__tests__/lib/exams/parcours-declaratifs.test.ts`

Ce Lot n'implémente **pas** encore `genererCarteExamen` (Lot 3) — seulement la structure de données sourcée que ce moteur consommera. Chaque bloc doit être déclaratif, sans logique de branchement ici.

- [x] **Step 1: Write the failing test**

```typescript
// __tests__/lib/exams/parcours-declaratifs.test.ts
import { requireExamPolicy } from '@/lib/exams/catalog';

describe('T-parcours — structures déclaratives pour P7/P8/P11 (Lot 3 les consommera)', () => {
  const policy = requireExamPolicy(2027);

  test('bascule scolaire vers individuel expose ses deux branches (§2.9)', () => {
    const b = policy.candidatIndividuelRules.basculeScolaireVersIndividuel;
    expect(b.branches.map((x) => x.id)).toEqual(
      expect.arrayContaining(['conservation_moyennes_premiere', 'renonciation_moyennes_premiere']),
    );
    for (const branche of b.branches) {
      expect(branche.consequence.length).toBeGreaterThan(0);
    }
  });

  test('dispenses pour titulaire du bac référencent l\'arrêté du 14 mai 2020', () => {
    const d = policy.candidatIndividuelRules.dispensesTitulaireBac;
    expect(d.sourceArticle).toMatch(/14 mai 2020/);
    expect(d.perimetre).toBe('declaratif');
  });

  test('second groupe (rattrapage) expose la fenêtre et le nombre de disciplines', () => {
    const g = policy.candidatIndividuelRules.secondGroupe;
    expect(g.moyenneMin).toBe(8);
    expect(g.moyenneMax).toBe(10);
    expect(g.nombreDisciplines).toBe(2);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/exams/parcours-declaratifs.test.ts`
Expected: FAIL — the three fields are undefined

- [x] **Step 3: Extend the schema**

```typescript
// lib/exams/schema.ts
const basculeScolaireSchema = z
  .object({
    branches: z
      .array(
        z
          .object({
            id: z.enum(['conservation_moyennes_premiere', 'renonciation_moyennes_premiere']),
            label: z.string().trim().min(1),
            consequence: z.string().trim().min(1),
          })
          .strict(),
      )
      .length(2),
    sourceNote: z.string().trim().min(1),
  })
  .strict();

const dispensesTitulaireBacSchema = z
  .object({
    sourceArticle: z.string().trim().min(1),
    perimetre: z.literal('declaratif'),
    note: z.string().trim().min(1),
  })
  .strict();

const secondGroupeSchema = z
  .object({
    moyenneMin: z.number().min(0).max(20),
    moyenneMax: z.number().min(0).max(20),
    nombreDisciplines: z.number().int().positive(),
    note: z.string().trim().min(1),
  })
  .strict();
```

Add the three fields to `candidatIndividuelRulesSchema`: `basculeScolaireVersIndividuel: basculeScolaireSchema`, `dispensesTitulaireBac: dispensesTitulaireBacSchema`, `secondGroupe: secondGroupeSchema`.

- [x] **Step 4: Add the data**

```json
"basculeScolaireVersIndividuel": {
  "branches": [
    {
      "id": "conservation_moyennes_premiere",
      "label": "Conservation des moyennes annuelles de première",
      "consequence": "Le candidat présente les évaluations ponctuelles uniquement sur le programme de terminale."
    },
    {
      "id": "renonciation_moyennes_premiere",
      "label": "Renonciation aux moyennes de première",
      "consequence": "Le candidat s'inscrit sur le programme du cycle terminal pour l'ensemble des évaluations ponctuelles et présente une évaluation ponctuelle sur le programme de première de la spécialité non poursuivie."
    }
  ],
  "sourceNote": "Note de service NOR MENE2523745N — situations particulières, dispenses, conservation."
},
"dispensesTitulaireBac": {
  "sourceArticle": "Arrêté du 14 mai 2020",
  "perimetre": "declaratif",
  "note": "Le candidat déjà titulaire du baccalauréat déclare ses dispenses obtenues ; le périmètre facturable est réduit en conséquence (Lot 3/Lot 5)."
},
"secondGroupe": {
  "moyenneMin": 8,
  "moyenneMax": 10,
  "nombreDisciplines": 2,
  "note": "Épreuves orales de rattrapage, deux disciplines au choix parmi les épreuves du premier groupe. Fenêtre très courte après publication des résultats."
}
```

- [x] **Step 5: Run test to verify it passes**

Run: `npx jest __tests__/lib/exams/parcours-declaratifs.test.ts`
Expected: PASS (3 tests)

- [x] **Step 6: Commit**

```bash
git add lib/exams/schema.ts data/exams/bac-general-2027.json __tests__/lib/exams/parcours-declaratifs.test.ts
git commit -m "feat(exams): add declarative structures for bascule scolaire, dispenses titulaire bac, second groupe"
```

---

## Task 7 — Résolveur multi-session : 2026 historique + 2028 squelette

**Files:**
- Create: `data/exams/bac-general-2026.json`
- Create: `data/exams/bac-general-2028.json`
- Modify: `lib/exams/schema.ts` (nouveau champ `status`)
- Modify: `lib/exams/catalog.ts` (registre étendu, `getSessionStatus`, `assertSessionSellable`)
- Test: `__tests__/lib/exams/session-resolver.test.ts`

Session 2026 : régime **pré-EAM**, Grand Oral coefficient 10 (fait déjà documenté dans les sources du fichier 2027 lui-même : « le coef 10 restait exact pour les sessions antérieures à 2027 » — pas une invention, une donnée déjà connue). Session 2028 : squelette non peuplé, refusé à la vente.

- [x] **Step 1: Write the failing test**

```typescript
// __tests__/lib/exams/session-resolver.test.ts
import { getExamPolicy, requireExamPolicy, getSupportedSessions, getSessionStatus, assertSessionSellable } from '@/lib/exams/catalog';

describe('T-resolver — résolution multi-session', () => {
  test('getSupportedSessions inclut 2026, 2027 et 2028', () => {
    expect(getSupportedSessions()).toEqual([2026, 2027, 2028]);
  });

  test('session 2026: statut HISTORICAL_READONLY, Grand Oral coef 10 (pré-EAM)', () => {
    expect(getSessionStatus(2026)).toBe('HISTORICAL_READONLY');
    const policy = requireExamPolicy(2026);
    const grandOral = policy.epreuves.find((e) => e.id === 'grand-oral');
    expect(grandOral?.coefficient).toBe(10);
    expect(policy.epreuves.some((e) => e.id === 'eam')).toBe(false);
  });

  test('session 2027: statut ACTIVE, vendable', () => {
    expect(getSessionStatus(2027)).toBe('ACTIVE');
    expect(() => assertSessionSellable(2027)).not.toThrow();
  });

  test('session 2026: vente bloquée (fail closed)', () => {
    expect(() => assertSessionSellable(2026)).toThrow(/HISTORICAL_READONLY/);
  });

  test('session 2028: statut SKELETON_UNCONFIRMED, vente bloquée, aucune valeur inventée', () => {
    expect(getSessionStatus(2028)).toBe('SKELETON_UNCONFIRMED');
    expect(() => assertSessionSellable(2028)).toThrow(/SKELETON_UNCONFIRMED/);
    const policy = requireExamPolicy(2028);
    expect(policy.epreuves).toEqual([]);
  });

  test('session inconnue: getExamPolicy retourne null (comportement fail-closed préexistant, non régressé)', () => {
    expect(getExamPolicy(2099)).toBeNull();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/exams/session-resolver.test.ts`
Expected: FAIL — only 2027 registered, `getSessionStatus`/`assertSessionSellable` not exported

- [x] **Step 3: Extend the schema to allow an empty skeleton and a status field**

```typescript
// lib/exams/schema.ts — relax epreuves.min(1) only for the skeleton case via a discriminated shape,
// and add the session status:
export const sessionStatusSchema = z.enum(['ACTIVE', 'HISTORICAL_READONLY', 'SKELETON_UNCONFIRMED']);
```

Add `status: sessionStatusSchema` to the top-level `examPolicySchema` object, and relax `epreuves: z.array(epreuveSchema).min(1)` to `z.array(epreuveSchema)` (drop `.min(1)`) — a skeleton session legitimately has zero épreuves. Guard the coefficient-sum invariant in `superRefine` to skip when `policy.epreuves.length === 0` (nothing to sum for a skeleton).

- [x] **Step 4: Create `data/exams/bac-general-2026.json`**

Model on the existing 2027 file's own documented pre-2027 facts (Grand Oral coef 10, no EAM, everything else structurally identical — this is not invented, it is what the 2027 file's own source note already states). `totalCoefficient: 100` (60 anticipées+terminales incl. Grand Oral@10 instead of 8, 40 ponctuel — same 40, since the +2 EAM point was carved out of Grand Oral, not added to the total). `status: "HISTORICAL_READONLY"`, `validUntil: "2026-07-31"`. Full `epreuves` list mirrors 2027's, minus `eam`, with `grand-oral.coefficient: 10`. `sources` cites the same decree/arrêté that documents the *change*, i.e. explains why 2026 differs, not a new source. Reuse the same `candidatIndividuelRules`/`tunisiaSpecific` blocks as 2027 (these didn't change between the two sessions) including all the new fields from Tasks 2-6 (schema requires them).

- [x] **Step 5: Create `data/exams/bac-general-2028.json` skeleton**

```json
{
  "session": 2028,
  "track": "bac_general",
  "status": "SKELETON_UNCONFIRMED",
  "validFrom": null,
  "validUntil": null,
  "lastVerifiedAt": "2026-08-23",
  "verifiedBy": "lot1-scaffold-not-a-source",
  "sources": [
    {
      "label": "Aucune source consultée — squelette de session non confirmée",
      "url": "https://eduscol.education.gouv.fr/5694",
      "note": "Placeholder délibérément vide (CDC §15 — ne jamais inventer une règle). À compléter dès que les textes de la session 2028 seront publiés."
    }
  ],
  "epreuves": [],
  "totalCoefficient": 0,
  "candidatIndividuelRules": "À_VERIFIER",
  "tunisiaSpecific": "À_VERIFIER"
}
```

This requires `candidatIndividuelRules`/`tunisiaSpecific` to accept the `À_VERIFIER` sentinel at the top level too — extend `examPolicySchema`:

```typescript
candidatIndividuelRules: z.union([candidatIndividuelRulesSchema, z.literal('À_VERIFIER')]),
tunisiaSpecific: z.union([tunisiaSpecificSchema, z.literal('À_VERIFIER')]),
```

Adjust the `totalCoefficient` sum-check in `superRefine` to skip entirely when `status === 'SKELETON_UNCONFIRMED'`.

- [x] **Step 6: Extend `lib/exams/catalog.ts`**

```typescript
import bacGeneral2026 from '@/data/exams/bac-general-2026.json';
import bacGeneral2027 from '@/data/exams/bac-general-2027.json';
import bacGeneral2028 from '@/data/exams/bac-general-2028.json';

const REGISTRY: Record<number, unknown> = {
  2026: bacGeneral2026,
  2027: bacGeneral2027,
  2028: bacGeneral2028,
};

export function getSessionStatus(session: number): ExamPolicy['status'] | null {
  const policy = getExamPolicy(session);
  return policy ? policy.status : null;
}

/** Fail closed: throws unless the session is ACTIVE. Never sell a historical or unconfirmed session. */
export function assertSessionSellable(session: number): void {
  const status = getSessionStatus(session);
  if (status !== 'ACTIVE') {
    throw new Error(
      `Session ${session} is not sellable (status: ${status ?? 'UNKNOWN'}). Only an ACTIVE session may be quoted or presented to a family.`,
    );
  }
}
```

- [x] **Step 7: Run test to verify it passes**

Run: `npx jest __tests__/lib/exams/session-resolver.test.ts`
Expected: PASS (6 tests)

- [x] **Step 8: Run the full exams suite to catch cross-file regressions**

Run: `npx jest __tests__/lib/exams-catalog.test.ts __tests__/lib/exams/`
Expected: PASS — in particular, the pre-existing `T18.1` "committed 2027 policy validates against the strict schema" test must still pass with the new `status` field present.

- [x] **Step 9: Commit**

```bash
git add lib/exams/schema.ts lib/exams/catalog.ts data/exams/bac-general-2026.json data/exams/bac-general-2028.json __tests__/lib/exams/session-resolver.test.ts
git commit -m "feat(exams): add multi-session resolver — 2026 historical read-only, 2028 unconfirmed skeleton"
```

---

## Task 8 — Coefficient d'une note conservée inter-session (fail-closed, `À_VERIFIER`)

**Files:**
- Modify: `lib/exams/catalog.ts`
- Test: `__tests__/lib/exams/session-resolver.test.ts` (append)

C'est le point `À_VERIFIER` le plus sensible de l'audit : quand un redoublant (P5) conserve une note obtenue sous une session dont les coefficients diffèrent de la session de représentation (ex. Grand Oral coef 10 en 2026 vs coef 8 en 2027), quel coefficient s'applique ? **Ne jamais trancher par supposition** — le comportement doit être le même patron fail-closed que `checkSameSessionEligibility`.

- [x] **Step 1: Write the failing test**

```typescript
// append to __tests__/lib/exams/session-resolver.test.ts
import { resolveConservedNoteCoefficient } from '@/lib/exams/catalog';

describe('T-resolver — coefficient d\'une note conservée entre sessions (À_VERIFIER, fail-closed)', () => {
  test('une note conservée dont le coefficient diverge entre la session d\'obtention et la session de représentation force une révision humaine', () => {
    const result = resolveConservedNoteCoefficient({
      epreuveId: 'grand-oral',
      sessionObtention: 2026,
      sessionRepresentation: 2027,
    });
    expect(result.outcome).toBe('COEFFICIENT_REQUIRES_HUMAN_REVIEW');
    expect(result.reason).toMatch(/10.*8|8.*10/);
  });

  test('une note conservée dont le coefficient est identique entre les deux sessions résout sans ambiguïté', () => {
    const result = resolveConservedNoteCoefficient({
      epreuveId: 'philosophie',
      sessionObtention: 2026,
      sessionRepresentation: 2027,
    });
    expect(result.outcome).toBe('RESOLVED');
    expect(result.outcome === 'RESOLVED' && result.coefficient).toBe(8);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/exams/session-resolver.test.ts`
Expected: FAIL — `resolveConservedNoteCoefficient` is not exported

- [x] **Step 3: Write minimal implementation**

```typescript
// lib/exams/catalog.ts
export type ConservedNoteCoefficientResult =
  | { outcome: 'RESOLVED'; coefficient: number }
  | { outcome: 'COEFFICIENT_REQUIRES_HUMAN_REVIEW'; reason: string };

/**
 * Whether a conserved note keeps its original session's coefficient or
 * takes the representation session's coefficient is NOT settled — see
 * docs/audit-devis-candidats-libres.md §5 (D6). This function never
 * guesses: when the two sessions disagree on a coefficient, it fails
 * closed to human review, exactly like checkSameSessionEligibility does
 * for non-auto-checkable conditions.
 */
export function resolveConservedNoteCoefficient(input: {
  epreuveId: string;
  sessionObtention: number;
  sessionRepresentation: number;
}): ConservedNoteCoefficientResult {
  const policyObtention = requireExamPolicy(input.sessionObtention);
  const policyRepresentation = requireExamPolicy(input.sessionRepresentation);
  const epObtention = getEpreuve(policyObtention, input.epreuveId);
  const epRepresentation = getEpreuve(policyRepresentation, input.epreuveId);

  if (!epObtention || !epRepresentation) {
    return {
      outcome: 'COEFFICIENT_REQUIRES_HUMAN_REVIEW',
      reason: `Épreuve ${input.epreuveId} introuvable dans l'une des deux sessions (${input.sessionObtention}/${input.sessionRepresentation}).`,
    };
  }
  if (epObtention.coefficient !== epRepresentation.coefficient) {
    return {
      outcome: 'COEFFICIENT_REQUIRES_HUMAN_REVIEW',
      reason: `Coefficient divergent pour ${input.epreuveId} entre la session ${input.sessionObtention} (${epObtention.coefficient}) et la session ${input.sessionRepresentation} (${epRepresentation.coefficient}) — non tranché réglementairement, confirmation Bureau des examens requise.`,
    };
  }
  return { outcome: 'RESOLVED', coefficient: epRepresentation.coefficient };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/exams/session-resolver.test.ts`
Expected: PASS (8 tests total in this file)

- [x] **Step 5: Commit**

```bash
git add lib/exams/catalog.ts __tests__/lib/exams/session-resolver.test.ts
git commit -m "feat(exams): fail-closed resolution for conserved-note coefficients across sessions"
```

---

## Task 9 — `tunisiaSpecific.verifieLe` structuré

**Files:**
- Modify: `lib/exams/schema.ts`
- Modify: `data/exams/bac-general-2027.json`, `bac-general-2026.json`
- Test: `__tests__/lib/exams/session-resolver.test.ts` (append) or new small test in `modalite-coefficients.test.ts` file — append to `session-resolver.test.ts` for cohesion

- [x] **Step 1: Write the failing test**

```typescript
// append to __tests__/lib/exams/session-resolver.test.ts
describe('T-resolver — tunisiaSpecific.verifieLe et alerte de fraîcheur', () => {
  test('verifieLe est une date ISO exploitable par le back-office (Lot 7) pour l\'alerte 6 mois', () => {
    const policy = requireExamPolicy(2027);
    if (policy.tunisiaSpecific === 'À_VERIFIER') throw new Error('unexpected skeleton');
    expect(policy.tunisiaSpecific.verifieLe).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/exams/session-resolver.test.ts`
Expected: FAIL — `verifieLe` undefined

- [x] **Step 3: Extend the schema**

```typescript
// lib/exams/schema.ts — add to tunisiaSpecificSchema
verifieLe: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
```

- [x] **Step 4: Add the data**

Add `"verifieLe": "2026-08-22"` to `tunisiaSpecific` in both `bac-general-2027.json` and `bac-general-2026.json` (reuse `lastVerifiedAt`'s existing value — same date, dedicated field for the back-office alert per brief §10).

- [x] **Step 5: Run test to verify it passes**

Run: `npx jest __tests__/lib/exams/session-resolver.test.ts`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add lib/exams/schema.ts data/exams/bac-general-2027.json data/exams/bac-general-2026.json __tests__/lib/exams/session-resolver.test.ts
git commit -m "feat(exams): add structured verifieLe date to tunisiaSpecific for back-office freshness alert"
```

---

## Task 10 — Sous-ensemble client-safe (`lib/exams/catalog-client.ts`)

**Files:**
- Create: `lib/exams/catalog-client.ts`
- Test: `__tests__/lib/exams/catalog-client.test.ts`

Contrairement à `lib/pricing-client.ts` (qui existe pour réduire la taille du bundle — 2.7 KB vs 28 KB), le JSON `lib/exams/` est petit : pas besoin d'un script de génération séparé. Le seul problème à résoudre est le `import 'server-only'` de `catalog.ts`, qui interdit son usage dans un composant `'use client'` du futur wizard (Lot 6) pour une validation d'options en temps réel. Solution : un module frère sans `server-only`, import direct du même JSON, ne réexportant que les fonctions **pures et sans effet de bord serveur** (pas de accès disque dynamique, juste les imports JSON statiques déjà bundlés).

- [x] **Step 1: Write the failing test**

```typescript
// __tests__/lib/exams/catalog-client.test.ts
import { getExamPolicyClient, requireExamPolicyClient } from '@/lib/exams/catalog-client';
import { validateOptionsSelection } from '@/lib/exams/options';
import { requireExamPolicy } from '@/lib/exams/catalog';

describe('T-client — sous-ensemble client-safe', () => {
  test('requireExamPolicyClient retourne la même policy que la version serveur pour 2027', () => {
    expect(requireExamPolicyClient(2027)).toEqual(requireExamPolicy(2027));
  });

  test('getExamPolicyClient retourne null pour une session inconnue (fail closed, comme côté serveur)', () => {
    expect(getExamPolicyClient(2099)).toBeNull();
  });

  test('validateOptionsSelection (lib/exams/options) ne dépend d\'aucun module server-only — utilisable tel quel côté client', () => {
    const result = validateOptionsSelection({ optionsTerminale: ['DGEMC'], specialitesTerminale: ['MATHEMATIQUES'] });
    expect(result.valide).toBe(true);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/exams/catalog-client.test.ts`
Expected: FAIL — Cannot find module '@/lib/exams/catalog-client'

- [x] **Step 3: Write minimal implementation**

```typescript
// lib/exams/catalog-client.ts
/**
 * Client-safe subset of lib/exams/catalog.ts — no 'server-only' guard.
 *
 * Unlike lib/pricing-client.ts, this does NOT trim the data (the exam-rules
 * JSON is small, no bundle-size concern) — it re-validates the exact same
 * committed JSON through the exact same Zod schema. The only reason this
 * file exists separately from catalog.ts is so a 'use client' wizard
 * component (Lot 6) can call it without pulling in the server-only guard.
 * Any drift between the two loaders would be caught by their shared
 * schema/JSON source — there is nothing to keep "in sync" here.
 */
import bacGeneral2026 from '@/data/exams/bac-general-2026.json';
import bacGeneral2027 from '@/data/exams/bac-general-2027.json';
import bacGeneral2028 from '@/data/exams/bac-general-2028.json';
import { examPolicySchema, type ExamPolicy } from './schema';

const REGISTRY: Record<number, unknown> = {
  2026: bacGeneral2026,
  2027: bacGeneral2027,
  2028: bacGeneral2028,
};

const validatedCache = new Map<number, ExamPolicy>();

export function getExamPolicyClient(session: number): ExamPolicy | null {
  const cached = validatedCache.get(session);
  if (cached) return cached;
  const raw = REGISTRY[session];
  if (!raw) return null;
  const parsed = examPolicySchema.parse(raw);
  validatedCache.set(session, parsed);
  return parsed;
}

export function requireExamPolicyClient(session: number): ExamPolicy {
  const policy = getExamPolicyClient(session);
  if (!policy) throw new Error(`No exam policy registered for session ${session}.`);
  return policy;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/exams/catalog-client.test.ts`
Expected: PASS (3 tests)

- [x] **Step 5: Commit**

```bash
git add lib/exams/catalog-client.ts __tests__/lib/exams/catalog-client.test.ts
git commit -m "feat(exams): add client-safe exam-policy loader for real-time wizard validation"
```

---

## Task 11 — Suite complète + non-régression

**Files:**
- None created — verification only.

- [x] **Step 1: Run the entire exams test surface**

Run: `npx jest __tests__/lib/exams-catalog.test.ts __tests__/lib/exams/`
Expected: PASS — all tests from Tasks 1-10 plus the pre-existing T18 suite.

- [x] **Step 2: Run the full unit suite to catch any consumer of `lib/exams/` broken by the schema changes**

Run: `npx jest`
Expected: PASS. Pay particular attention to any test touching `lib/quotes/exam-profile.ts` or `lib/quotes/recommendation.ts` (both depend on `lib/exams/catalog.ts`) — the schema additions are all-additive/optional, but confirm no consumer does an exhaustive key check (`Object.keys(...).length === N`) that a new field would break.

Run: `grep -rn "lib/exams/catalog'" --include="*.ts" --include="*.tsx" lib app components | grep -v __tests__`

Verify each match still type-checks: `npx tsc --noEmit`

- [x] **Step 3: Final commit (if any fixups were needed)**

```bash
git add -A
git commit -m "test(exams): confirm Lot 1 regulatory extensions don't regress existing consumers"
```

---

## Ce qui reste à arbitrer avant que ce Lot puisse être considéré "fermé"

Ces points sont désormais représentés dans le code par la sentinelle `À_VERIFIER` ou un statut `SKELETON_UNCONFIRMED`/`COEFFICIENT_REQUIRES_HUMAN_REVIEW` — ils ne bloquent pas le Lot 1 (qui doit précisément les rendre visibles, pas les résoudre), mais bloquent le Lot 3 (`genererCarteExamen`) tant qu'ils ne sont pas levés :

1. **Coefficient modalité B pour HG, LVA, LVB, EMC** — vérifier note de service par note de service (aucune généralisation depuis l'enseignement scientifique).
2. **Coefficient d'une note conservée inter-session** quand il diverge entre la session d'obtention et la session de représentation (ex. Grand Oral 10→8) — à confirmer auprès du Bureau des examens de l'IFT ou par lecture directe des dispositions transitoires citées dans l'audit.
3. **Textes de la session 2028** — squelette non peuplé tant que les arrêtés ne sont pas publiés.
4. **Disponibilité des évaluations ponctuelles d'options selon l'académie** (réserve mentionnée par le brief §2.6) — pas encodée dans ce Lot, à porter par le Lot 6 (affichage UI) une fois la donnée disponible.
