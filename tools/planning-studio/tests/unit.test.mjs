// Tests unitaires légers (Node ≥ 18, sans dépendance) : moteur de validation,
// modèle, migration v1 → v2, exports, suggestions de créneaux.
// Usage : node tests/unit.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { console };
vm.createContext(ctx);
for (const f of ['core.js', 'model.js', 'validation.js', 'storage.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'assets', f), 'utf8'), ctx, { filename: f });
}
const Nexus = ctx.Nexus;
const defaultJson = JSON.parse(fs.readFileSync(path.join(root, 'data/planning.default.json'), 'utf8'));
const v1Json = JSON.parse(fs.readFileSync(path.join(root, 'data/legacy/planning.v1.original.json'), 'utf8'));
const defaultJs = fs.readFileSync(path.join(root, 'data/default-data.js'), 'utf8');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log('PASS ' + name); }
  catch (e) { failed += 1; console.log('FAIL ' + name + '\n     ' + (e && e.message)); }
}
const fresh = () => Nexus.normalize(structuredClone(defaultJson));
const codes = (r) => r.issues.map((i) => i.code);

/* ---------- données initiales ---------- */
test('données initiales : 45 séances, 10 enseignants, 3 salles, 14 matières, 11 groupes', () => {
  const d = fresh();
  assert.equal(d.sessions.length, 45);
  assert.equal(d.teachers.length, 10);
  assert.equal(d.rooms.length, 3);
  assert.equal(d.subjects.length, 14);
  assert.equal(d.groups.length, 11);
});
test('default-data.js contient exactement le JSON par défaut', () => {
  const m = /window\.NEXUS_DEFAULT_PLANNING = ([\s\S]*);\s*$/.exec(defaultJs);
  assert.ok(m, 'fallback JS introuvable');
  assert.deepEqual(JSON.parse(m[1]), defaultJson);
});
test('planning initial : 0 erreur bloquante', () => {
  const r = Nexus.validate(fresh());
  assert.equal(r.counts.error, 0);
  assert.ok(r.counts.warning >= 1);
});
test('migration v1 → v2 : chaque séance conservée à l\'identique', () => {
  const d = Nexus.normalize(structuredClone(v1Json));
  assert.equal(d.schemaVersion, 2);
  assert.equal(d.sessions.length, v1Json.sessions.length);
  for (const s of v1Json.sessions) {
    const t = d.sessions.find((x) => x.id === s.id);
    assert.ok(t, 'séance manquante ' + s.id);
    assert.equal(t.day + t.start + t.end + t.level + t.audience + t.subjectId + t.groupId, s.day + s.start + s.end + s.level + s.audience + s.subject + s.group);
    assert.equal(t.teacherId, 'teacher-' + s.teacher.toLowerCase());
    assert.equal(t.roomId, 'room-' + s.room.slice(1));
    assert.equal(t.active, s.active);
  }
  assert.equal(d.groups.find((g) => g.id === 'T-SCO-A').variant, 'A');
  assert.equal(d.groups.find((g) => g.id === 'P1-SCO-B').variant, 'B');
  assert.equal(d.settings.normalSimultaneous, 2);
  assert.equal(d.settings.maxSimultaneous, 3);
});

/* ---------- temps ---------- */
test('parseTime / fmtTime', () => {
  assert.equal(Nexus.parseTime('09:00'), 540);
  assert.equal(Nexus.parseTime('9:05'), 545);
  assert.equal(Nexus.parseTime('24:00'), null);
  assert.equal(Nexus.parseTime(''), null);
  assert.equal(Nexus.parseTime('abc'), null);
  assert.equal(Nexus.fmtTime('09:00'), '09h00');
  assert.equal(Nexus.fmtRange('19:15', '21:15'), '19h15–21h15');
  assert.equal(Nexus.minutesToTime(1290), '21:30');
});

/* ---------- C5 durée ---------- */
test('heure vide → erreur INVALID_TIME', () => {
  const d = fresh(); d.sessions[0].start = '';
  assert.ok(codes(Nexus.validate(d)).includes('INVALID_TIME'));
});
test('heure invalide → erreur INVALID_TIME', () => {
  const d = fresh(); d.sessions[0].end = '25:99';
  assert.ok(codes(Nexus.validate(d)).includes('INVALID_TIME'));
});
test('séance dépassant minuit (fin < début) → erreur', () => {
  const d = fresh(); d.sessions[0].start = '23:00'; d.sessions[0].end = '01:00';
  assert.ok(codes(Nexus.validate(d)).includes('INVALID_TIME'));
});
test('durée nulle → erreur', () => {
  const d = fresh(); d.sessions[0].end = d.sessions[0].start;
  assert.ok(codes(Nexus.validate(d)).includes('INVALID_TIME'));
});

/* ---------- C1 / C2 / C3 ---------- */
test('deux séances exactement consécutives : aucun conflit', () => {
  const d = fresh();
  d.sessions.push(Nexus.newSession(d, { id: 'x', day: 'MON', start: '15:30', end: '17:30', roomId: 'room-1', teacherId: 'teacher-m2', groupId: 'P1-CL', subjectId: 'MATHS', level: 'PREMIERE', audience: 'CL' }));
  const r = Nexus.validate(d);
  assert.ok(!codes(r).some((c) => ['TEACHER_OVERLAP', 'ROOM_OVERLAP', 'GROUP_OVERLAP'].includes(c)));
});
test('chevauchement de 15 min : conflits enseignant, salle et groupe', () => {
  const d = fresh();
  d.sessions.push(Nexus.newSession(d, { id: 'x', day: 'MON', start: '15:45', end: '17:45', roomId: 'room-1', teacherId: 'teacher-m2', groupId: 'P1-CL', subjectId: 'MATHS', level: 'PREMIERE', audience: 'CL' }));
  const c = codes(Nexus.validate(d));
  assert.ok(c.includes('TEACHER_OVERLAP')); assert.ok(c.includes('ROOM_OVERLAP')); assert.ok(c.includes('GROUP_OVERLAP'));
});
test('séance inactive : ne crée aucun conflit et n\'occupe pas la salle', () => {
  const d = fresh();
  d.sessions.push(Nexus.newSession(d, { id: 'x', day: 'MON', start: '17:30', end: '19:30', roomId: 'room-1', teacherId: 'teacher-m2', groupId: 'P1-CL', active: false }));
  const c = codes(Nexus.validate(d));
  assert.ok(!c.includes('ROOM_OVERLAP') && !c.includes('TEACHER_OVERLAP'));
  assert.equal(Nexus.roomStats(d, 'room-1').sessions, Nexus.roomStats(fresh(), 'room-1').sessions);
});
test('conflit enseignant : message avec le nom réel', () => {
  const d = fresh();
  d.teachers[0].name = 'Alaeddine Ben Rhouma';
  const s = d.sessions.find((x) => x.id === 'SAT-1115-T-NSI'); s.start = '09:30'; s.end = '11:30';
  const r = Nexus.validate(d);
  const iss = r.issues.find((i) => i.code === 'TEACHER_OVERLAP');
  assert.ok(iss && iss.message.includes('Alaeddine Ben Rhouma'));
  assert.equal(r.bySession.get('SAT-1115-T-NSI').severity, 'error');
});

/* ---------- C4 centre ---------- */
test('3 cours simultanés → avertissement (salle exceptionnelle), pas erreur', () => {
  const d = fresh();
  // Le groupe est obligatoire depuis le durcissement H7 : sans lui, la séance
  // serait rejetée pour référence manquante avant même d'atteindre C4.
  d.sessions.push(Nexus.newSession(d, { id: 'x', day: 'SAT', start: '09:00', end: '11:00', roomId: 'room-3', teacherId: 'teacher-ses', subjectId: 'SES', groupId: 'T-CL', level: 'TERMINALE', audience: 'CL' }));
  const r = Nexus.validate(d);
  assert.ok(codes(r).includes('CENTER_EXCEPTIONAL'));
  assert.ok(codes(r).includes('EXCEPTIONAL_ROOM'));
  assert.equal(r.counts.error, 0);
});
test('4 cours simultanés → erreur CENTER_OVERFLOW', () => {
  const d = fresh();
  d.sessions.push(Nexus.newSession(d, { id: 'x1', day: 'SAT', start: '09:00', end: '11:00', roomId: 'room-3', teacherId: 'teacher-ses', subjectId: 'SES', groupId: '' }));
  d.sessions.push(Nexus.newSession(d, { id: 'x2', day: 'SAT', start: '10:00', end: '12:00', roomId: '', teacherId: 'teacher-pc', subjectId: 'PC', groupId: '' }));
  const r = Nexus.validate(d);
  assert.ok(codes(r).includes('CENTER_OVERFLOW'));
  assert.ok(r.counts.error >= 1);
});

/* ---------- C6 / C7 / C9 ---------- */
test('matière hors compétences → avertissement', () => {
  const d = fresh(); d.sessions[0].teacherId = 'teacher-svt';
  assert.ok(codes(Nexus.validate(d)).includes('TEACHER_SKILL'));
});
test('indisponibilité enseignant → erreur', () => {
  const d = fresh(); d.teachers[0].unavailability = [{ day: 'SAT', start: '08:00', end: '12:00', note: 'réunion' }];
  const r = Nexus.validate(d);
  assert.ok(codes(r).includes('TEACHER_UNAVAILABLE'));
  assert.ok(r.issues.find((i) => i.code === 'TEACHER_UNAVAILABLE').message.includes('réunion'));
});
test('enseignant supprimé encore référencé → erreur ; salle supprimée → erreur', () => {
  const d = fresh(); d.teachers = d.teachers.filter((t) => t.id !== 'teacher-m1'); d.rooms = d.rooms.filter((r) => r.id !== 'room-2');
  const c = codes(Nexus.validate(d));
  assert.ok(c.includes('MISSING_TEACHER') && c.includes('MISSING_ROOM'));
});
test('ID dupliqué : normalisation le répare, validation le signale sinon', () => {
  const d = fresh(); d.sessions[1].id = d.sessions[0].id;
  assert.ok(codes(Nexus.validate(d)).includes('DUPLICATE_ID'));
  const n = Nexus.normalize(d);
  assert.equal(new Set(n.sessions.map((s) => s.id)).size, n.sessions.length);
});
test('règles pédagogiques : collège hors mercredi, Seconde hors mercredi, cours tardif', () => {
  const d = fresh();
  d.sessions.find((s) => s.id === 'WED-1430-4-M').day = 'SAT';
  d.sessions.find((s) => s.id === 'WED-1645-2-M').day = 'THU';
  const c = codes(Nexus.validate(d));
  assert.ok(c.includes('COLLEGE_DAY') && c.includes('SECONDE_DAY') && c.includes('LATE_SESSION'));
});
test('attentes : pause déjeuner déduite, seule l\'attente réelle est signalée', () => {
  const d = fresh();
  const r = Nexus.validate(d);
  // 3e mercredi : 16h30 → 19h00, 2 h 30 pleines, hors déjeuner.
  assert.ok(codes(r).includes('WAIT_LONG'));
  // 1re samedi et Tle dimanche : 13h15 → 14h45, soit EXACTEMENT la pause
  // déjeuner configurée. Ce n'est pas une attente subie : plus aucun
  // diagnostic ne doit être émis pour ces deux intervalles.
  const waits = r.issues.filter((i) => i.code.startsWith('WAIT'));
  assert.equal(waits.length, 1);
  assert.ok(waits[0].sessionIds.includes('WED-1900-3-M'));
  assert.ok(!r.issues.some((i) => i.code.startsWith('WAIT') && i.sessionIds.includes('FRI-1430-P1-PC')));
});

/* ---------- previewConflicts ---------- */
test('previewConflicts : candidat en conflit de salle', () => {
  const d = fresh();
  const s = Object.assign({}, d.sessions.find((x) => x.id === 'SUN-0900-T-PHILO'), { roomId: 'room-1' });
  const p = Nexus.previewConflicts(d, s);
  assert.equal(p.severity, 'error');
  assert.ok(p.issues.some((i) => i.code === 'ROOM_OVERLAP'));
});

/* ---------- import ---------- */
test('inspectImport : JSON corrompu / structure invalide refusés', () => {
  assert.equal(Nexus.inspectImport(null).ok, false);
  assert.equal(Nexus.inspectImport([]).ok, false);
  assert.equal(Nexus.inspectImport({ sessions: 'x' }).ok, false);
  const bad = structuredClone(defaultJson); bad.sessions[0].start = 'zz';
  const r = Nexus.inspectImport(bad);
  assert.equal(r.ok, false); assert.ok(r.errors[0].includes('début'));
});
test('inspectImport : ancien format accepté avec avertissement', () => {
  const r = Nexus.inspectImport(structuredClone(v1Json));
  assert.equal(r.ok, true); assert.ok(r.warnings[0].includes('Ancien format')); assert.equal(r.summary.sessions, 45);
});
test('normalize : données partielles / corrompues ne lèvent jamais', () => {
  for (const raw of [null, {}, { sessions: [null, {}, { start: 5 }] }, { teachers: 'x', rooms: 3 }, { settings: { dayStart: 'zz', slotMinutes: 7, normalSimultaneous: -1 } }]) {
    const d = Nexus.normalize(raw);
    assert.ok(Array.isArray(d.sessions)); assert.equal(d.settings.slotMinutes, 15); assert.ok(d.settings.normalSimultaneous >= 1);
    Nexus.validate(d);
  }
});

/* ---------- exports ---------- */
test('export JSON réimportable et identique', () => {
  const d = fresh();
  const again = Nexus.normalize(JSON.parse(Nexus.toExportJson(d)));
  assert.deepEqual(again.sessions, d.sessions);
  assert.deepEqual(again.teachers, d.teachers);
});
test('CSV : BOM, séparateur ;, 45 lignes + entête, échappement', () => {
  const d = fresh(); d.sessions[0].notes = 'Note ; avec "guillemets"';
  const csv = Nexus.toCsv(d);
  assert.ok(csv.startsWith('﻿Jour;Début;Fin'));
  assert.equal(csv.trim().split('\r\n').length, 46);
  assert.ok(csv.includes('"Note ; avec ""guillemets"""'));
});

/* ---------- suggestions, stats, échange ---------- */
test('findFreeSlots : respecte enseignant, groupe, salles normales', () => {
  const d = fresh();
  const s = d.sessions.find((x) => x.id === 'SAT-0900-T-MA');
  const slots = Nexus.findFreeSlots(d, s, { limit: 50 });
  assert.ok(slots.length > 0);
  for (const sl of slots) {
    assert.ok(!['room-3'].includes(sl.roomId));
    const cand = { day: sl.day, start: sl.start, end: sl.end };
    assert.ok(!d.sessions.some((o) => o.active && o.id !== s.id && Nexus.overlaps(o, cand) && (o.teacherId === s.teacherId || o.groupId === s.groupId || o.roomId === sl.roomId)));
  }
});
test('teacherStats : M1 = 18 h, 9 séances, 3 jours', () => {
  const st = Nexus.teacherStats(fresh(), 'teacher-m1');
  assert.equal(st.minutes, 1080); assert.equal(st.sessions, 9); assert.equal(st.days.length, 3);
});
test('échange de créneaux : jour/heure/salle permutés, matière/enseignant conservés', () => {
  const d = fresh();
  const a = d.sessions.find((x) => x.id === 'SAT-1115-P1-SVT'), b = d.sessions.find((x) => x.id === 'SAT-1445-P1-SES');
  const before = [a.day, a.start, a.end, a.roomId, b.day, b.start, b.end, b.roomId];
  const tmp = { day: a.day, start: a.start, end: a.end, roomId: a.roomId };
  Object.assign(a, { day: b.day, start: b.start, end: b.end, roomId: b.roomId }); Object.assign(b, tmp);
  assert.deepEqual([b.day, b.start, b.end, b.roomId, a.day, a.start, a.end, a.roomId], before);
  assert.equal(a.subjectId, 'SVT'); assert.equal(a.teacherId, 'teacher-svt');
  assert.equal(Nexus.validate(d).counts.error, 0);
});
test('historique : undo / redo / limite', () => {
  const hist = Nexus.createHistory(3);
  let state = { n: 0 };
  for (let i = 1; i <= 5; i++) { hist.push(state, 'op' + i); state = { n: i }; }
  assert.equal(hist.size(), 3);
  const u = hist.undo(state); assert.equal(u.data.n, 4); assert.equal(u.label, 'op5');
  const r = hist.redo(u.data); assert.equal(r.data.n, 5);
  assert.equal(hist.canRedo(), false);
});

console.log('\n' + passed + ' réussis, ' + failed + ' échoués');
process.exit(failed ? 1 : 0);
