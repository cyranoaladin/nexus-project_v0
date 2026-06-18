/**
 * logic.js — Fonctions pures exportées pour les tests unitaires.
 * Miroir exact de la logique dans index.html.
 * Toute modification ici doit être répercutée dans index.html et vice-versa.
 */

export const SCHEMA_VERSION = 2;
export const ROOT_KEY = 'nexusDnbRoot';

export const XP_REWARDS = {
  autoCorrect: 10,
  missionStep: 10,
  flashMaster: 10,
  paperDone: 15,
  strategyDone: 8,
  textSave: 10,
};

export const AUTO_QUESTIONS = [
  { id: 'a1', label: '1', answer: ['1/2', '0.5', '0,5'] },
  { id: 'a2', label: '2', answer: ['20'] },
  { id: 'a3', label: '3', answer: ['64'] },
  { id: 'a4', label: '4', answer: ['0.5', '0,5', '1/2'] },
  { id: 'a5', label: '5', answer: ['40', '40 km'] },
  { id: 'a6', label: '6', answer: ['8', 'x=8', 'x = 8'] },
  { id: 'a7', label: '7', answer: ['4.2x10^4', '4,2x10^4', '4.2*10^4', '4,2*10^4', '4.2 × 10^4', '4,2 × 10^4', '4.2 10^4', '4,2 10^4'] },
  { id: 'a8', label: '8', answer: ['11'] },
  { id: 'a9', label: '9', answer: ['3/10', '0.3', '0,3', '30%', '30 %'] },
  { id: 'a10', label: '10', answer: ['bc2=ab2+ac2', 'bc^2=ab^2+ac^2', 'bc²=ab²+ac²', 'BC²=AB²+AC²'], normalize: 'pythagore' },
];

export const MISSIONS = {
  percent: [
    { id: 'p1', answer: ['64', '64 €', '64 euros'] },
    { id: 'p2', answer: ['57.6', '57,6', '57.60', '57,60', '57,60 €', '57.6 €'] },
    { id: 'p3', answer: ['28', '28%', '28 %'] },
  ],
  arith: [
    { id: 'ar1', type: 'select', options: ['', 'PGCD', 'PPCM'], answer: ['PGCD'] },
    { id: 'ar2', answer: ['18'] },
    { id: 'ar3', answer: ['4'] },
    { id: 'ar4', answer: ['5'] },
  ],
  algebra: [
    { id: 'al1', answer: ['2(x+6)', '2*(x+6)', '2 × (x+6)', '2x+12'] },
    { id: 'al2', answer: ['7', 'x=7', 'x = 7'] },
    { id: 'al3', answer: ['6', 'x=6', 'x = 6'] },
    { id: 'al4', answer: ['3(x+4)', '3*(x+4)', '3 × (x+4)', '3x+12'] },
  ],
  geo: [
    { id: 'g1', answer: ['10', '10 cm'] },
    { id: 'g2', answer: ['2', '2 m'] },
    { id: 'g3', answer: ['48pi', '48π', '48 pi', '48π m3', '48π m^3', '48pi m3', '48pi m^3'] },
    { id: 'g4', answer: ['1000', '1000 l', '1000 L', '1000 litres'] },
    { id: 'g5', type: 'select', options: ['', 'sinus', 'cosinus', 'tangente'], answer: ['sinus'] },
  ],
};

export const FLASHCARD_IDS = ['fc1', 'fc2', 'fc3', 'fc4', 'fc5', 'fc6', 'fc7', 'fc8'];

// ── Student ID ──

export function makeStudentId(name) {
  return String(name || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/gi, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'eleve';
}

// ── Validation ──

export function validateName(rawName) {
  const name = String(rawName || '').trim();
  if (!name) return { valid: false, error: 'Saisis ton prénom pour commencer.' };
  return { valid: true, name };
}

// ── State factories ──

export function makeStudentRecord(name) {
  const trimmed = String(name || '').trim();
  return {
    id: makeStudentId(trimmed),
    name: trimmed,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    xp: 0,
    badges: [],
    completedModules: [],
    answers: { auto: {}, missions: {} },
    paperTasks: {},
    strategy: {},
    flash: {},
    text: { pledge: '', checklist: '' },
    awarded: {},
    autoHints: false,
    history: [],
  };
}

export function makeRoot() {
  return { schemaVersion: SCHEMA_VERSION, activeStudentId: null, students: {} };
}

// ── Storage parsing (injectable for tests) ──

export function parseRoot(raw) {
  if (!raw) return makeRoot();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return makeRoot();
    if (parsed.schemaVersion !== SCHEMA_VERSION) return makeRoot();
    if (!parsed.students || typeof parsed.students !== 'object') return makeRoot();
    return parsed;
  } catch {
    return makeRoot();
  }
}

export function loadRootFromStorage(storage) {
  try {
    const raw = storage.getItem(ROOT_KEY);
    return parseRoot(raw);
  } catch {
    return makeRoot();
  }
}

export function saveRootToStorage(root, storage) {
  try {
    storage.setItem(ROOT_KEY, JSON.stringify(root));
    return { ok: true };
  } catch (e) {
    if (e.name === 'QuotaExceededError') return { ok: false, error: 'quota' };
    return { ok: false, error: e.message };
  }
}

// ── Student management ──

export function getOrCreateStudent(root, name) {
  const { valid, name: cleanName, error } = validateName(name);
  if (!valid) throw new Error(error);
  const id = makeStudentId(cleanName);
  if (!root.students[id]) {
    root.students[id] = makeStudentRecord(cleanName);
  } else {
    root.students[id].name = cleanName;
  }
  return { root, student: root.students[id], id };
}

// ── Normalization & scoring ──

export function normalize(value, mode) {
  let s = String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/€/g, '')
    .replace(/euros?/gi, '')
    .replace(/,/g, '.')
    .replace(/×/g, 'x')
    .replace(/\*/g, 'x');
  if (mode === 'pythagore') {
    s = s.toLowerCase().replace(/\^2/g, '2').replace(/²/g, '2');
  }
  return s.toLowerCase();
}

export function isCorrect(question, value) {
  const nv = normalize(value, question.normalize);
  return question.answer.some((ans) => normalize(ans, question.normalize) === nv);
}

export function scoreQuiz(questions, answers) {
  let correct = 0;
  const results = {};
  for (const q of questions) {
    const value = answers[q.id] ?? '';
    const ok = isCorrect(q, value);
    results[q.id] = { value, correct: ok };
    if (ok) correct++;
  }
  return { correct, total: questions.length, results };
}

// ── Counts ──

export function countCorrectAuto(student) {
  return AUTO_QUESTIONS.filter((q) => student.answers.auto[q.id]?.correct).length;
}

export function countCorrectAll(student) {
  let n = countCorrectAuto(student);
  for (const [ns, qs] of Object.entries(MISSIONS)) {
    for (const q of qs) {
      if (student.answers.missions[ns]?.[q.id]?.correct) n++;
    }
  }
  return n;
}

export function countAllQuestions() {
  return AUTO_QUESTIONS.length + Object.values(MISSIONS).flat().length;
}

export function countMasteredCards(student) {
  return FLASHCARD_IDS.filter((id) => student.flash[id]?.mastered).length;
}

export function countPaper(student) {
  return Object.values(student.paperTasks).filter(Boolean).length;
}

export function countStrategy(student) {
  return Object.values(student.strategy).filter(Boolean).length;
}

export function getProgress(student) {
  const parts = [
    countCorrectAuto(student) / AUTO_QUESTIONS.length,
    countMasteredCards(student) / FLASHCARD_IDS.length,
    countCorrectAll(student) / countAllQuestions(),
    countPaper(student) / 4,
    countStrategy(student) / 5,
  ];
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
}

export function rank(student) {
  const p = getProgress(student);
  if (p >= 90) return 'Prêt solide';
  if (p >= 75) return 'Prêt efficace';
  if (p >= 55) return 'En bonne voie';
  if (p >= 25) return 'Échauffement';
  return 'Départ';
}

// ── Badges ──

export function getBadgeIds(student) {
  const out = [];
  if (student.xp > 0) out.push('starter');
  if (countCorrectAuto(student) >= 7) out.push('auto');
  if (countMasteredCards(student) >= 5) out.push('cards');
  if (countPaper(student) >= 3) out.push('paper');
  if (getProgress(student) >= 80) out.push('ready');
  return out;
}

export function getBadges(student) {
  const labels = { starter: 'Départ', auto: 'Automatismes', cards: 'Méthodes', paper: 'Rédacteur', ready: 'Prêt demain' };
  return getBadgeIds(student).map((id) => ({ id, label: labels[id] }));
}

// ── Completed modules ──

export function getCompletedModules(student) {
  const mods = [];
  if (countCorrectAuto(student) === AUTO_QUESTIONS.length) mods.push('auto');
  if (countMasteredCards(student) === FLASHCARD_IDS.length) mods.push('flashcards');
  for (const [ns, qs] of Object.entries(MISSIONS)) {
    if (qs.every((q) => student.answers.missions[ns]?.[q.id]?.correct)) mods.push(ns);
  }
  if (countPaper(student) >= 4) mods.push('redaction');
  if (countStrategy(student) >= 5) mods.push('strategy');
  return [...new Set(mods)];
}

// ── XP award (pure / immutable) ──

export function applyAward(student, key, amount) {
  if (student.awarded[key]) return student;
  return {
    ...student,
    awarded: { ...student.awarded, [key]: true },
    xp: student.xp + amount,
    history: [
      ...student.history,
      { action: 'xp', detail: `+${amount} XP`, xp: amount, timestamp: new Date().toISOString() },
    ],
  };
}

// ── Reset student ──

export function resetStudent(root, id) {
  if (!root.students[id]) return root;
  const name = root.students[id].name;
  const hist = root.students[id].history || [];
  const fresh = makeStudentRecord(name);
  fresh.id = id;
  fresh.history = [...hist, { action: 'reset', detail: 'Progression réinitialisée', timestamp: new Date().toISOString() }];
  return { ...root, students: { ...root.students, [id]: fresh } };
}

// ── Bilan text ──

export function buildBilanText(student) {
  const now = new Date().toLocaleString('fr-FR');
  const blabels = { starter: 'Départ', auto: 'Automatismes', cards: 'Méthodes', paper: 'Rédacteur', ready: 'Prêt demain' };
  const earned = (student.badges || getBadgeIds(student)).map((id) => blabels[id]).filter(Boolean).join(', ') || 'Aucun';
  const errors = AUTO_QUESTIONS.filter(
    (q) => student.answers.auto[q.id]?.checked && !student.answers.auto[q.id]?.correct
  ).map((q) => `  - Q${q.label}: ${q.id}`).join('\n') || '  (aucune erreur détectée ou non corrigé)';
  const paper = Object.entries(student.paperTasks).filter(([, v]) => v).map(([k]) => k).join(', ') || 'Aucune';
  const mods = (student.completedModules || getCompletedModules(student)).join(', ') || 'Aucun';

  return [
    'BILAN ÉLÈVE — NEXUS RÉUSSITE',
    `Nom : ${student.name || '–'}`,
    `Date : ${now}`,
    '',
    `Score : ${countCorrectAll(student)}/${countAllQuestions()} réponses correctes`,
    `XP : ${student.xp}`,
    `Progression : ${getProgress(student)}%`,
    `Niveau : ${rank(student)}`,
    '',
    `Automatismes : ${countCorrectAuto(student)}/10`,
    `Flashcards maîtrisées : ${countMasteredCards(student)}/8`,
    `Rédactions papier : ${countPaper(student)}/4`,
    '',
    `Modules complétés : ${mods}`,
    '',
    `Badges obtenus : ${earned}`,
    '',
    'Erreurs automatismes :',
    errors,
    '',
    `Rédactions papier faites : ${paper}`,
    '',
    `Phrase de copie : ${student.text?.pledge || '(non renseignée)'}`,
    `Points à vérifier : ${student.text?.checklist || '(non renseignés)'}`,
    '',
    `Créé le : ${student.createdAt ? new Date(student.createdAt).toLocaleString('fr-FR') : '–'}`,
    `Mis à jour le : ${student.updatedAt ? new Date(student.updatedAt).toLocaleString('fr-FR') : '–'}`,
    '',
    "⚠ Réponses sur feuille (Pythagore, Réciproque, Thalès, Scratch) non autocorrigées.",
    "  L'élève doit les montrer au professeur.",
    '',
    "L'historique est sauvegardé dans le navigateur via localStorage.",
    "Il est récupérable sur le même appareil et le même navigateur.",
    "En l'état, le professeur récupère le bilan si l'élève l'exporte ou le copie.",
    '',
    'Généré par nexusreussite.academy',
  ].join('\n');
}

export function buildBilanCSV(student) {
  const header = ['Nom', 'Date', 'XP', 'Progression', 'Automatismes', 'Flashcards', 'Rédactions', 'Modules', 'Badges', 'Niveau'];
  const row = [
    student.name || '',
    new Date().toLocaleString('fr-FR'),
    student.xp,
    `${getProgress(student)}%`,
    `${countCorrectAuto(student)}/10`,
    `${countMasteredCards(student)}/8`,
    `${countPaper(student)}/4`,
    (student.completedModules || getCompletedModules(student)).join('|'),
    (student.badges || getBadgeIds(student)).join('|'),
    rank(student),
  ];
  const escape = (c) => `"${String(c).replace(/"/g, '""')}"`;
  return [header.map(escape).join(','), row.map(escape).join(',')].join('\n');
}
