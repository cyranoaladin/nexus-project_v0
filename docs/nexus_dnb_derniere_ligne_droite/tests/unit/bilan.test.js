import { describe, it, expect } from 'vitest';
import {
  buildBilanText, buildBilanCSV,
  makeStudentRecord, AUTO_QUESTIONS, MISSIONS, FLASHCARD_IDS,
  countCorrectAll, countAllQuestions, getProgress, rank,
} from '../../src/logic.js';

function fullStudent(name) {
  const s = makeStudentRecord(name);
  s.xp = 250;
  s.startedAt = '2026-06-17T20:00:00.000Z';
  AUTO_QUESTIONS.slice(0, 8).forEach(q => { s.answers.auto[q.id] = { value: 'ok', correct: true, checked: true }; });
  AUTO_QUESTIONS.slice(8).forEach(q => { s.answers.auto[q.id] = { value: 'wrong', correct: false, checked: true }; });
  FLASHCARD_IDS.slice(0, 5).forEach(id => { s.flash[id] = { mastered: true }; });
  Object.entries(MISSIONS).forEach(([ns, qs]) => {
    qs.slice(0, 2).forEach(q => {
      s.answers.missions[ns] = s.answers.missions[ns] || {};
      s.answers.missions[ns][q.id] = { value: 'ok', correct: true, checked: true };
    });
  });
  s.paperTasks = { pythagore: true, reciproque: true, thales: true };
  s.strategy = { a: true, b: true };
  s.text = { pledge: 'Pas de case vide', checklist: 'Unités, parenthèses' };
  s.badges = ['starter', 'auto', 'cards'];
  s.completedModules = ['percent'];
  return s;
}

describe('buildBilanText — contenu obligatoire', () => {
  it('contient BILAN ÉLÈVE en-tête', () => { expect(buildBilanText(fullStudent('X'))).toContain('BILAN ÉLÈVE'); });
  it('contient le nom de l\'élève', () => { expect(buildBilanText(fullStudent('Neil ZAYANE'))).toContain('Neil ZAYANE'); });
  it('contient la date', () => { expect(buildBilanText(fullStudent('X'))).toMatch(/\d{2}\/\d{2}\/\d{4}/); });
  it('contient Score', () => { expect(buildBilanText(fullStudent('X'))).toMatch(/Score\s*:/); });
  it('contient XP correct (250)', () => { expect(buildBilanText(fullStudent('X'))).toContain('250'); });
  it('contient Progression', () => { expect(buildBilanText(fullStudent('X'))).toMatch(/Progression\s*:/); });
  it('contient Niveau', () => { expect(buildBilanText(fullStudent('X'))).toMatch(/Niveau\s*:/); });
  it('contient Automatismes', () => { expect(buildBilanText(fullStudent('X'))).toMatch(/Automatismes\s*:/); });
  it('contient Flashcards', () => { expect(buildBilanText(fullStudent('X'))).toMatch(/Flashcards/); });
  it('contient Rédactions', () => { expect(buildBilanText(fullStudent('X'))).toMatch(/[Rr]édactions/); });
  it('contient Modules complétés', () => { expect(buildBilanText(fullStudent('X'))).toContain('Modules complétés'); });
  it('contient Badges obtenus', () => { expect(buildBilanText(fullStudent('X'))).toContain('Badges'); });
  it('liste les réponses incorrectes', () => {
    const s = fullStudent('X');
    const text = buildBilanText(s);
    expect(text).toContain('Erreurs automatismes');
    expect(text).toContain('a9');
  });
  it('contient réponses papier', () => { expect(buildBilanText(fullStudent('X'))).toContain('Rédactions papier faites'); });
  it('contient phrase de copie', () => { expect(buildBilanText(fullStudent('X'))).toContain('Pas de case vide'); });
  it('contient points à vérifier', () => { expect(buildBilanText(fullStudent('X'))).toContain('Unités, parenthèses'); });
  it('mention montrer au professeur', () => { expect(buildBilanText(fullStudent('X'))).toContain('montrer au professeur'); });
  it('mention localStorage (architecture)', () => { expect(buildBilanText(fullStudent('X'))).toContain('localStorage'); });
  it('mention nexusreussite.academy', () => { expect(buildBilanText(fullStudent('X'))).toContain('nexusreussite.academy'); });
  it('état vide → bilan généré sans crash', () => {
    const s = makeStudentRecord('');
    const text = buildBilanText(s);
    expect(text).toContain('BILAN ÉLÈVE');
    expect(text).toContain('Nom : –');
  });
  it('textes non renseignés → "(non renseignée)"', () => {
    const s = makeStudentRecord('Test');
    expect(buildBilanText(s)).toContain('non renseignée');
  });
});

describe('buildBilanCSV — format et contenu', () => {
  it('exactement 2 lignes', () => {
    const lines = buildBilanCSV(fullStudent('X')).trim().split('\n');
    expect(lines).toHaveLength(2);
  });
  it('header contient Nom, XP, Progression, Niveau', () => {
    const csv = buildBilanCSV(fullStudent('X'));
    const h = csv.split('\n')[0];
    expect(h).toContain('Nom');
    expect(h).toContain('XP');
    expect(h).toContain('Progression');
    expect(h).toContain('Niveau');
  });
  it('header contient Modules et Badges', () => {
    const h = buildBilanCSV(fullStudent('X')).split('\n')[0];
    expect(h).toContain('Modules');
    expect(h).toContain('Badges');
  });
  it('contient le nom de l\'élève', () => { expect(buildBilanCSV(fullStudent('Neil ZAYANE'))).toContain('Neil ZAYANE'); });
  it('cellules entre guillemets', () => { expect(buildBilanCSV(fullStudent('X'))).toMatch(/"[^"]*"/); });
  it('guillemets dans valeur échappés ("" CSV)', () => {
    const s = fullStudent('He said "hello"');
    const csv = buildBilanCSV(s);
    expect(csv).toContain('""');
  });
  it('virgule dans le nom n\'écrase pas le CSV', () => {
    const csv = buildBilanCSV(fullStudent('Jean, Pierre'));
    expect(csv.split('\n')[1]).toContain('"Jean, Pierre"');
  });
});
