#!/usr/bin/env node
/**
 * Recherche de faisabilité — existe-t-il un meilleur planning ?
 *
 *   npm run planning:optimize-check [planning.json]
 *
 * Une attente longue ne doit pas devenir une exception acceptée simplement
 * parce qu'elle existe. Ce script explore un espace de permutations BORNÉ et
 * répond à une seule question : dans cet espace, une amélioration existe-t-elle
 * sans dégrader une contrainte plus prioritaire ?
 *
 * ESPACE EXPLORÉ (et rien d'autre) :
 *   - permutation du créneau (jour + heures) entre deux séances actives ;
 *   - permutation de salle entre deux séances actives ;
 *   - les créneaux et les salles restent ceux déjà définis.
 * Aucune disponibilité enseignant n'est inventée : toute solution candidate est
 * revalidée par le moteur, qui refuse TEACHER_UNAVAILABLE comme les conflits.
 *
 * FONCTION OBJECTIF — priorités lexicographiques strictes :
 *   1..6  faisabilité (conflits, couverture, politique salles, capacité,
 *         politique enseignants, chevauchement des combinaisons de spécialités)
 *   7     nombre de jours de déplacement élève
 *   8     attente maximale
 *   9     somme des attentes
 *   10    fins tardives
 *   11    utilisation de la salle exceptionnelle
 * Le point 8 n'est jamais amélioré au prix de 1–6 : une solution infaisable est
 * rejetée avant toute comparaison de confort.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tool = path.join(repoRoot, 'tools', 'planning-studio');

const ctx = { console };
vm.createContext(ctx);
for (const m of ['core.js', 'model.js', 'validation.js']) {
  vm.runInContext(fs.readFileSync(path.join(tool, 'assets', m), 'utf8'), ctx, { filename: m });
}
const Nexus = ctx.Nexus;
const POLICY = Nexus.POLICY;

const sourcePath = process.argv[2] || path.join(tool, 'data', 'planning.default.json');
const base = Nexus.normalize(JSON.parse(fs.readFileSync(sourcePath, 'utf8')));

const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const SPECIALTIES = POLICY.specialties;

function combinations(items, size) {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [head, ...rest] = items;
  return [...combinations(rest, size - 1).map((c) => [head, ...c]), ...combinations(rest, size)];
}

/** Attente nette : la pause déjeuner configurée n'est pas une attente subie. */
function netWait(settings, from, to) {
  const lunch = settings.lunchBreak;
  if (!lunch) return to - from;
  const ls = toMinutes(lunch.start), le = toMinutes(lunch.end);
  return (to - from) - Math.max(0, Math.min(to, le) - Math.max(from, ls));
}

/** Métriques de confort, mesurées sur des PARCOURS et non sur les groupes. */
function pathwayMetrics(data) {
  const active = data.sessions.filter((s) => s.active);
  let maxWait = 0, totalWait = 0, maxDays = 0, overlaps = 0;

  for (const [level, audience, size] of [
    ['PREMIERE', 'CL', 3], ['TERMINALE', 'CL', 2],
    ['PREMIERE', 'SCO', 3], ['TERMINALE', 'SCO', 2],
  ]) {
    for (const combo of combinations(SPECIALTIES, size)) {
      const options = combo.map((subject) =>
        active.filter((s) => s.level === level && s.audience === audience && s.subjectId === subject));
      if (options.some((o) => o.length === 0)) continue;

      let best = null;
      const assignments = options.reduce((acc, list) => acc.flatMap((p) => list.map((s) => [...p, s])), [[]]);
      for (const choice of assignments) {
        let conflicts = 0;
        for (let i = 0; i < choice.length; i++) {
          for (let j = i + 1; j < choice.length; j++) {
            const a = choice[i], b = choice[j];
            if (a.day === b.day && toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end)) conflicts++;
          }
        }
        const byDay = new Map();
        for (const s of choice) {
          if (!byDay.has(s.day)) byDay.set(s.day, []);
          byDay.get(s.day).push(s);
        }
        let mx = 0, sum = 0;
        for (const list of byDay.values()) {
          list.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
          for (let i = 1; i < list.length; i++) {
            const w = netWait(data.settings, toMinutes(list[i - 1].end), toMinutes(list[i].start));
            mx = Math.max(mx, w); sum += w;
          }
        }
        const candidate = { conflicts, mx, sum, days: byDay.size };
        if (!best || candidate.conflicts < best.conflicts
          || (candidate.conflicts === best.conflicts && candidate.mx < best.mx)
          || (candidate.conflicts === best.conflicts && candidate.mx === best.mx && candidate.sum < best.sum)) {
          best = candidate;
        }
      }
      overlaps += best.conflicts;
      maxWait = Math.max(maxWait, best.mx);
      totalWait += best.sum;
      // Pire cas ELEVE, pas une somme sur les 70 parcours : sommer
      // double-compterait et ecraserait tous les autres criteres.
      maxDays = Math.max(maxDays, best.days);
    }
  }
  return { maxWait, totalWait, maxDays, overlaps };
}

/** Vecteur objectif complet. Comparaison lexicographique, plus petit = meilleur. */
function evaluate(data) {
  const result = Nexus.validate(data);
  const errors = result.issues.filter((i) => i.severity === 'error');
  const active = data.sessions.filter((s) => s.active);
  const metrics = pathwayMetrics(data);
  const late = active.filter((s) => toMinutes(s.end) > toMinutes(data.settings.lateThreshold)).length;
  const exceptionalRooms = new Set(data.rooms.filter((r) => r.exceptional).map((r) => r.id));
  const room3 = active.filter((s) => exceptionalRooms.has(s.roomId)).length;
  return {
    feasible: errors.length === 0 && metrics.overlaps === 0,
    vector: [
      errors.length,          // 1-5 : toute erreur bloquante (conflits, couverture, salles, capacité)
      metrics.overlaps,       // 6   : chevauchement des combinaisons de spécialités
      metrics.maxDays,        // 7   : jours de deplacement du parcours le plus disperse
      metrics.maxWait,        // 8   : attente maximale
      metrics.totalWait,      // 9   : somme des attentes
      late,                   // 10  : fins tardives
      room3,                  // 11  : usage de la salle exceptionnelle
    ],
    metrics, errors: errors.length,
  };
}

const better = (a, b) => {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
};

const clone = (d) => JSON.parse(JSON.stringify(d));

/** Voisinage : permutation de créneau, puis permutation de salle. */
function* neighbours(data) {
  const idx = data.sessions.map((s, i) => [s, i]).filter(([s]) => s.active).map(([, i]) => i);
  for (let a = 0; a < idx.length; a++) {
    for (let b = a + 1; b < idx.length; b++) {
      const i = idx[a], j = idx[b];
      const A = data.sessions[i], B = data.sessions[j];
      if (A.day !== B.day || A.start !== B.start) {
        const next = clone(data);
        const x = next.sessions[i], y = next.sessions[j];
        [x.day, y.day] = [B.day, A.day];
        [x.start, y.start] = [B.start, A.start];
        [x.end, y.end] = [B.end, A.end];
        yield next;
      }
      if (A.roomId !== B.roomId) {
        const next = clone(data);
        [next.sessions[i].roomId, next.sessions[j].roomId] = [B.roomId, A.roomId];
        yield next;
      }
    }
  }
}

const current = evaluate(base);
let best = { data: base, score: current };
let improved = true, rounds = 0, explored = 0;
const MAX_ROUNDS = 6;

while (improved && rounds < MAX_ROUNDS) {
  improved = false;
  rounds += 1;
  for (const candidate of neighbours(best.data)) {
    explored += 1;
    const score = evaluate(candidate);
    if (!score.feasible) continue;
    if (better(score.vector, best.score.vector)) {
      best = { data: candidate, score };
      improved = true;
      break; // descente : on repart du meilleur voisin trouvé
    }
  }
}

const improvementExists = better(best.score.vector, current.vector);

const report = {
  SOURCE: path.relative(repoRoot, sourcePath) || sourcePath,
  SEARCH_SPACE: 'swap-slot + swap-room, descente bornee',
  SEARCH_ROUNDS: rounds,
  CANDIDATES_EVALUATED: explored,
  CURRENT_FEASIBLE: current.feasible,
  CURRENT_OBJECTIVE_VECTOR: '[' + current.vector.join(', ') + ']',
  BEST_OBJECTIVE_VECTOR: '[' + best.score.vector.join(', ') + ']',
  OBJECTIVE_ORDER: 'errors, overlaps, maxDays, maxWait, totalWait, late, exceptionalRoom',
  CURRENT_MAX_DAYS: current.metrics.maxDays,
  BEST_FEASIBLE_MAX_DAYS: best.score.metrics.maxDays,
  CURRENT_MAX_WAIT: current.metrics.maxWait,
  CURRENT_TOTAL_WAIT: current.metrics.totalWait,
  CURRENT_PATHWAY_OVERLAPS: current.metrics.overlaps,
  BEST_FEASIBLE_MAX_WAIT: best.score.metrics.maxWait,
  BEST_FEASIBLE_TOTAL_WAIT: best.score.metrics.totalWait,
  IMPROVEMENT_EXISTS: improvementExists,
  NO_PARETO_IMPROVEMENT_FOUND: !improvementExists,
};
for (const [k, v] of Object.entries(report)) console.log(`${k}=${v}`);

if (improvementExists) {
  console.log('\nPROPOSITION (diff de creneaux, NON appliquee) :');
  for (let i = 0; i < base.sessions.length; i++) {
    const a = base.sessions[i], b = best.data.sessions[i];
    if (a.day !== b.day || a.start !== b.start || a.roomId !== b.roomId) {
      console.log(`  ${a.id} : ${a.day} ${a.start}-${a.end} salle ${a.roomId}  ->  ${b.day} ${b.start}-${b.end} salle ${b.roomId}`);
    }
  }
  console.log('\nLes horaires deja communiques aux familles peuvent constituer une');
  console.log('contrainte operationnelle exterieure au moteur : cette proposition');
  console.log('est un constat de faisabilite, pas une decision.');
} else {
  console.log('\nAucune amelioration trouvee dans l\'espace explore.');
  console.log('Portee : permutations de creneaux et de salles entre seances actives,');
  console.log('descente bornee a ' + MAX_ROUNDS + ' tours. Ce n\'est PAS une preuve');
  console.log('d\'optimalite mathematique globale.');
}
