/* =====================================================================
   NEXUS PLANNING STUDIO — model.js
   Modèle de données (schéma v2), normalisation, migration v1 → v2,
   contrôle structurel des imports, libellés, exports JSON / CSV,
   suggestions de créneaux.
   Aucune dépendance au DOM.
   ===================================================================== */
(function (global) {
  'use strict';
  const Nexus = global.Nexus;
  const { DAYS, LEVELS, AUDIENCES, parseTime, isValidTime, isValidHex, uid, slugify, deepClone, todayIso,
    levelLabel, levelShort, audienceLabel, dayLabel, fmtRange, minutesToTime, TEACHER_PALETTE, compareBy, DAY_INDEX } = Nexus;

  const SCHEMA_VERSION = 2;
  const STORAGE_KEY = 'nexus-planning-studio:v2';

  const DEFAULT_SETTINGS = {
    academicYear: '2026-2027',
    title: 'Planning Nexus Réussite 2026-2027',
    dayStart: '08:00',
    dayEnd: '22:00',
    slotMinutes: 15,
    normalSimultaneous: 2,
    maxSimultaneous: 3,
    lateThreshold: '21:30',
    lunchBreak: { start: '13:15', end: '14:45' },
    waitLightMinutes: 45,
    waitStrongMinutes: 90,
    amplitudeWarnMinutes: 600,
    suggestedSlots: [
      { start: '09:00', end: '11:00' },
      { start: '11:15', end: '13:15' },
      { start: '14:45', end: '16:45' },
      { start: '17:00', end: '19:00' },
      { start: '19:15', end: '21:15' }
    ]
  };

  /* ---------------------------------------------------------------
     Normalisation de chaque entité (valeurs par défaut, types sûrs)
     --------------------------------------------------------------- */
  function str(v, fallback) {
    if (v === null || v === undefined) return fallback === undefined ? '' : fallback;
    return String(v);
  }
  function bool(v, fallback) {
    if (v === null || v === undefined) return fallback === undefined ? true : fallback;
    return Boolean(v);
  }
  function num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  function arr(v) {
    return Array.isArray(v) ? v : [];
  }

  function normalizeTeacher(t, i) {
    t = t || {};
    const code = str(t.code || t.id, 'ENS' + (i + 1)).trim();
    return {
      id: str(t.id, 'teacher-' + slugify(code)),
      code: code,
      name: str(t.name, code).trim() || code,
      subjects: arr(t.subjects).map((s) => str(s)).filter(Boolean),
      color: isValidHex(t.color) ? t.color : TEACHER_PALETTE[i % TEACHER_PALETTE.length],
      active: bool(t.active, true),
      unavailability: arr(t.unavailability)
        .map((u) => ({ day: str(u && u.day), start: str(u && u.start), end: str(u && u.end), note: str(u && u.note) }))
        .filter((u) => DAY_INDEX[u.day] !== undefined && isValidTime(u.start) && isValidTime(u.end)),
      notes: str(t.notes)
    };
  }

  function normalizeRoom(r, i) {
    r = r || {};
    return {
      id: str(r.id, 'room-' + (i + 1)),
      name: str(r.name, 'Salle ' + (i + 1)).trim() || 'Salle ' + (i + 1),
      capacity: Math.max(0, Math.round(num(r.capacity, 6))),
      exceptional: bool(r.exceptional, false),
      active: bool(r.active, true),
      notes: str(r.notes)
    };
  }

  function normalizeSubject(s, i) {
    s = s || {};
    const id = str(s.id, 'subject-' + (i + 1));
    return {
      id: id,
      label: str(s.label || s.name, id).trim() || id,
      short: str(s.short, '').trim() || str(s.label || s.name, id).slice(0, 10),
      color: isValidHex(s.color) ? s.color : '#64748B',
      levels: arr(s.levels).map((l) => str(l)).filter((l) => LEVELS.some((x) => x.id === l)),
      active: bool(s.active, true)
    };
  }

  function normalizeGroup(g, i) {
    g = g || {};
    const id = str(g.id, 'group-' + (i + 1));
    return {
      id: id,
      label: str(g.label, id).trim() || id,
      level: LEVELS.some((l) => l.id === g.level) ? g.level : (LEVELS[0].id),
      audience: AUDIENCES.some((a) => a.id === g.audience) ? g.audience : 'SCO',
      variant: g.variant === 'A' || g.variant === 'B' ? g.variant : null,
      notes: str(g.notes)
    };
  }

  function normalizeSession(s, i) {
    s = s || {};
    return {
      id: str(s.id, uid('session')),
      day: str(s.day, 'MON'),
      start: str(s.start || s.startTime, ''),
      end: str(s.end || s.endTime, ''),
      audience: str(s.audience, 'SCO'),
      level: str(s.level || s.gradeLevel, 'PREMIERE'),
      subjectId: str(s.subjectId !== undefined ? s.subjectId : s.subject, ''),
      groupId: str(s.groupId !== undefined ? s.groupId : s.group, ''),
      teacherId: str(s.teacherId !== undefined ? s.teacherId : s.teacher, ''),
      roomId: str(s.roomId !== undefined ? s.roomId : s.room, ''),
      title: str(s.title).trim(),
      active: bool(s.active, true),
      notes: str(s.notes)
    };
  }

  function normalizeSettings(s) {
    s = s || {};
    const out = deepClone(DEFAULT_SETTINGS);
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      if (s[k] === undefined) continue;
      if (k === 'lunchBreak') {
        if (s[k] && isValidTime(s[k].start) && isValidTime(s[k].end)) out[k] = { start: s[k].start, end: s[k].end };
        else if (s[k] === null) out[k] = null;
      } else if (k === 'suggestedSlots') {
        const slots = arr(s[k]).filter((x) => x && isValidTime(x.start) && isValidTime(x.end));
        if (slots.length) out[k] = slots.map((x) => ({ start: x.start, end: x.end }));
      } else if (typeof DEFAULT_SETTINGS[k] === 'number') {
        out[k] = num(s[k], DEFAULT_SETTINGS[k]);
      } else if (typeof DEFAULT_SETTINGS[k] === 'string') {
        out[k] = str(s[k], DEFAULT_SETTINGS[k]);
      }
    }
    if (!isValidTime(out.dayStart)) out.dayStart = DEFAULT_SETTINGS.dayStart;
    if (!isValidTime(out.dayEnd)) out.dayEnd = DEFAULT_SETTINGS.dayEnd;
    if (parseTime(out.dayEnd) <= parseTime(out.dayStart)) { out.dayStart = DEFAULT_SETTINGS.dayStart; out.dayEnd = DEFAULT_SETTINGS.dayEnd; }
    if (![5, 10, 15, 30, 60].includes(out.slotMinutes)) out.slotMinutes = 15;
    out.normalSimultaneous = Math.max(1, Math.round(out.normalSimultaneous));
    out.maxSimultaneous = Math.max(out.normalSimultaneous, Math.round(out.maxSimultaneous));
    return out;
  }

  /**
   * Construit un état complet et cohérent à partir d'un objet quelconque
   * (v2, v1 ou partiel). Ne lève jamais : les défauts sont réparés.
   */
  function normalize(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    if (isV1(raw)) raw = migrateV1(raw);
    const data = {
      schemaVersion: SCHEMA_VERSION,
      meta: {
        title: str(raw.meta && raw.meta.title, DEFAULT_SETTINGS.title),
        updatedAt: str(raw.meta && raw.meta.updatedAt, todayIso()),
        source: str(raw.meta && raw.meta.source, '')
      },
      settings: normalizeSettings(raw.settings),
      teachers: arr(raw.teachers).map(normalizeTeacher),
      rooms: arr(raw.rooms).map(normalizeRoom),
      subjects: arr(raw.subjects).map(normalizeSubject),
      groups: arr(raw.groups).map(normalizeGroup),
      sessions: arr(raw.sessions).map(normalizeSession)
    };
    // Groupes implicites : toute séance référençant un groupe inconnu crée le groupe
    const knownGroups = new Set(data.groups.map((g) => g.id));
    data.sessions.forEach((s) => {
      if (s.groupId && !knownGroups.has(s.groupId)) {
        data.groups.push(normalizeGroup({ id: s.groupId, label: s.groupId, level: s.level, audience: s.audience }, data.groups.length));
        knownGroups.add(s.groupId);
      }
    });
    dedupeIds(data.teachers, 'teacher');
    dedupeIds(data.rooms, 'room');
    dedupeIds(data.subjects, 'subject');
    dedupeIds(data.groups, 'group');
    dedupeIds(data.sessions, 'session');
    return data;
  }

  function dedupeIds(list, prefix) {
    const seen = new Set();
    list.forEach((item) => {
      let id = item.id;
      if (!id || seen.has(id)) {
        let n = 2;
        const base = id || prefix;
        id = base + '-' + n;
        while (seen.has(id)) { n += 1; id = base + '-' + n; }
        item.id = id;
      }
      seen.add(id);
    });
  }

  /* ---------------------------------------------------------------
     Migration v1 (prototype : teacher/room/subject/group en clé courte)
     --------------------------------------------------------------- */
  function isV1(raw) {
    if (!raw || typeof raw !== 'object') return false;
    if (raw.schemaVersion >= 2) return false;
    const sessions = arr(raw.sessions);
    return sessions.some((s) => s && (s.teacher !== undefined || s.room !== undefined || s.subject !== undefined)) ||
      (raw.meta && typeof raw.meta.version === 'string' && raw.meta.version.startsWith('1'));
  }

  const V1_GROUP_LABELS = {
    '4E-SCO': { label: 'Scolarisés', level: 'QUATRIEME', audience: 'SCO', variant: null },
    '3E-SCO': { label: 'Scolarisés', level: 'TROISIEME', audience: 'SCO', variant: null },
    '2DE-SCO': { label: 'Scolarisés', level: 'SECONDE', audience: 'SCO', variant: null },
    'P1-SCO': { label: 'Scolarisés', level: 'PREMIERE', audience: 'SCO', variant: null },
    'P1-SCO-A': { label: 'Maths A', level: 'PREMIERE', audience: 'SCO', variant: 'A' },
    'P1-SCO-B': { label: 'Maths B', level: 'PREMIERE', audience: 'SCO', variant: 'B' },
    'T-SCO': { label: 'Scolarisés', level: 'TERMINALE', audience: 'SCO', variant: null },
    'T-SCO-A': { label: 'Maths A', level: 'TERMINALE', audience: 'SCO', variant: 'A' },
    'T-SCO-B': { label: 'Maths B', level: 'TERMINALE', audience: 'SCO', variant: 'B' },
    'P1-CL': { label: 'Candidats individuels', level: 'PREMIERE', audience: 'CL', variant: null },
    'T-CL': { label: 'Candidats individuels', level: 'TERMINALE', audience: 'CL', variant: null }
  };

  function migrateV1(raw) {
    const teacherIdMap = {};
    const teachers = arr(raw.teachers).map((t, i) => {
      const code = str(t.id, 'ENS' + (i + 1));
      const id = 'teacher-' + slugify(code);
      teacherIdMap[code] = id;
      return { id: id, code: code, name: t.name, subjects: t.subjects, active: t.active, color: t.color, notes: t.notes };
    });
    const roomIdMap = {};
    const rooms = arr(raw.rooms).map((r, i) => {
      const old = str(r.id, 'S' + (i + 1));
      const m = /^S(\d+)$/i.exec(old);
      const id = 'room-' + (m ? m[1] : slugify(old));
      roomIdMap[old] = id;
      return { id: id, name: r.name, capacity: r.capacity, exceptional: r.exceptional, active: r.active, notes: r.notes };
    });
    const subjects = arr(raw.subjects).map((s) => ({ id: s.id, label: s.label, short: s.short, color: s.color, active: true }));
    const groupsMap = {};
    const sessions = arr(raw.sessions).map((s) => {
      const groupId = str(s.group, '');
      if (groupId && !groupsMap[groupId]) {
        const known = V1_GROUP_LABELS[groupId];
        groupsMap[groupId] = known
          ? Object.assign({ id: groupId }, known)
          : { id: groupId, label: groupId, level: s.level, audience: s.audience, variant: /-A$/.test(groupId) ? 'A' : /-B$/.test(groupId) ? 'B' : null };
      }
      return {
        id: s.id, day: s.day, start: s.start, end: s.end, audience: s.audience, level: s.level,
        subjectId: s.subject, groupId: groupId,
        teacherId: teacherIdMap[s.teacher] || s.teacher || '',
        roomId: roomIdMap[s.room] || s.room || '',
        title: s.title, active: s.active, notes: s.notes
      };
    });
    return {
      schemaVersion: SCHEMA_VERSION,
      meta: { title: raw.meta && raw.meta.title, updatedAt: raw.meta && raw.meta.updatedAt, source: 'migration-v1' },
      settings: {
        normalSimultaneous: raw.meta && raw.meta.defaultRoomPolicy,
        maxSimultaneous: raw.meta && raw.meta.exceptionalRoomPolicy
      },
      teachers, rooms, subjects, groups: Object.values(groupsMap), sessions
    };
  }

  /* ---------------------------------------------------------------
     Contrôle structurel d'un import (avant normalisation)
     Retourne { ok, errors:[], warnings:[], summary:{} }
     --------------------------------------------------------------- */
  function inspectImport(raw) {
    const errors = [];
    const warnings = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, errors: ['Le fichier ne contient pas un objet JSON de planning.'], warnings, summary: null };
    }
    const v1 = isV1(raw);
    if (v1) warnings.push('Ancien format (prototype v1) détecté : il sera converti automatiquement.');
    if (!Array.isArray(raw.sessions)) errors.push('La liste « sessions » est absente ou invalide.');
    if (!Array.isArray(raw.teachers)) errors.push('La liste « teachers » (enseignants) est absente ou invalide.');
    if (!Array.isArray(raw.rooms)) errors.push('La liste « rooms » (salles) est absente ou invalide.');
    if (!Array.isArray(raw.subjects)) errors.push('La liste « subjects » (matières) est absente ou invalide.');
    if (raw.schemaVersion && raw.schemaVersion > SCHEMA_VERSION) {
      warnings.push('Le fichier provient d\'une version plus récente (schéma ' + raw.schemaVersion + ') : certains champs pourraient être ignorés.');
    }
    if (errors.length) return { ok: false, errors, warnings, summary: null };

    const sessions = raw.sessions;
    let bad = 0;
    sessions.forEach((s, i) => {
      if (!s || typeof s !== 'object') { bad += 1; return; }
      const problems = [];
      if (DAY_INDEX[s.day] === undefined) problems.push('jour « ' + s.day + ' » inconnu');
      if (!isValidTime(s.start || s.startTime)) problems.push('heure de début invalide');
      if (!isValidTime(s.end || s.endTime)) problems.push('heure de fin invalide');
      if (problems.length) { bad += 1; if (errors.length < 8) errors.push('Séance n°' + (i + 1) + (s.id ? ' (' + s.id + ')' : '') + ' : ' + problems.join(', ') + '.'); }
    });
    if (bad > 8) errors.push('… et ' + (bad - 8) + ' autre(s) séance(s) invalide(s).');
    const summary = {
      sessions: sessions.length,
      teachers: raw.teachers.length,
      rooms: raw.rooms.length,
      subjects: raw.subjects.length,
      groups: Array.isArray(raw.groups) ? raw.groups.length : 0,
      title: raw.meta && raw.meta.title ? String(raw.meta.title) : '',
      updatedAt: raw.meta && raw.meta.updatedAt ? String(raw.meta.updatedAt) : '',
      v1: v1
    };
    return { ok: errors.length === 0, errors, warnings, summary };
  }

  /* ---------------------------------------------------------------
     Index et libellés
     --------------------------------------------------------------- */
  function indexBy(list) {
    const map = new Map();
    list.forEach((x) => map.set(x.id, x));
    return map;
  }

  function buildIndex(data) {
    return {
      teachers: indexBy(data.teachers),
      rooms: indexBy(data.rooms),
      subjects: indexBy(data.subjects),
      groups: indexBy(data.groups),
      sessions: indexBy(data.sessions)
    };
  }

  function teacherName(data, id) {
    const t = data.teachers.find((x) => x.id === id);
    return t ? t.name : (id ? 'Enseignant inconnu' : 'Sans enseignant');
  }
  function roomName(data, id) {
    const r = data.rooms.find((x) => x.id === id);
    return r ? r.name : (id ? 'Salle inconnue' : 'Sans salle');
  }
  function subjectLabel(data, id) {
    const s = data.subjects.find((x) => x.id === id);
    return s ? s.label : (id ? 'Matière inconnue' : 'Sans matière');
  }
  function subjectShort(data, id) {
    const s = data.subjects.find((x) => x.id === id);
    return s ? s.short : (id ? '?' : '—');
  }
  function groupName(data, id) {
    const g = data.groups.find((x) => x.id === id);
    if (!g) return id ? 'Groupe inconnu' : 'Sans groupe';
    return levelLabel(g.level) + ' · ' + g.label;
  }

  /** Libellé lisible d'une séance pour les messages et listes. */
  function sessionLabel(data, s) {
    if (!s) return '—';
    const parts = [levelLabel(s.level), subjectLabel(data, s.subjectId)];
    const g = data.groups.find((x) => x.id === s.groupId);
    if (g && g.variant) parts.push('Maths ' + g.variant);
    if (s.audience === 'CL') parts.push('(CL)');
    return parts.join(' ');
  }
  function sessionWhen(s) {
    return dayLabel(s.day) + ' ' + fmtRange(s.start, s.end);
  }
  function sessionMinutes(s) {
    const a = parseTime(s.start), b = parseTime(s.end);
    if (a === null || b === null || b <= a) return 0;
    return b - a;
  }
  function overlaps(a, b) {
    if (a.day !== b.day) return false;
    const a1 = parseTime(a.start), a2 = parseTime(a.end), b1 = parseTime(b.start), b2 = parseTime(b.end);
    if (a1 === null || a2 === null || b1 === null || b2 === null) return false;
    return a1 < b2 && b1 < a2;
  }

  function sortSessions(list) {
    return list.slice().sort(compareBy((s) => DAY_INDEX[s.day] ?? 99, (s) => parseTime(s.start) ?? 9999, (s) => s.roomId, (s) => s.id));
  }

  /* ---------------------------------------------------------------
     Statistiques
     --------------------------------------------------------------- */
  function teacherStats(data, teacherId) {
    const sessions = data.sessions.filter((s) => s.active && s.teacherId === teacherId);
    const minutes = sessions.reduce((acc, s) => acc + sessionMinutes(s), 0);
    const days = DAYS.filter((d) => sessions.some((s) => s.day === d.id)).map((d) => d.label);
    const subjects = Array.from(new Set(sessions.map((s) => s.subjectId))).map((id) => subjectShort(data, id));
    // fragmentation : temps morts entre séances d'une même journée
    let idle = 0;
    DAYS.forEach((d) => {
      const list = sortSessions(sessions.filter((s) => s.day === d.id));
      for (let i = 1; i < list.length; i++) {
        const gap = parseTime(list[i].start) - parseTime(list[i - 1].end);
        if (gap > 0) idle += gap;
      }
    });
    return { sessions: sessions.length, minutes, days, subjects, idleMinutes: idle };
  }

  function roomStats(data, roomId) {
    const sessions = data.sessions.filter((s) => s.active && s.roomId === roomId);
    const minutes = sessions.reduce((acc, s) => acc + sessionMinutes(s), 0);
    const openMinutes = (parseTime(data.settings.dayEnd) - parseTime(data.settings.dayStart)) * 7;
    return { sessions: sessions.length, minutes, rate: openMinutes > 0 ? minutes / openMinutes : 0 };
  }

  function globalStats(data) {
    const active = data.sessions.filter((s) => s.active);
    return {
      sessions: active.length,
      inactive: data.sessions.length - active.length,
      minutes: active.reduce((acc, s) => acc + sessionMinutes(s), 0),
      teachers: new Set(active.map((s) => s.teacherId).filter(Boolean)).size,
      rooms: new Set(active.map((s) => s.roomId).filter(Boolean)).size,
      groups: new Set(active.map((s) => s.groupId).filter(Boolean)).size
    };
  }

  /* ---------------------------------------------------------------
     Suggestions de créneaux disponibles pour une séance
     --------------------------------------------------------------- */
  function findFreeSlots(data, session, options) {
    options = options || {};
    const duration = sessionMinutes(session) || 120;
    const others = data.sessions.filter((s) => s.active && s.id !== session.id);
    const rooms = data.rooms.filter((r) => r.active && (options.includeExceptional || !r.exceptional));
    const teacher = data.teachers.find((t) => t.id === session.teacherId);
    const out = [];
    const slots = data.settings.suggestedSlots || [];
    DAYS.forEach((d) => {
      slots.forEach((sl) => {
        const start = parseTime(sl.start);
        const end = start + duration;
        if (end > parseTime(data.settings.dayEnd)) return;
        const cand = { day: d.id, start: minutesToTime(start), end: minutesToTime(end) };
        const sameTime = others.filter((o) => overlaps(o, cand));
        if (sameTime.length >= data.settings.normalSimultaneous) return; // centre saturé
        if (session.teacherId && sameTime.some((o) => o.teacherId === session.teacherId)) return;
        if (session.groupId && sameTime.some((o) => o.groupId === session.groupId)) return;
        if (teacher && teacher.unavailability.some((u) => u.day === d.id && overlaps({ day: d.id, start: u.start, end: u.end }, cand))) return;
        const freeRooms = rooms.filter((r) => !sameTime.some((o) => o.roomId === r.id));
        if (!freeRooms.length) return;
        const preferred = freeRooms.find((r) => r.id === session.roomId) || freeRooms[0];
        out.push({ day: d.id, start: cand.start, end: cand.end, roomId: preferred.id, roomName: preferred.name, sameDayAsNow: d.id === session.day });
      });
    });
    return out.slice(0, options.limit || 12);
  }

  /* ---------------------------------------------------------------
     Exports
     --------------------------------------------------------------- */
  function toExportJson(data) {
    const out = deepClone(data);
    out.schemaVersion = SCHEMA_VERSION;
    out.meta.updatedAt = todayIso();
    out.meta.exportedAt = new Date().toISOString();
    out.meta.generator = 'Nexus Planning Studio';
    return JSON.stringify(out, null, 2);
  }

  function csvEscape(v) {
    const s = String(v === null || v === undefined ? '' : v);
    if (/[";\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function toCsv(data) {
    const head = ['Jour', 'Début', 'Fin', 'Durée (min)', 'Public', 'Niveau', 'Groupe', 'Matière', 'Enseignant', 'Code enseignant', 'Salle', 'Statut', 'Intitulé', 'Notes'];
    const rows = sortSessions(data.sessions).map((s) => {
      const t = data.teachers.find((x) => x.id === s.teacherId);
      const g = data.groups.find((x) => x.id === s.groupId);
      return [
        dayLabel(s.day), s.start, s.end, sessionMinutes(s), audienceLabel(s.audience), levelLabel(s.level),
        g ? g.label : s.groupId, subjectLabel(data, s.subjectId), t ? t.name : '', t ? t.code : '',
        roomName(data, s.roomId), s.active ? 'Active' : 'Inactive', s.title, s.notes
      ].map(csvEscape).join(';');
    });
    return '\uFEFF' + head.join(';') + '\r\n' + rows.join('\r\n') + '\r\n';
  }

  function exportFileName(ext) {
    return 'nexus-planning-2026-2027-' + todayIso() + '.' + ext;
  }

  /* ---------------------------------------------------------------
     Fabrique d'entités
     --------------------------------------------------------------- */
  function newSession(data, partial) {
    const firstActive = (list) => (list.find((x) => x.active !== false) || list[0] || {}).id || '';
    return normalizeSession(Object.assign({
      id: uid('session'),
      day: 'SAT',
      start: '09:00',
      end: '11:00',
      audience: 'SCO',
      level: 'PREMIERE',
      subjectId: firstActive(data.subjects),
      groupId: '',
      teacherId: '',
      roomId: firstActive(data.rooms.filter((r) => !r.exceptional)) || firstActive(data.rooms),
      title: '',
      active: true,
      notes: ''
    }, partial || {}));
  }

  function newTeacher(data, partial) {
    return normalizeTeacher(Object.assign({ id: uid('teacher'), code: 'ENS' + (data.teachers.length + 1), name: 'Nouvel enseignant', subjects: [], active: true }, partial || {}), data.teachers.length);
  }
  function newRoom(data, partial) {
    return normalizeRoom(Object.assign({ id: uid('room'), name: 'Salle ' + (data.rooms.length + 1), capacity: 6, exceptional: false, active: true }, partial || {}), data.rooms.length);
  }
  function newSubject(data, partial) {
    const label = (partial && partial.label) || 'Nouvelle matière';
    return normalizeSubject(Object.assign({ id: 'subject-' + slugify(label) + '-' + (data.subjects.length + 1), label: label, short: label.slice(0, 8), color: '#64748B', active: true }, partial || {}), data.subjects.length);
  }
  function newGroup(data, partial) {
    return normalizeGroup(Object.assign({ id: uid('group'), label: 'Nouveau groupe', level: 'PREMIERE', audience: 'SCO', variant: null }, partial || {}), data.groups.length);
  }

  Object.assign(Nexus, {
    SCHEMA_VERSION, STORAGE_KEY, DEFAULT_SETTINGS,
    normalize, isV1, migrateV1, inspectImport, buildIndex,
    teacherName, roomName, subjectLabel, subjectShort, groupName, sessionLabel, sessionWhen, sessionMinutes, overlaps, sortSessions,
    teacherStats, roomStats, globalStats, findFreeSlots,
    toExportJson, toCsv, exportFileName,
    newSession, newTeacher, newRoom, newSubject, newGroup,
    normalizeSession, normalizeTeacher, normalizeRoom, normalizeSubject, normalizeGroup
  });
})(typeof window !== 'undefined' ? window : globalThis);
