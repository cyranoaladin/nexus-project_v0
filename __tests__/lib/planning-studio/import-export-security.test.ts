/**
 * Sécurité des chemins import et export du Planning Studio.
 *
 * Le planning est saisi librement par le personnel : intitulés, notes, noms
 * d'enseignants, de salles et de groupes sont du texte utilisateur. Il traverse
 * ensuite trois frontières — le DOM, l'export CSV et la persistance serveur —
 * qui doivent chacune rester sûres.
 */
import {
  PLANNING_BOOTSTRAP,
  getPlanningEngine,
  type PlanningPayload,
} from '@/lib/planning-studio/engine';
import { validatePlanningPayload, PLANNING_PAYLOAD_MAX_BYTES } from '@/lib/planning-studio/validate-payload';

const engine = getPlanningEngine();
const nexus = (globalThis as { Nexus?: Record<string, (...args: unknown[]) => unknown> }).Nexus!;

function bootstrap(): PlanningPayload {
  return engine.normalize(JSON.parse(JSON.stringify(PLANNING_BOOTSTRAP)));
}

const PAYLOADS_XSS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  'javascript:alert(1)',
  '"><svg/onload=alert(1)>',
];

// ───────────────────────────────────────────────────────────────────────────
describe('injection de contenu — le rendu ne construit jamais de HTML', () => {
  test('aucun module de l’outil n’utilise innerHTML, outerHTML ni document.write', () => {
    // Le DOM est bâti par le helper `h()` de core.js, qui pose du texte et des
    // attributs. C'est cette propriété structurelle qui rend le XSS impossible
    // par construction : ce test la verrouille.
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const dir = path.join(process.cwd(), 'tools/planning-studio/assets');
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
      const source = fs.readFileSync(path.join(dir, file), 'utf8');
      expect({ file, innerHTML: /\.innerHTML\s*=/.test(source) }).toEqual({ file, innerHTML: false });
      expect({ file, outerHTML: /\.outerHTML\s*=/.test(source) }).toEqual({ file, outerHTML: false });
      expect({ file, write: /document\.write\s*\(/.test(source) }).toEqual({ file, write: false });
    }
  });

  test.each(PAYLOADS_XSS)('la charge %s traverse la validation comme du texte inerte', (payload) => {
    const data = bootstrap();
    data.sessions[0].title = payload;
    data.sessions[0].notes = payload;
    data.teachers[0].name = payload;

    const result = validatePlanningPayload(data);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // La valeur est conservée telle quelle : aucune interprétation, aucune
    // exécution — et aucune réécriture silencieuse qui masquerait le contenu.
    expect(result.payload.sessions[0].title).toBe(payload);
    expect(result.payload.teachers[0].name).toBe(payload);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('pollution de prototype', () => {
  test.each(['__proto__', 'constructor', 'prototype'])(
    'une clé %s au niveau racine est ignorée par la normalisation',
    (key) => {
      const raw = JSON.parse(JSON.stringify(PLANNING_BOOTSTRAP)) as Record<string, unknown>;
      raw[key] = { polluted: true };
      const normalized = engine.normalize(raw) as unknown as Record<string, unknown>;

      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      expect((Object.prototype as unknown as Record<string, unknown>).polluted).toBeUndefined();
      expect(normalized.polluted).toBeUndefined();
    },
  );

  test('une clé __proto__ dans une séance ne pollue pas Object.prototype', () => {
    const raw = JSON.parse(JSON.stringify(PLANNING_BOOTSTRAP)) as { sessions: Record<string, unknown>[] };
    raw.sessions[0]['__proto__'] = { polluted: 'oui' };
    raw.sessions[0]['constructor'] = { prototype: { polluted: 'oui' } };
    engine.normalize(raw);

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(([] as unknown as Record<string, unknown>).polluted).toBeUndefined();
  });

  test('les clés inconnues sont écartées, jamais recopiées dans le document persisté', () => {
    const data = bootstrap() as unknown as Record<string, unknown>;
    (data.sessions as Record<string, unknown>[])[0].champInconnu = 'valeur arbitraire';
    data.champRacineInconnu = 'valeur arbitraire';

    const result = validatePlanningPayload(data);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.payload as unknown as Record<string, unknown>).champRacineInconnu).toBeUndefined();
    expect((result.payload.sessions[0] as unknown as Record<string, unknown>).champInconnu).toBeUndefined();
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('export CSV — injection de formule', () => {
  const toCsv = (data: PlanningPayload) => nexus.toCsv(data) as unknown as string;

  test('le BOM UTF-8 est conservé', () => {
    expect(toCsv(bootstrap()).charCodeAt(0)).toBe(0xfeff);
  });

  test.each(['=1+1', '+SUM(A1:A2)', '-10+20', '@cmd', '=HYPERLINK("http://x","clic")'])(
    'la cellule %s est neutralisée',
    (formula) => {
      const data = bootstrap();
      data.sessions[0].title = formula;
      data.sessions[0].notes = formula;
      data.teachers[0].name = formula;
      data.rooms[0].name = formula;

      const csv = toCsv(data);
      // Aucune cellule ne commence par un caractère interprété comme formule.
      for (const line of csv.replace(/^﻿/, '').split('\r\n').slice(1)) {
        if (!line) continue;
        for (const cell of line.split(';')) {
          const value = cell.startsWith('"') ? cell.slice(1) : cell;
          expect({ formula, cell, dangerous: /^[=+\-@\t\r]/.test(value) }).toEqual({
            formula,
            cell,
            dangerous: false,
          });
        }
      }
    },
  );

  test('la neutralisation préserve le contenu derrière l’apostrophe', () => {
    const data = bootstrap();
    data.teachers[0].name = '=1+1';
    expect(toCsv(data)).toContain("'=1+1");
  });

  test('une valeur ordinaire n’est pas altérée', () => {
    const data = bootstrap();
    data.teachers[0].name = 'Alaeddine Ben Rhouma';
    const csv = toCsv(data);
    expect(csv).toContain('Alaeddine Ben Rhouma');
    expect(csv).not.toContain("'Alaeddine");
  });

  test('les séparateurs et guillemets restent correctement échappés', () => {
    const data = bootstrap();
    data.sessions[0].notes = 'un;deux "trois"\nquatre';
    expect(toCsv(data)).toContain('"un;deux ""trois""\nquatre"');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('import — structure refusée avant persistance', () => {
  test('un JSON qui n’est pas un objet est refusé', () => {
    for (const raw of [null, 42, 'texte', []]) {
      expect(validatePlanningPayload(raw).ok).toBe(false);
    }
  });

  test('une charge utile trop volumineuse est refusée', () => {
    const data = bootstrap() as unknown as Record<string, unknown>;
    data.remplissage = 'x'.repeat(PLANNING_PAYLOAD_MAX_BYTES);
    const result = validatePlanningPayload(data);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(' ')).toMatch(/volumineux/i);
  });

  test('un schemaVersion futur est refusé', () => {
    const data = bootstrap() as unknown as Record<string, unknown>;
    data.schemaVersion = 99;
    expect(validatePlanningPayload(data).ok).toBe(false);
  });

  test('une référence inexistante est refusée comme conflit bloquant', () => {
    const data = bootstrap();
    data.sessions[0].teacherId = 'teacher-inexistant';
    const result = validatePlanningPayload(data);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.blocking.map((i) => i.code)).toContain('MISSING_TEACHER');
  });

  test('un identifiant de séance dupliqué ne peut pas être persisté', () => {
    const data = bootstrap();
    data.sessions.push({ ...data.sessions[0] });
    expect(validatePlanningPayload(data).ok).toBe(false);
  });
});
