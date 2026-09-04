/* =====================================================================
   NEXUS PLANNING STUDIO — validation.js
   Moteur de diagnostic centralisé.
   Entrée : état normalisé. Sortie : liste d'anomalies classées
   (error / warning / info) + index par séance.
   Aucune dépendance au DOM.
   ===================================================================== */
(function (global) {
  'use strict';
  const Nexus = global.Nexus;
  const { DAYS, LEVELS, DAY_INDEX, SEVERITY, SEVERITY_ORDER, parseTime, isValidTime, fmtRange, fmtTime, fmtDuration,
    dayLabel, levelLabel, sessionLabel, sessionWhen, sessionMinutes, overlaps, sortSessions } = Nexus;

  /**
   * Codes de règles (documentés dans docs/AUDIT_AND_CHANGELOG.md) :
   * C1 TEACHER_OVERLAP      C2 ROOM_OVERLAP        C3 GROUP_OVERLAP
   * C4 CENTER_CAPACITY      C5 INVALID_TIME        C6 TEACHER_SKILL
   * C7 TEACHER_UNAVAILABLE  C8 PEDAGOGY            C9 DATA_INTEGRITY
   * S* règles de confort (attente, amplitude, tardif)
   */
  function validate(data) {
    const issues = [];
    const push = (severity, code, title, message, sessionIds, extra) => {
      issues.push(Object.assign({
        id: code + ':' + (sessionIds || []).slice().sort().join('+') + ':' + issues.length,
        severity, code, title, message, sessionIds: sessionIds || []
      }, extra || {}));
    };

    const teachers = new Map(data.teachers.map((t) => [t.id, t]));
    const rooms = new Map(data.rooms.map((r) => [r.id, r]));
    const subjects = new Map(data.subjects.map((s) => [s.id, s]));
    const groups = new Map(data.groups.map((g) => [g.id, g]));
    const settings = data.settings;

    /* ---------- C9 : intégrité des données ---------- */
    const seenIds = new Set();
    data.sessions.forEach((s) => {
      if (seenIds.has(s.id)) push(SEVERITY.ERROR, 'DUPLICATE_ID', 'Identifiant dupliqué', 'Deux séances partagent l\'identifiant « ' + s.id + ' ».', [s.id]);
      seenIds.add(s.id);
    });

    const valid = []; // séances actives et temporellement valides
    data.sessions.forEach((s) => {
      const label = sessionLabel(data, s);
      /* C5 : durée */
      const a = parseTime(s.start), b = parseTime(s.end);
      let timeOk = true;
      if (!isValidTime(s.start) || !isValidTime(s.end)) {
        timeOk = false;
        if (s.active) push(SEVERITY.ERROR, 'INVALID_TIME', 'Horaire invalide', label + ' : heure de début ou de fin manquante ou invalide (' + (s.start || '—') + ' → ' + (s.end || '—') + ').', [s.id]);
      } else if (b <= a) {
        timeOk = false;
        if (s.active) push(SEVERITY.ERROR, 'INVALID_TIME', 'Horaire invalide', label + ' : la fin (' + fmtTime(s.end) + ') doit être postérieure au début (' + fmtTime(s.start) + '). Une séance ne peut pas dépasser minuit.', [s.id]);
      }
      if (!Object.prototype.hasOwnProperty.call(DAY_INDEX, s.day)) {
        timeOk = false;
        if (s.active) push(SEVERITY.ERROR, 'INVALID_DAY', 'Jour invalide', label + ' : le jour « ' + s.day + ' » n\'est pas reconnu.', [s.id]);
      }
      if (!s.active) return;

      /* C9 : références */
      if (!s.teacherId) push(SEVERITY.WARNING, 'NO_TEACHER', 'Enseignant non affecté', label + ' (' + sessionWhen(s) + ') n\'a pas d\'enseignant.', [s.id]);
      else if (!teachers.has(s.teacherId)) push(SEVERITY.ERROR, 'MISSING_TEACHER', 'Enseignant introuvable', label + ' (' + sessionWhen(s) + ') fait référence à un enseignant supprimé.', [s.id]);
      else if (!teachers.get(s.teacherId).active) push(SEVERITY.WARNING, 'INACTIVE_TEACHER', 'Enseignant inactif', label + ' est confiée à ' + teachers.get(s.teacherId).name + ' (enseignant inactif).', [s.id]);

      if (!s.roomId) push(SEVERITY.WARNING, 'NO_ROOM', 'Salle non affectée', label + ' (' + sessionWhen(s) + ') n\'a pas de salle.', [s.id]);
      else if (!rooms.has(s.roomId)) push(SEVERITY.ERROR, 'MISSING_ROOM', 'Salle introuvable', label + ' (' + sessionWhen(s) + ') fait référence à une salle supprimée.', [s.id]);
      else if (!rooms.get(s.roomId).active) push(SEVERITY.WARNING, 'INACTIVE_ROOM', 'Salle inactive', label + ' est placée dans ' + rooms.get(s.roomId).name + ', marquée inactive.', [s.id]);

      if (!s.subjectId) push(SEVERITY.ERROR, 'NO_SUBJECT', 'Matière manquante', 'Une séance ' + sessionWhen(s) + ' n\'a pas de matière.', [s.id]);
      else if (!subjects.has(s.subjectId)) push(SEVERITY.ERROR, 'MISSING_SUBJECT', 'Matière introuvable', 'Séance ' + sessionWhen(s) + ' : matière supprimée ou inconnue.', [s.id]);
      else if (!subjects.get(s.subjectId).active) push(SEVERITY.WARNING, 'INACTIVE_SUBJECT', 'Matière désactivée', label + ' utilise une matière désactivée.', [s.id]);

      if (!s.groupId) push(SEVERITY.INFO, 'NO_GROUP', 'Groupe non affecté', label + ' (' + sessionWhen(s) + ') n\'est rattachée à aucun groupe : les conflits d\'élèves ne peuvent pas être détectés.', [s.id]);
      else if (!groups.has(s.groupId)) push(SEVERITY.ERROR, 'MISSING_GROUP', 'Groupe introuvable', label + ' fait référence à un groupe supprimé.', [s.id]);
      else {
        const g = groups.get(s.groupId);
        if (g.level !== s.level || g.audience !== s.audience) {
          push(SEVERITY.WARNING, 'GROUP_MISMATCH', 'Groupe incohérent', label + ' (' + sessionWhen(s) + ') est rattachée au groupe « ' + levelLabel(g.level) + ' · ' + g.label + ' » dont le niveau ou le public diffère.', [s.id]);
        }
      }
      if (!LEVELS.some((l) => l.id === s.level)) push(SEVERITY.ERROR, 'INVALID_LEVEL', 'Niveau invalide', 'Séance ' + sessionWhen(s) + ' : niveau « ' + s.level + ' » inconnu.', [s.id]);
      if (s.audience !== 'SCO' && s.audience !== 'CL') push(SEVERITY.ERROR, 'INVALID_AUDIENCE', 'Public invalide', 'Séance ' + sessionWhen(s) + ' : public « ' + s.audience + ' » inconnu.', [s.id]);

      /* C6 : compétences */
      const t = teachers.get(s.teacherId);
      if (t && s.subjectId && subjects.has(s.subjectId) && !t.subjects.includes(s.subjectId)) {
        push(SEVERITY.WARNING, 'TEACHER_SKILL', 'Matière hors compétences', t.name + ' assure ' + label + ' (' + sessionWhen(s) + ') alors que cette matière n\'est pas déclarée dans ses compétences.', [s.id]);
      }

      /* C7 : indisponibilités */
      if (t && timeOk) {
        t.unavailability.forEach((u) => {
          const uStart = parseTime(u.start);
          const uEnd = parseTime(u.end);
          if (uStart === null || uEnd === null || uEnd <= uStart) {
            push(SEVERITY.ERROR, 'INVALID_UNAVAILABILITY', 'Indisponibilité invalide',
              t.name + ' : créneau d\'indisponibilité invalide (' + (u.start || '—') + ' → ' + (u.end || '—') + ').', [s.id]);
            return;
          }
          if (overlaps(s, { day: u.day, start: u.start, end: u.end })) {
            push(SEVERITY.ERROR, 'TEACHER_UNAVAILABLE', 'Enseignant indisponible', t.name + ' a une indisponibilité déclarée ' + dayLabel(u.day) + ' ' + fmtRange(u.start, u.end) + (u.note ? ' (' + u.note + ')' : '') + ', mais assure ' + label + ' ' + fmtRange(s.start, s.end) + '.', [s.id]);
          }
        });
      }

      if (timeOk) valid.push(s);
    });

    /* ---------- C1 / C2 / C3 : chevauchements ---------- */
    const sorted = sortSessions(valid);
    const pairKey = new Set();
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i];
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j];
        if (b.day !== a.day) break;
        if (!overlaps(a, b)) continue;
        const key = a.id + '|' + b.id;
        if (pairKey.has(key)) continue;
        pairKey.add(key);
        const when = dayLabel(a.day) + ' ' + fmtRange(a.start, a.end) + ' / ' + fmtRange(b.start, b.end);
        if (a.teacherId && a.teacherId === b.teacherId && teachers.has(a.teacherId)) {
          push(SEVERITY.ERROR, 'TEACHER_OVERLAP', 'Conflit enseignant',
            teachers.get(a.teacherId).name + ' assure simultanément ' + sessionLabel(data, a) + ' et ' + sessionLabel(data, b) + ' (' + when + ').', [a.id, b.id]);
        }
        if (a.roomId && a.roomId === b.roomId && rooms.has(a.roomId)) {
          push(SEVERITY.ERROR, 'ROOM_OVERLAP', 'Conflit de salle',
            rooms.get(a.roomId).name + ' est occupée deux fois : ' + sessionLabel(data, a) + ' et ' + sessionLabel(data, b) + ' (' + when + ').', [a.id, b.id]);
        }
        if (a.groupId && a.groupId === b.groupId && groups.has(a.groupId)) {
          push(SEVERITY.ERROR, 'GROUP_OVERLAP', 'Conflit de groupe',
            'Le groupe « ' + levelLabel(groups.get(a.groupId).level) + ' · ' + groups.get(a.groupId).label + ' » a deux cours simultanés : ' + sessionLabel(data, a) + ' et ' + sessionLabel(data, b) + ' (' + when + ').', [a.id, b.id]);
        }
      }
    }

    /* ---------- C4 : capacité du centre (cours simultanés) ---------- */
    // Balayage par jour : on découpe en intervalles élémentaires et on compte.
    DAYS.forEach((d) => {
      const list = sorted.filter((s) => s.day === d.id);
      if (list.length < 2) return;
      const points = Array.from(new Set(list.flatMap((s) => [parseTime(s.start), parseTime(s.end)]))).sort((x, y) => x - y);
      const reported = new Set();
      for (let i = 0; i < points.length - 1; i++) {
        const from = points[i], to = points[i + 1];
        const concurrent = list.filter((s) => parseTime(s.start) < to && parseTime(s.end) > from);
        const n = concurrent.length;
        if (n <= settings.normalSimultaneous) continue;
        const key = concurrent.map((s) => s.id).sort().join('+');
        if (reported.has(key)) continue;
        reported.add(key);
        const ids = concurrent.map((s) => s.id);
        const when = dayLabel(d.id) + ' ' + fmtRange(Nexus.minutesToTime(from), Nexus.minutesToTime(to));
        if (n > settings.maxSimultaneous) {
          push(SEVERITY.ERROR, 'CENTER_OVERFLOW', 'Trop de cours simultanés',
            n + ' cours ont lieu en même temps ' + when + ' : le centre ne peut en accueillir que ' + settings.maxSimultaneous + ' au maximum (' + settings.normalSimultaneous + ' en fonctionnement normal).', ids);
        } else {
          push(SEVERITY.WARNING, 'CENTER_EXCEPTIONAL', 'Salle exceptionnelle mobilisée',
            n + ' cours simultanés ' + when + ' : au-delà des ' + settings.normalSimultaneous + ' salles du fonctionnement normal. Ce créneau repose sur une salle exceptionnelle.', ids);
        }
      }
    });

    /* ---------- Salle exceptionnelle utilisée ---------- */
    valid.forEach((s) => {
      const r = rooms.get(s.roomId);
      if (r && r.exceptional) {
        push(SEVERITY.WARNING, 'EXCEPTIONAL_ROOM', 'Salle exceptionnelle utilisée',
          sessionLabel(data, s) + ' (' + sessionWhen(s) + ') est placée dans ' + r.name + ', réservée aux situations exceptionnelles.', [s.id]);
      }
    });

    /* ---------- C8 : règles pédagogiques ---------- */
    valid.forEach((s) => {
      const lvl = LEVELS.find((l) => l.id === s.level);
      if (!lvl) return;
      const label = sessionLabel(data, s);
      if (lvl.cycle === 'COLLEGE' && s.audience === 'SCO') {
        if (s.day !== 'WED') push(SEVERITY.WARNING, 'COLLEGE_DAY', 'Collège hors mercredi', label + ' est placée ' + sessionWhen(s) + ' : les cours de collège ont lieu le mercredi après-midi.', [s.id]);
        else if (parseTime(s.start) < 12 * 60) push(SEVERITY.WARNING, 'COLLEGE_DAY', 'Collège le matin', label + ' commence à ' + fmtTime(s.start) + ' : les cours de collège ont lieu le mercredi après-midi.', [s.id]);
      }
      if (s.level === 'SECONDE' && s.audience === 'SCO' && s.day !== 'WED') {
        push(SEVERITY.WARNING, 'SECONDE_DAY', 'Seconde hors mercredi', label + ' est placée ' + sessionWhen(s) + ' : la Seconde est de préférence le mercredi après-midi.', [s.id]);
      }
      if (parseTime(s.end) > parseTime(settings.lateThreshold)) {
        push(SEVERITY.WARNING, 'LATE_SESSION', 'Cours tardif', label + ' se termine à ' + fmtTime(s.end) + ' (' + dayLabel(s.day) + '), après ' + fmtTime(settings.lateThreshold) + '.', [s.id]);
      }
      if (parseTime(s.end) > parseTime(settings.dayEnd) || parseTime(s.start) < parseTime(settings.dayStart)) {
        push(SEVERITY.WARNING, 'OUTSIDE_HOURS', 'Hors plage d\'ouverture', label + ' (' + sessionWhen(s) + ') sort de la plage ' + fmtRange(settings.dayStart, settings.dayEnd) + ' du centre.', [s.id]);
      }
    });

    /* ---------- Confort : attentes des groupes ---------- */
    const byGroupDay = new Map();
    valid.forEach((s) => {
      if (!s.groupId || !groups.has(s.groupId)) return;
      const key = s.groupId + '|' + s.day;
      if (!byGroupDay.has(key)) byGroupDay.set(key, []);
      byGroupDay.get(key).push(s);
    });
    byGroupDay.forEach((list, key) => {
      const g = groups.get(key.split('|')[0]);
      const ordered = sortSessions(list);
      for (let i = 1; i < ordered.length; i++) {
        const prev = ordered[i - 1], cur = ordered[i];
        const gap = parseTime(cur.start) - parseTime(prev.end);
        if (gap <= 0) continue;
        const gname = levelLabel(g.level) + ' · ' + g.label;
        const msg = 'Le groupe « ' + gname + ' » attend ' + fmtDuration(gap) + ' entre ' + sessionLabel(data, prev) + ' (fin ' + fmtTime(prev.end) + ') et ' + sessionLabel(data, cur) + ' (début ' + fmtTime(cur.start) + ') ' + dayLabel(cur.day) + '.';
        if (gap > settings.waitStrongMinutes) push(SEVERITY.WARNING, 'WAIT_LONG', 'Attente importante', msg, [prev.id, cur.id]);
        else if (gap > settings.waitLightMinutes) push(SEVERITY.INFO, 'WAIT_MEDIUM', 'Attente à surveiller', msg, [prev.id, cur.id]);
      }
      // amplitude de présence du groupe
      if (ordered.length >= 2) {
        const span = parseTime(ordered[ordered.length - 1].end) - parseTime(ordered[0].start);
        if (span > settings.amplitudeWarnMinutes) {
          push(SEVERITY.WARNING, 'GROUP_AMPLITUDE', 'Journée très longue', 'Le groupe « ' + levelLabel(g.level) + ' · ' + g.label + ' » est présent ' + fmtDuration(span) + ' ' + dayLabel(ordered[0].day) + ' (' + fmtRange(ordered[0].start, ordered[ordered.length - 1].end) + ').', ordered.map((s) => s.id));
        }
      }
    });

    /* ---------- Confort : amplitude enseignants ---------- */
    data.teachers.filter((t) => t.active).forEach((t) => {
      DAYS.forEach((d) => {
        const list = sortSessions(valid.filter((s) => s.teacherId === t.id && s.day === d.id));
        if (list.length < 2) return;
        const span = parseTime(list[list.length - 1].end) - parseTime(list[0].start);
        if (span > settings.amplitudeWarnMinutes) {
          push(SEVERITY.WARNING, 'TEACHER_AMPLITUDE', 'Amplitude enseignant élevée', t.name + ' : présence de ' + fmtDuration(span) + ' le ' + dayLabel(d.id).toLowerCase() + ' (' + fmtRange(list[0].start, list[list.length - 1].end) + ').', list.map((s) => s.id));
        }
      });
      if (!valid.some((s) => s.teacherId === t.id)) {
        push(SEVERITY.INFO, 'TEACHER_UNUSED', 'Enseignant sans séance', t.name + ' (' + t.code + ') n\'a aucune séance active cette semaine.', [], { teacherId: t.id });
      }
    });

    /* ---------- Info : séances inactives ---------- */
    const inactive = data.sessions.filter((s) => !s.active);
    if (inactive.length) {
      push(SEVERITY.INFO, 'INACTIVE_SESSIONS', 'Séances désactivées', inactive.length + ' séance(s) désactivée(s) : elles n\'occupent ni salle ni enseignant et n\'apparaissent qu\'avec le filtre « Afficher les inactives ».', inactive.map((s) => s.id));
    }

    /* ---------- Index par séance ---------- */
    const bySession = new Map();
    issues.forEach((iss) => {
      iss.sessionIds.forEach((id) => {
        if (!bySession.has(id)) bySession.set(id, { severity: iss.severity, issues: [] });
        const entry = bySession.get(id);
        entry.issues.push(iss);
        if (SEVERITY_ORDER[iss.severity] < SEVERITY_ORDER[entry.severity]) entry.severity = iss.severity;
      });
    });
    issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.code.localeCompare(b.code));
    const counts = { error: 0, warning: 0, info: 0 };
    issues.forEach((i) => { counts[i.severity] += 1; });
    return { issues, bySession, counts };
  }

  /**
   * Conflits bloquants qu'engendrerait une séance candidate (utilisé
   * pendant le glisser-déposer et l'édition). Retourne une liste courte.
   */
  function previewConflicts(data, candidate) {
    const clone = Object.assign({}, data, {
      sessions: data.sessions.filter((s) => s.id !== candidate.id).concat([Object.assign({}, candidate, { active: true })])
    });
    const result = validate(clone);
    const entry = result.bySession.get(candidate.id);
    if (!entry) return { severity: null, issues: [] };
    return { severity: entry.severity, issues: entry.issues.filter((i) => i.code !== 'INACTIVE_SESSIONS') };
  }

  Object.assign(Nexus, { validate, previewConflicts });
})(typeof window !== 'undefined' ? window : globalThis);
