import { z } from 'zod';
import { buildMessages } from '../../..//apps/web/server/openai/promptBuilders';

const Out = z.object({ foo: z.string() });

const base = {
  student: { name: 'Marie Dupont', level: 'Terminale', subjects: 'Spé Maths + NSI', status: 'Scolarisée' },
  qcm: { total: 60, max: 80, scoreGlobalPct: 75, weakDomainsCount: 1, domains: [] as any[] },
  volet2: { indices: { AUTONOMIE: 4, ORGANISATION: 7, MOTIVATION: 3, STRESS: 2, SUSPECT_DYS: 1 }, portraitText: 'Profil', badges: ['Autonomie'], radarPath: 'radar.png' },
};

describe('buildMessages (bilan)', () => {
  it('compose correctement les messages pour ELEVE', () => {
    const msgs = buildMessages({ variant: 'eleve', student: base.student, qcm: base.qcm, volet2: base.volet2, outSchema: Out });
    expect(msgs[0].role).toBe('system');
    expect(String(msgs[0].content)).toMatch(/ELEVE/);
    expect(msgs[1].role).toBe('user');
    const payload = JSON.parse(String(msgs[1].content));
    expect(payload.instructions.student.name).toBe('Marie Dupont');
    expect(String(payload.outSchema)).toContain('object');
  });

  it('compose correctement les messages pour PARENT', () => {
    const msgs = buildMessages({ variant: 'parent', student: base.student, qcm: base.qcm, volet2: base.volet2, outSchema: Out });
    expect(String(msgs[0].content)).toMatch(/PARENTS/);
  });

  it('compose correctement les messages pour ADMIN', () => {
    const msgs = buildMessages({ variant: 'admin', student: base.student, qcm: base.qcm, volet2: base.volet2, outSchema: Out });
    expect(String(msgs[0].content)).toMatch(/ADMIN/);
  });
});
