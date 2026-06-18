import { describe, it, expect } from 'vitest';
import {
  normalize, isCorrect, scoreQuiz,
  countCorrectAuto, countCorrectAll, countAllQuestions,
  countMasteredCards, countPaper, countStrategy,
  getProgress, rank, getBadgeIds, getBadges, getCompletedModules,
  makeStudentRecord, AUTO_QUESTIONS, MISSIONS, FLASHCARD_IDS,
} from '../../src/logic.js';

// ── normalize ──
describe('normalize', () => {
  it('trim et lowercase', () => { expect(normalize('  64  ')).toBe('64'); });
  it('virgule → point', () => { expect(normalize('57,6')).toBe('57.6'); });
  it('supprime euros', () => { expect(normalize('64 €')).toBe('64'); expect(normalize('64 euros')).toBe('64'); });
  it('× → x', () => { expect(normalize('4,2 × 10^4')).toBe('4.2x10^4'); });
  it('* → x', () => { expect(normalize('4*10^4')).toBe('4x10^4'); });
  it('mode pythagore : ² et ^2', () => {
    expect(normalize('BC²=AB²+AC²', 'pythagore')).toBe('bc2=ab2+ac2');
    expect(normalize('BC^2=AB^2+AC^2', 'pythagore')).toBe('bc2=ab2+ac2');
  });
  it('null/undefined → chaîne vide', () => { expect(normalize(null)).toBe(''); expect(normalize(undefined)).toBe(''); });
});

// ── isCorrect — automatismes ──
describe('isCorrect — automatismes (toutes les 10 questions)', () => {
  const q = (i) => AUTO_QUESTIONS[i];
  it('Q1 1/2', () => expect(isCorrect(q(0), '1/2')).toBe(true));
  it('Q1 0,5 (virgule fr)', () => expect(isCorrect(q(0), '0,5')).toBe(true));
  it('Q1 wrong', () => expect(isCorrect(q(0), '2/3')).toBe(false));
  it('Q2 20', () => expect(isCorrect(q(1), '20')).toBe(true));
  it('Q2 wrong', () => expect(isCorrect(q(1), '25')).toBe(false));
  it('Q3 64', () => expect(isCorrect(q(2), '64')).toBe(true));
  it('Q4 0,5', () => expect(isCorrect(q(3), '0,5')).toBe(true));
  it('Q4 1/2', () => expect(isCorrect(q(3), '1/2')).toBe(true));
  it('Q5 40', () => expect(isCorrect(q(4), '40')).toBe(true));
  it('Q5 40 km', () => expect(isCorrect(q(4), '40 km')).toBe(true));
  it('Q6 8', () => expect(isCorrect(q(5), '8')).toBe(true));
  it('Q6 x=8', () => expect(isCorrect(q(5), 'x=8')).toBe(true));
  it('Q7 4,2×10^4', () => expect(isCorrect(q(6), '4,2 × 10^4')).toBe(true));
  it('Q7 4.2*10^4', () => expect(isCorrect(q(6), '4.2*10^4')).toBe(true));
  it('Q8 11', () => expect(isCorrect(q(7), '11')).toBe(true));
  it('Q9 3/10', () => expect(isCorrect(q(8), '3/10')).toBe(true));
  it('Q9 30%', () => expect(isCorrect(q(8), '30%')).toBe(true));
  it('Q9 0,3', () => expect(isCorrect(q(8), '0,3')).toBe(true));
  it('Q10 BC²=AB²+AC²', () => expect(isCorrect(q(9), 'BC²=AB²+AC²')).toBe(true));
  it('Q10 bc2=ab2+ac2', () => expect(isCorrect(q(9), 'bc2=ab2+ac2')).toBe(true));
  it('réponse vide → faux', () => expect(isCorrect(q(0), '')).toBe(false));
  it('espace seul → faux', () => expect(isCorrect(q(0), '   ')).toBe(false));
});

// ── isCorrect — missions ──
describe('isCorrect — pourcentages successifs', () => {
  it('p1: 64', () => expect(isCorrect(MISSIONS.percent[0], '64')).toBe(true));
  it('p1: 64 €', () => expect(isCorrect(MISSIONS.percent[0], '64 €')).toBe(true));
  it('p2: 57,6', () => expect(isCorrect(MISSIONS.percent[1], '57,6')).toBe(true));
  it('p2: 57.60', () => expect(isCorrect(MISSIONS.percent[1], '57.60')).toBe(true));
  it('p3: 28%', () => expect(isCorrect(MISSIONS.percent[2], '28%')).toBe(true));
  it('p3: 28', () => expect(isCorrect(MISSIONS.percent[2], '28')).toBe(true));
});

describe('isCorrect — PGCD/PPCM', () => {
  it('ar1: PGCD', () => expect(isCorrect(MISSIONS.arith[0], 'PGCD')).toBe(true));
  it('ar1: PPCM faux', () => expect(isCorrect(MISSIONS.arith[0], 'PPCM')).toBe(false));
  it('ar2: 18', () => expect(isCorrect(MISSIONS.arith[1], '18')).toBe(true));
  it('ar3: 4', () => expect(isCorrect(MISSIONS.arith[2], '4')).toBe(true));
  it('ar4: 5', () => expect(isCorrect(MISSIONS.arith[3], '5')).toBe(true));
});

describe('isCorrect — programmes de calcul et fonctions', () => {
  it('al1: 2(x+6)', () => expect(isCorrect(MISSIONS.algebra[0], '2(x+6)')).toBe(true));
  it('al1: 2x+12', () => expect(isCorrect(MISSIONS.algebra[0], '2x+12')).toBe(true));
  it('al2: 7', () => expect(isCorrect(MISSIONS.algebra[1], '7')).toBe(true));
  it('al2: x=7', () => expect(isCorrect(MISSIONS.algebra[1], 'x=7')).toBe(true));
  it('al3: 6 (antécédent)', () => expect(isCorrect(MISSIONS.algebra[2], '6')).toBe(true));
  it('al4: 3(x+4) (Scratch)', () => expect(isCorrect(MISSIONS.algebra[3], '3(x+4)')).toBe(true));
  it('al4: 3x+12 (Scratch)', () => expect(isCorrect(MISSIONS.algebra[3], '3x+12')).toBe(true));
});

describe('isCorrect — Pythagore, volumes, trigonométrie', () => {
  it('g1: 10 cm', () => expect(isCorrect(MISSIONS.geo[0], '10 cm')).toBe(true));
  it('g1: 10', () => expect(isCorrect(MISSIONS.geo[0], '10')).toBe(true));
  it('g2: 2 m', () => expect(isCorrect(MISSIONS.geo[1], '2 m')).toBe(true));
  it('g3: 48pi', () => expect(isCorrect(MISSIONS.geo[2], '48pi')).toBe(true));
  it('g3: 48π', () => expect(isCorrect(MISSIONS.geo[2], '48π')).toBe(true));
  it('g4: 1000 L', () => expect(isCorrect(MISSIONS.geo[3], '1000 L')).toBe(true));
  it('g5: sinus', () => expect(isCorrect(MISSIONS.geo[4], 'sinus')).toBe(true));
  it('g5: cosinus → faux', () => expect(isCorrect(MISSIONS.geo[4], 'cosinus')).toBe(false));
});

// ── scoreQuiz ──
describe('scoreQuiz', () => {
  it('percent 3/3 avec bonnes réponses', () => {
    const r = scoreQuiz(MISSIONS.percent, { p1: '64', p2: '57,6', p3: '28' });
    expect(r.correct).toBe(3);
    expect(r.total).toBe(3);
  });
  it('percent 0/3 si tout vide', () => {
    expect(scoreQuiz(MISSIONS.percent, {}).correct).toBe(0);
  });
  it('résultat partiel', () => {
    const r = scoreQuiz(MISSIONS.percent, { p1: '64', p2: '', p3: '999' });
    expect(r.correct).toBe(1);
  });
  it('arith 4/4', () => {
    const r = scoreQuiz(MISSIONS.arith, { ar1: 'PGCD', ar2: '18', ar3: '4', ar4: '5' });
    expect(r.correct).toBe(4);
  });
});

// ── Counts et progress ──
describe('countAllQuestions', () => {
  it('= 10 auto + 3+4+4+5 missions = 26', () => expect(countAllQuestions()).toBe(26));
});

describe('getProgress', () => {
  it('0 % sur état vide', () => expect(getProgress(makeStudentRecord('X'))).toBe(0));
  it('augmente avec les bonnes réponses', () => {
    const s = makeStudentRecord('X');
    AUTO_QUESTIONS.forEach(q => { s.answers.auto[q.id] = { correct: true }; });
    expect(getProgress(s)).toBeGreaterThan(0);
  });
  it('100 % quand tout est complété', () => {
    const s = makeStudentRecord('X');
    AUTO_QUESTIONS.forEach(q => { s.answers.auto[q.id] = { correct: true }; });
    FLASHCARD_IDS.forEach(id => { s.flash[id] = { mastered: true }; });
    Object.entries(MISSIONS).forEach(([ns, qs]) => {
      qs.forEach(q => { s.answers.missions[ns] = s.answers.missions[ns] || {}; s.answers.missions[ns][q.id] = { correct: true }; });
    });
    s.paperTasks = { pythagore: true, reciproque: true, thales: true, scratch: true };
    s.strategy = { a: true, b: true, c: true, d: true, e: true };
    expect(getProgress(s)).toBe(100);
  });
  it('ne dépasse pas 100', () => {
    const s = makeStudentRecord('X');
    s.xp = 999999;
    expect(getProgress(s)).toBeLessThanOrEqual(100);
  });
});

describe('rank', () => {
  it('Départ sur état vide', () => expect(rank(makeStudentRecord('X'))).toBe('Départ'));
  it('progression 90+ → Prêt solide ou Prêt efficace', () => {
    const s = makeStudentRecord('X');
    AUTO_QUESTIONS.forEach(q => { s.answers.auto[q.id] = { correct: true }; });
    FLASHCARD_IDS.forEach(id => { s.flash[id] = { mastered: true }; });
    Object.entries(MISSIONS).forEach(([ns, qs]) => {
      qs.forEach(q => { s.answers.missions[ns] = s.answers.missions[ns] || {}; s.answers.missions[ns][q.id] = { correct: true }; });
    });
    s.paperTasks = { a: true, b: true, c: true, d: true };
    s.strategy = { a: true, b: true, c: true, d: true, e: true };
    expect(['Prêt solide', 'Prêt efficace']).toContain(rank(s));
  });
});

// ── Badges ──
describe('getBadgeIds', () => {
  it('aucun badge si xp=0', () => expect(getBadgeIds(makeStudentRecord('X'))).toHaveLength(0));
  it('badge starter si xp>0', () => { const s = makeStudentRecord('X'); s.xp = 1; expect(getBadgeIds(s)).toContain('starter'); });
  it('badge auto si >=7 correct', () => {
    const s = makeStudentRecord('X');
    AUTO_QUESTIONS.slice(0, 7).forEach(q => { s.answers.auto[q.id] = { correct: true }; });
    expect(getBadgeIds(s)).toContain('auto');
  });
  it('badge cards si >=5 maîtrisées', () => {
    const s = makeStudentRecord('X');
    FLASHCARD_IDS.slice(0, 5).forEach(id => { s.flash[id] = { mastered: true }; });
    expect(getBadgeIds(s)).toContain('cards');
  });
  it('badge paper si >=3 papier', () => {
    const s = makeStudentRecord('X');
    s.paperTasks = { a: true, b: true, c: true };
    expect(getBadgeIds(s)).toContain('paper');
  });
  it('6 correct auto ne donne pas badge auto', () => {
    const s = makeStudentRecord('X');
    AUTO_QUESTIONS.slice(0, 6).forEach(q => { s.answers.auto[q.id] = { correct: true }; });
    expect(getBadgeIds(s)).not.toContain('auto');
  });
});

describe('getCompletedModules', () => {
  it('aucun module sur état vide', () => expect(getCompletedModules(makeStudentRecord('X'))).toHaveLength(0));
  it('module auto si 10/10 correct', () => {
    const s = makeStudentRecord('X');
    AUTO_QUESTIONS.forEach(q => { s.answers.auto[q.id] = { correct: true }; });
    expect(getCompletedModules(s)).toContain('auto');
  });
  it('module percent si 3/3 correct', () => {
    const s = makeStudentRecord('X');
    MISSIONS.percent.forEach(q => { s.answers.missions.percent = s.answers.missions.percent || {}; s.answers.missions.percent[q.id] = { correct: true }; });
    expect(getCompletedModules(s)).toContain('percent');
  });
});
