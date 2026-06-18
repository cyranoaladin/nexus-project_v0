import { describe, it, expect, beforeEach } from 'vitest';
import {
  SCHEMA_VERSION, ROOT_KEY,
  makeRoot, makeStudentRecord, makeStudentId,
  parseRoot, loadRootFromStorage, saveRootToStorage,
  getOrCreateStudent, resetStudent, validateName,
} from '../../src/logic.js';

// ── Mock localStorage ──

class MockStorage {
  constructor(opts = {}) {
    this._data = {};
    this._quota = opts.quota ?? Infinity;
    this._available = opts.available ?? true;
  }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._data, k) ? this._data[k] : null; }
  setItem(k, v) {
    if (!this._available) throw Object.assign(new Error('SecurityError'), { name: 'SecurityError' });
    if (JSON.stringify(this._data).length + v.length > this._quota) {
      throw Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError' });
    }
    this._data[k] = v;
  }
  removeItem(k) { delete this._data[k]; }
  clear() { this._data = {}; }
  get length() { return Object.keys(this._data).length; }
}

// ── parseRoot ──

describe('parseRoot', () => {
  it('retourne makeRoot() si raw est null', () => {
    const r = parseRoot(null);
    expect(r.schemaVersion).toBe(SCHEMA_VERSION);
    expect(r.students).toEqual({});
  });

  it('retourne makeRoot() si raw est chaîne vide', () => {
    const r = parseRoot('');
    expect(r.students).toEqual({});
  });

  it('retourne makeRoot() si JSON invalide (données corrompues)', () => {
    const r = parseRoot('{bad json[');
    expect(r.students).toEqual({});
  });

  it('retourne makeRoot() si schemaVersion différent (migration propre)', () => {
    const old = JSON.stringify({ schemaVersion: 1, students: { x: { xp: 999 } } });
    const r = parseRoot(old);
    expect(r.students).toEqual({});
    expect(r.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('retourne makeRoot() si students manquant', () => {
    const bad = JSON.stringify({ schemaVersion: SCHEMA_VERSION });
    const r = parseRoot(bad);
    expect(r.students).toEqual({});
  });

  it('retourne makeRoot() si students n\'est pas un objet', () => {
    const bad = JSON.stringify({ schemaVersion: SCHEMA_VERSION, students: 'corrupted' });
    const r = parseRoot(bad);
    expect(r.students).toEqual({});
  });

  it('restaure correctement un root valide', () => {
    const neil = makeStudentRecord('Neil ZAYANE');
    neil.xp = 120;
    const root = makeRoot();
    root.students['neil-zayane'] = neil;
    const r = parseRoot(JSON.stringify(root));
    expect(r.students['neil-zayane'].xp).toBe(120);
    expect(r.students['neil-zayane'].name).toBe('Neil ZAYANE');
  });

  it('conservation de multi-élèves après sérialisation', () => {
    const root = makeRoot();
    root.students['neil'] = makeStudentRecord('Neil');
    root.students['test'] = makeStudentRecord('Test');
    root.students['neil'].xp = 100;
    root.students['test'].xp = 50;
    const r = parseRoot(JSON.stringify(root));
    expect(r.students['neil'].xp).toBe(100);
    expect(r.students['test'].xp).toBe(50);
  });
});

// ── loadRootFromStorage ──

describe('loadRootFromStorage', () => {
  let storage;
  beforeEach(() => { storage = new MockStorage(); });

  it('retourne root vide si storage vide', () => {
    const r = loadRootFromStorage(storage);
    expect(r.students).toEqual({});
  });

  it('retourne root vide si localStorage indisponible (exception)', () => {
    const unavailable = new MockStorage({ available: false });
    const r = loadRootFromStorage(unavailable);
    expect(r.students).toEqual({});
  });

  it('restaure correctement si données valides', () => {
    const root = makeRoot();
    root.students['neil'] = makeStudentRecord('Neil');
    root.students['neil'].xp = 99;
    storage.setItem(ROOT_KEY, JSON.stringify(root));
    const r = loadRootFromStorage(storage);
    expect(r.students['neil'].xp).toBe(99);
  });

  it('retourne root propre si données corrompues en storage', () => {
    storage.setItem(ROOT_KEY, '{invalid json}');
    const r = loadRootFromStorage(storage);
    expect(r.students).toEqual({});
  });
});

// ── saveRootToStorage ──

describe('saveRootToStorage', () => {
  let storage;
  beforeEach(() => { storage = new MockStorage(); });

  it('sauvegarde et recharge correctement', () => {
    const root = makeRoot();
    root.students['neil'] = makeStudentRecord('Neil');
    root.students['neil'].xp = 55;
    const res = saveRootToStorage(root, storage);
    expect(res.ok).toBe(true);
    const raw = storage.getItem(ROOT_KEY);
    expect(JSON.parse(raw).students['neil'].xp).toBe(55);
  });

  it('retourne { ok: false, error: "quota" } si quota dépassé', () => {
    const tiny = new MockStorage({ quota: 10 });
    const root = makeRoot();
    root.students['neil'] = makeStudentRecord('Neil ZAYANE');
    const res = saveRootToStorage(root, tiny);
    expect(res.ok).toBe(false);
    expect(res.error).toBe('quota');
  });
});

// ── getOrCreateStudent ──

describe('getOrCreateStudent', () => {
  it('crée un nouveau student', () => {
    const root = makeRoot();
    const { student } = getOrCreateStudent(root, 'Neil ZAYANE');
    expect(student.name).toBe('Neil ZAYANE');
    expect(student.xp).toBe(0);
    expect(student.id).toBe('neil-zayane');
  });

  it('retourne le student existant si même ID', () => {
    const root = makeRoot();
    const { root: r1, student: s1 } = getOrCreateStudent(root, 'Neil ZAYANE');
    s1.xp = 75;
    const { student: s2 } = getOrCreateStudent(r1, 'Neil ZAYANE');
    expect(s2.xp).toBe(75);
  });

  it('lève une erreur si nom vide', () => {
    const root = makeRoot();
    expect(() => getOrCreateStudent(root, '')).toThrow();
    expect(() => getOrCreateStudent(root, '   ')).toThrow();
    expect(() => getOrCreateStudent(root, null)).toThrow();
  });

  it('deux noms différents → deux students distincts', () => {
    const root = makeRoot();
    const { root: r1, student: s1 } = getOrCreateStudent(root, 'Neil ZAYANE');
    s1.xp = 100;
    const { student: s2 } = getOrCreateStudent(r1, 'Élève Test');
    expect(s2.xp).toBe(0);
    expect(s1.id).not.toBe(s2.id);
  });
});

// ── resetStudent ──

describe('resetStudent', () => {
  it('remet XP à 0 et vide les réponses', () => {
    const root = makeRoot();
    const { root: r1, student: s1, id } = getOrCreateStudent(root, 'Neil');
    s1.xp = 200;
    s1.answers.auto['a1'] = { value: '1/2', correct: true };
    const r2 = resetStudent(r1, id);
    expect(r2.students[id].xp).toBe(0);
    expect(r2.students[id].answers.auto).toEqual({});
  });

  it('conserve le nom', () => {
    const root = makeRoot();
    const { root: r1, id } = getOrCreateStudent(root, 'Neil ZAYANE');
    const r2 = resetStudent(r1, id);
    expect(r2.students[id].name).toBe('Neil ZAYANE');
  });

  it('conserve l\'historique avec l\'entrée "reset"', () => {
    const root = makeRoot();
    const { root: r1, student: s1, id } = getOrCreateStudent(root, 'Neil');
    s1.history = [{ action: 'session_start' }];
    const r2 = resetStudent(r1, id);
    expect(r2.students[id].history.length).toBe(2);
    expect(r2.students[id].history[1].action).toBe('reset');
  });

  it('ne touche pas les autres students', () => {
    const root = makeRoot();
    const { root: r1, student: s1, id: id1 } = getOrCreateStudent(root, 'Neil');
    const { student: s2, id: id2 } = getOrCreateStudent(r1, 'Élève Test');
    s1.xp = 100;
    s2.xp = 50;
    const r2 = resetStudent(r1, id1);
    expect(r2.students[id1].xp).toBe(0);
    expect(r2.students[id2].xp).toBe(50);
  });
});

// ── validateName ──

describe('validateName', () => {
  it('accepte un prénom simple', () => { expect(validateName('Neil').valid).toBe(true); });
  it('accepte des accents', () => { expect(validateName('Élève Test').valid).toBe(true); });
  it('accepte des espaces', () => { expect(validateName('Ben Rhouma').valid).toBe(true); });
  it('accepte un nom complet', () => { expect(validateName('Neil ZAYANE').valid).toBe(true); });
  it('refuse chaîne vide', () => { expect(validateName('').valid).toBe(false); });
  it('refuse espaces seuls', () => { expect(validateName('   ').valid).toBe(false); });
  it('refuse null', () => { expect(validateName(null).valid).toBe(false); });
  it('refuse undefined', () => { expect(validateName(undefined).valid).toBe(false); });
  it('message d\'erreur non vide si invalide', () => { expect(validateName('').error.length).toBeGreaterThan(0); });
  it('nom normalisé retourné (trim)', () => { expect(validateName('  Neil  ').name).toBe('Neil'); });
});

// ── makeStudentId ──

describe('makeStudentId', () => {
  it('Neil ZAYANE → neil-zayane', () => { expect(makeStudentId('Neil ZAYANE')).toBe('neil-zayane'); });
  it('Élève Test → eleve-test (accents supprimés)', () => { expect(makeStudentId('Élève Test')).toBe('eleve-test'); });
  it('Ben Rhouma → ben-rhouma', () => { expect(makeStudentId('Ben Rhouma')).toBe('ben-rhouma'); });
  it('espaces multiples → tiret unique', () => { expect(makeStudentId('a  b')).toBe('a-b'); });
  it('chaîne vide → "eleve"', () => { expect(makeStudentId('')).toBe('eleve'); });
  it('null → "eleve"', () => { expect(makeStudentId(null)).toBe('eleve'); });
  it('idempotent', () => { const id = makeStudentId('Neil ZAYANE'); expect(makeStudentId('Neil ZAYANE')).toBe(id); });
  it('deux noms différents → deux IDs différents', () => { expect(makeStudentId('Neil')).not.toBe(makeStudentId('Test')); });
});

// ── makeStudentRecord ──

describe('makeStudentRecord', () => {
  it('contient id, name, createdAt, updatedAt', () => {
    const s = makeStudentRecord('Neil ZAYANE');
    expect(s.id).toBe('neil-zayane');
    expect(s.name).toBe('Neil ZAYANE');
    expect(typeof s.createdAt).toBe('string');
    expect(typeof s.updatedAt).toBe('string');
  });
  it('xp = 0, badges = [], completedModules = [], history = []', () => {
    const s = makeStudentRecord('X');
    expect(s.xp).toBe(0);
    expect(s.badges).toEqual([]);
    expect(s.completedModules).toEqual([]);
    expect(s.history).toEqual([]);
  });
  it('answers.auto et answers.missions vides', () => {
    const s = makeStudentRecord('X');
    expect(s.answers.auto).toEqual({});
    expect(s.answers.missions).toEqual({});
  });
  it('paperTasks, strategy, flash vides', () => {
    const s = makeStudentRecord('X');
    expect(s.paperTasks).toEqual({});
    expect(s.strategy).toEqual({});
    expect(s.flash).toEqual({});
  });
  it('text.pledge et text.checklist vides', () => {
    const s = makeStudentRecord('X');
    expect(s.text.pledge).toBe('');
    expect(s.text.checklist).toBe('');
  });
});
