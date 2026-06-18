import { describe, it, expect } from 'vitest';
import {
  makeStudentRecord, makeRoot, makeStudentId, validateName,
  applyAward, XP_REWARDS, getOrCreateStudent, resetStudent, parseRoot, SCHEMA_VERSION,
} from '../../src/logic.js';

describe('applyAward — immutabilité et idempotence', () => {
  it('ajoute XP si clé nouvelle', () => {
    const s = makeStudentRecord('Neil');
    const s2 = applyAward(s, 'auto:a1', 10);
    expect(s2.xp).toBe(10);
    expect(s2.awarded['auto:a1']).toBe(true);
  });
  it('n\'altère pas l\'original', () => {
    const s = makeStudentRecord('Neil');
    applyAward(s, 'k', 10);
    expect(s.xp).toBe(0);
  });
  it('idempotent — double appel même clé', () => {
    const s = makeStudentRecord('Neil');
    const s2 = applyAward(s, 'k', 10);
    const s3 = applyAward(s2, 'k', 10);
    expect(s3.xp).toBe(10);
  });
  it('cumule plusieurs awards distincts', () => {
    let s = makeStudentRecord('Neil');
    s = applyAward(s, 'a1', 10);
    s = applyAward(s, 'a2', 10);
    s = applyAward(s, 'fc1', 10);
    expect(s.xp).toBe(30);
    expect(Object.keys(s.awarded)).toHaveLength(3);
  });
  it('ajoute une entrée dans history', () => {
    const s = makeStudentRecord('Neil');
    const s2 = applyAward(s, 'k', 15);
    expect(s2.history.length).toBeGreaterThan(0);
    expect(s2.history[s2.history.length - 1].action).toBe('xp');
  });
});

describe('getOrCreateStudent — séparation multi-élèves', () => {
  it('crée un élève absent', () => {
    const root = makeRoot();
    const { student } = getOrCreateStudent(root, 'Neil ZAYANE');
    expect(student.name).toBe('Neil ZAYANE');
    expect(student.xp).toBe(0);
  });
  it('retrouve l\'élève existant', () => {
    const root = makeRoot();
    const { root: r1, student: s1, id } = getOrCreateStudent(root, 'Neil ZAYANE');
    s1.xp = 200;
    const { student: s2 } = getOrCreateStudent(r1, 'Neil ZAYANE');
    expect(s2.xp).toBe(200);
    expect(s2.id).toBe(id);
  });
  it('deux noms → deux IDs → deux historiques isolés', () => {
    const root = makeRoot();
    const { root: r1, student: s1 } = getOrCreateStudent(root, 'Neil ZAYANE');
    s1.xp = 100;
    const { student: s2 } = getOrCreateStudent(r1, 'Élève Test');
    s2.xp = 50;
    expect(s1.xp).toBe(100);
    expect(s2.xp).toBe(50);
    expect(s1.id).not.toBe(s2.id);
  });
  it('Élève Test ne s\'écrase pas avec Neil ZAYANE', () => {
    const root = makeRoot();
    const { root: r1, student: neil } = getOrCreateStudent(root, 'Neil ZAYANE');
    neil.answers.auto['a1'] = { value: '1/2', correct: true };
    const { student: test } = getOrCreateStudent(r1, 'Élève Test');
    expect(test.answers.auto['a1']).toBeUndefined();
  });
});

describe('resetStudent', () => {
  it('XP remis à 0', () => {
    const root = makeRoot();
    const { root: r1, student: s, id } = getOrCreateStudent(root, 'Neil');
    s.xp = 500;
    const r2 = resetStudent(r1, id);
    expect(r2.students[id].xp).toBe(0);
  });
  it('réponses effacées', () => {
    const root = makeRoot();
    const { root: r1, student: s, id } = getOrCreateStudent(root, 'Neil');
    s.answers.auto['a1'] = { correct: true };
    const r2 = resetStudent(r1, id);
    expect(r2.students[id].answers.auto).toEqual({});
  });
  it('nom conservé', () => {
    const root = makeRoot();
    const { root: r1, id } = getOrCreateStudent(root, 'Neil ZAYANE');
    expect(resetStudent(r1, id).students[id].name).toBe('Neil ZAYANE');
  });
  it('ne touche pas les autres élèves', () => {
    const root = makeRoot();
    const { root: r1, id: idN } = getOrCreateStudent(root, 'Neil');
    const { student: sT, id: idT } = getOrCreateStudent(r1, 'Test');
    sT.xp = 99;
    r1.students[idN].xp = 200;
    const r2 = resetStudent(r1, idN);
    expect(r2.students[idT].xp).toBe(99);
  });
  it('historique conservé + entrée reset ajoutée', () => {
    const root = makeRoot();
    const { root: r1, student: s, id } = getOrCreateStudent(root, 'Neil');
    s.history = [{ action: 'session_start', timestamp: '...' }];
    const r2 = resetStudent(r1, id);
    expect(r2.students[id].history.length).toBe(2);
    expect(r2.students[id].history[1].action).toBe('reset');
  });
});

describe('parseRoot — SCHEMA_VERSION et migration', () => {
  it('schemaVersion=2 OK', () => {
    const root = makeRoot();
    root.students['x'] = makeStudentRecord('X');
    root.students['x'].xp = 77;
    const r = parseRoot(JSON.stringify(root));
    expect(r.students['x'].xp).toBe(77);
  });
  it('schemaVersion=1 → reset propre', () => {
    const r = parseRoot(JSON.stringify({ schemaVersion: 1, students: { x: { xp: 999 } } }));
    expect(r.students).toEqual({});
    expect(r.schemaVersion).toBe(SCHEMA_VERSION);
  });
  it('schemaVersion=99 → reset propre', () => {
    const r = parseRoot(JSON.stringify({ schemaVersion: 99, students: {} }));
    expect(r.students).toEqual({});
  });
});
