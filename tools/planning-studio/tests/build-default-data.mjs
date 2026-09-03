// Génère data/planning.default.json (v2) et data/default-data.js à partir du planning v1 original.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { console };
vm.createContext(ctx);
for (const f of ['core.js', 'model.js']) vm.runInContext(fs.readFileSync(path.join(root, 'assets', f), 'utf8'), ctx, { filename: f });
const v1 = JSON.parse(fs.readFileSync(path.join(root, 'data/legacy/planning.v1.original.json'), 'utf8'));
const data = ctx.Nexus.normalize(v1);
data.meta.title = 'Planning Nexus Réussite 2026-2027';
data.meta.updatedAt = '2026-09-03';
data.meta.source = 'planning initial 2026-2027 (v1 migré)';
// Palette Nexus : couleurs distinctes, lisibles en fond teinté et en impression
const palette = {
  MATHS: '#2457C5', NSI: '#5B3FB8', FRANCAIS: '#B3261E', PHILO: '#7A2E6B', PC: '#0E7C9B', SVT: '#2E7D32',
  SES: '#B7791F', HGGSP: '#C2571B', HG_EMC: '#8A5A2B', EAM: '#1F6FB2', LANGUES: '#0F766E', ENS_SCI: '#4D7C0F',
  GRAND_ORAL: '#9F1239', ETUDE: '#64748B'
};
data.subjects.forEach((s) => { if (palette[s.id]) s.color = palette[s.id]; });
const levelsBySubject = {
  MATHS: ['QUATRIEME','TROISIEME','SECONDE','PREMIERE','TERMINALE'], FRANCAIS: ['QUATRIEME','TROISIEME','SECONDE','PREMIERE'],
  NSI: ['PREMIERE','TERMINALE'], PHILO: ['TERMINALE'], PC: ['PREMIERE','TERMINALE'], SVT: ['PREMIERE','TERMINALE'], SES: ['PREMIERE','TERMINALE'],
  HGGSP: ['PREMIERE','TERMINALE'], HG_EMC: ['PREMIERE','TERMINALE'], EAM: ['PREMIERE'], LANGUES: ['PREMIERE','TERMINALE'], ENS_SCI: ['PREMIERE','TERMINALE'],
  GRAND_ORAL: ['TERMINALE'], ETUDE: []
};
data.subjects.forEach((s) => { if (levelsBySubject[s.id]) s.levels = levelsBySubject[s.id]; });
const teacherColors = { 'teacher-m1': '#0B1F3A', 'teacher-m2': '#2457C5', 'teacher-f1': '#B3261E', 'teacher-pc': '#0E7C9B', 'teacher-svt': '#2E7D32', 'teacher-ses': '#B7791F', 'teacher-hg': '#C2571B', 'teacher-lv': '#0F766E', 'teacher-es': '#4D7C0F', 'teacher-etude': '#64748B' };
data.teachers.forEach((t) => { if (teacherColors[t.id]) t.color = teacherColors[t.id]; });
// Notes de groupes Maths A / B
data.groups.forEach((g) => {
  if (g.variant === 'A') g.notes = 'Parcours Maths A : priorité au profil Maths + NSI (enchaînement Maths → NSI).';
  if (g.variant === 'B') g.notes = 'Parcours Maths B : priorité au profil Maths + Physique-Chimie (enchaînement Maths → PC).';
});
const json = JSON.stringify(data, null, 2);
fs.writeFileSync(path.join(root, 'data/planning.default.json'), json + '\n');
fs.writeFileSync(path.join(root, 'data/default-data.js'),
  '/* Données initiales Nexus Réussite 2026-2027 (schéma v2).\n' +
  '   Fichier généré depuis data/planning.default.json — chargé en fallback local (file://).\n' +
  '   Pour modifier le planning initial : éditer le JSON puis relancer `node tests/build-default-data.mjs`. */\n' +
  'window.NEXUS_DEFAULT_PLANNING = ' + json + ';\n');
console.log('sessions', data.sessions.length, 'teachers', data.teachers.length, 'rooms', data.rooms.length, 'subjects', data.subjects.length, 'groups', data.groups.length);
console.log(data.groups.map(g=>g.id+':'+g.level+':'+g.audience+':'+g.variant).join('\n'));
