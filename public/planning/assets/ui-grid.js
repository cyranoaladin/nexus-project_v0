/* =====================================================================
   NEXUS PLANNING STUDIO — ui-grid.js
   Rendu de la grille hebdomadaire (cartes positionnées proportionnellement),
   vue liste, glisser-déposer (souris / stylet, pas 15 min).
   Le DOM est une projection de l'état : aucune donnée métier n'y vit.
   ===================================================================== */
(function (global) {
  'use strict';
  const Nexus = global.Nexus;
  const { h, clear, DAYS, DAY_INDEX, parseTime, minutesToTime, fmtTime, fmtRange, fmtHours, dayLabel, dayShort, levelLabel,
    audienceBadge, audienceLabel, sessionMinutes, sessionLabel, sortSessions, rgba, initials, plural } = Nexus;

  /* ---------------------------------------------------------------
     Agencement : répartition en colonnes des séances qui se chevauchent
     (algorithme classique des agendas). Retourne Map id → {col, cols}
     --------------------------------------------------------------- */
  function packSessions(sessions) {
    const result = new Map();
    const list = sessions.slice().sort((a, b) => parseTime(a.start) - parseTime(b.start) || parseTime(b.end) - parseTime(a.end) || (a.roomId > b.roomId ? 1 : -1));
    let cluster = [];
    let clusterEnd = -1;
    const flush = () => {
      if (!cluster.length) return;
      const laneEnds = [];
      const placed = [];
      cluster.forEach((s) => {
        const st = parseTime(s.start), en = parseTime(s.end);
        let col = laneEnds.findIndex((e) => e <= st);
        if (col === -1) { col = laneEnds.length; laneEnds.push(en); } else laneEnds[col] = en;
        placed.push({ s, col });
      });
      placed.forEach((p) => result.set(p.s.id, { col: p.col, cols: laneEnds.length }));
      cluster = [];
      clusterEnd = -1;
    };
    list.forEach((s) => {
      const st = parseTime(s.start), en = parseTime(s.end);
      if (cluster.length && st >= clusterEnd) flush();
      cluster.push(s);
      clusterEnd = Math.max(clusterEnd, en);
    });
    flush();
    return result;
  }

  function computeRange(settings, sessions) {
    let from = parseTime(settings.dayStart);
    let to = parseTime(settings.dayEnd);
    sessions.forEach((s) => {
      const a = parseTime(s.start), b = parseTime(s.end);
      if (a !== null && a < from) from = a;
      if (b !== null && b > to) to = b;
    });
    from = Math.floor(from / 60) * 60;
    to = Math.ceil(to / 60) * 60;
    return { from, to };
  }

  /* ---------------------------------------------------------------
     Rendu principal
     opts : { data, diagnostics, sessions, days, laneMode, selectedId, swap,
              highlightIds, teacherId, onSelect(id, ev) }
     --------------------------------------------------------------- */
  function render(container, opts) {
    const { data, diagnostics, sessions, days, laneMode, selectedId, swap, highlightIds, teacherId } = opts;
    const settings = data.settings;
    const slot = settings.slotMinutes;
    const range = computeRange(settings, sessions);
    const totalSlots = Math.ceil((range.to - range.from) / slot);
    const rooms = new Map(data.rooms.map((r) => [r.id, r]));
    const teachers = new Map(data.teachers.map((t) => [t.id, t]));
    const subjects = new Map(data.subjects.map((s) => [s.id, s]));
    const groups = new Map(data.groups.map((g) => [g.id, g]));

    // Lanes fixes (vue salles / vue public)
    let lanes = null;
    if (laneMode === 'room') {
      const used = new Set(sessions.map((s) => s.roomId));
      lanes = data.rooms.filter((r) => r.active && (!r.exceptional || used.has(r.id)) || used.has(r.id))
        .map((r) => ({ id: r.id, label: r.name, exceptional: r.exceptional, match: (s) => s.roomId === r.id }));
      if (sessions.some((s) => !rooms.has(s.roomId))) lanes.push({ id: '__none', label: 'Sans salle', exceptional: true, match: (s) => !rooms.has(s.roomId) });
    } else if (laneMode === 'audience') {
      lanes = Nexus.AUDIENCES.map((a) => ({ id: a.id, label: a.label, exceptional: false, match: (s) => s.audience === a.id }));
    }

    const grid = h('div', { class: 'grid', style: { '--days': days.length, '--slots': totalSlots }, dataset: { from: range.from, slot: slot, laneMode: laneMode || 'auto' } });
    grid.appendChild(h('div', { class: 'grid-corner' }));

    // En-têtes de jours
    days.forEach((dayId) => {
      const daySessions = sessions.filter((s) => s.day === dayId);
      const minutes = daySessions.filter((s) => s.active).reduce((acc, s) => acc + sessionMinutes(s), 0);
      const head = h('div', { class: ['grid-dayhead', (dayId === 'SAT' || dayId === 'SUN') && 'weekend'] }, [
        h('div', { class: 'name' }, dayLabel(dayId)),
        h('div', { class: 'meta' }, daySessions.length ? plural(daySessions.length, 'séance') + ' · ' + fmtHours(minutes) : 'Libre')
      ]);
      if (lanes) {
        head.appendChild(h('div', { class: 'grid-lanes' }, lanes.map((l) => h('span', { class: l.exceptional && 'exceptional', title: l.label }, l.label))));
      }
      grid.appendChild(head);
    });

    // Colonne des heures
    const times = h('div', { class: 'grid-times', style: { height: 'calc(var(--slot-h) * ' + totalSlots + ')' } });
    for (let m = range.from; m <= range.to; m += 60) {
      const idx = (m - range.from) / slot;
      times.appendChild(h('span', { class: ['hour', m % 180 === 0 && 'major', m === range.from && 'first', m === range.to && 'last'], style: { top: 'calc(var(--slot-h) * ' + idx + ')' } }, fmtTime(minutesToTime(m))));
    }
    grid.appendChild(times);

    // Colonnes de jours
    const teacher = teacherId ? teachers.get(teacherId) : null;
    days.forEach((dayId) => {
      const col = h('div', {
        class: ['grid-col', (dayId === 'SAT' || dayId === 'SUN') && 'weekend'],
        dataset: { day: dayId, lanes: lanes ? lanes.map((l) => l.id).join(',') : '' },
        style: { height: 'calc(var(--slot-h) * ' + totalSlots + ')' }
      });
      // demi-heures
      for (let m = range.from + 30; m < range.to; m += 60) {
        col.appendChild(h('div', { class: 'halfhour', style: { top: 'calc(var(--slot-h) * ' + ((m - range.from) / slot) + ')' } }));
      }
      // pause déjeuner
      if (settings.lunchBreak) {
        const a = parseTime(settings.lunchBreak.start), b = parseTime(settings.lunchBreak.end);
        if (a !== null && b !== null && b > a && a >= range.from && b <= range.to) {
          col.appendChild(h('div', { class: 'lunch', style: { top: 'calc(var(--slot-h) * ' + ((a - range.from) / slot) + ')', height: 'calc(var(--slot-h) * ' + ((b - a) / slot) + ')' } }));
        }
      }
      // indisponibilités de l'enseignant affiché
      if (teacher) {
        teacher.unavailability.filter((u) => u.day === dayId).forEach((u) => {
          const a = Math.max(parseTime(u.start), range.from), b = Math.min(parseTime(u.end), range.to);
          if (b <= a) return;
          col.appendChild(h('div', { class: 'unavailable', style: { left: '2px', right: '2px', top: 'calc(var(--slot-h) * ' + ((a - range.from) / slot) + ')', height: 'calc(var(--slot-h) * ' + ((b - a) / slot) + ')' }, title: 'Indisponible ' + fmtRange(u.start, u.end) + (u.note ? ' — ' + u.note : '') }));
        });
      }
      // séparateurs de lanes
      if (lanes && lanes.length > 1) {
        for (let i = 1; i < lanes.length; i++) col.appendChild(h('div', { class: 'lane-sep', style: { left: (i / lanes.length * 100) + '%' } }));
      }

      const daySessions = sessions.filter((s) => s.day === dayId && parseTime(s.start) !== null && parseTime(s.end) !== null && parseTime(s.end) > parseTime(s.start));
      const placeCards = (list, laneIdx, laneCount) => {
        const packed = packSessions(list);
        list.forEach((s) => {
          const p = packed.get(s.id) || { col: 0, cols: 1 };
          const laneW = 100 / laneCount;
          const width = laneW / p.cols;
          const left = laneIdx * laneW + p.col * width;
          col.appendChild(buildCard(s, { left, width, range, slot, data, diagnostics, rooms, teachers, subjects, groups, selectedId, swap, highlightIds }));
        });
      };
      if (lanes) {
        lanes.forEach((lane, i) => placeCards(daySessions.filter(lane.match), i, lanes.length));
      } else {
        placeCards(daySessions, 0, 1);
      }
      grid.appendChild(col);
    });

    clear(container);
    if (!sessions.length) {
      container.appendChild(grid);
      container.appendChild(h('div', { class: 'grid-empty' }, 'Aucune séance ne correspond aux filtres actuels.'));
    } else {
      container.appendChild(grid);
    }
    return grid;
  }

  function buildCard(s, ctx) {
    const { left, width, range, slot, data, diagnostics, rooms, teachers, subjects, groups, selectedId, swap, highlightIds } = ctx;
    const st = parseTime(s.start), en = parseTime(s.end);
    const top = (st - range.from) / slot;
    const height = (en - st) / slot;
    const subject = subjects.get(s.subjectId);
    const teacher = teachers.get(s.teacherId);
    const room = rooms.get(s.roomId);
    const group = groups.get(s.groupId);
    const color = subject ? subject.color : '#64748B';
    const diag = diagnostics.bySession.get(s.id);
    const severity = diag ? diag.severity : null;
    const isSwapA = swap && swap.a === s.id, isSwapB = swap && swap.b === s.id;
    const dim = highlightIds && highlightIds.size && !highlightIds.has(s.id);

    const subjectLabel = subject ? subject.label : (s.subjectId ? 'Matière inconnue' : 'Sans matière');
    const subjectShort = subject ? subject.short : '?';
    const teacherName = teacher ? teacher.name : (s.teacherId ? 'Enseignant inconnu' : 'Sans enseignant');
    const teacherCode = teacher ? teacher.code : '—';
    const roomLabel = room ? room.name : (s.roomId ? 'Salle ?' : 'Sans salle');
    const variantText = group && group.variant ? ((subject && /math/i.test(subject.label)) ? 'Maths ' + group.variant : 'Parcours ' + group.variant) : '';

    const tooltip = [
      subjectLabel + ' — ' + levelLabel(s.level) + ' (' + audienceLabel(s.audience) + ')',
      dayLabel(s.day) + ' ' + fmtRange(s.start, s.end),
      'Enseignant : ' + teacherName + (teacher ? ' (' + teacher.code + ')' : ''),
      'Salle : ' + roomLabel + (room && room.exceptional ? ' (exceptionnelle)' : ''),
      group ? 'Groupe : ' + levelLabel(group.level) + ' · ' + group.label : 'Groupe : —',
      s.title ? 'Intitulé : ' + s.title : '',
      !s.active ? 'Séance désactivée' : '',
      diag ? diag.issues.map((i) => '• ' + i.title + ' : ' + i.message).join('\n') : ''
    ].filter(Boolean).join('\n');

    const card = h('article', {
      class: ['card', 'aud-' + s.audience, selectedId === s.id && 'selected', isSwapA && 'swap-a', isSwapB && 'swap-b',
        highlightIds && highlightIds.has(s.id) && 'highlight', dim && 'dimmed', !s.active && 'inactive', severity && 'sev-' + severity,
        room && room.exceptional && 'room-exceptional'],
      dataset: { id: s.id },
      tabindex: 0,
      role: 'button',
      'aria-label': subjectLabel + ', ' + levelLabel(s.level) + ', ' + dayLabel(s.day) + ' ' + fmtRange(s.start, s.end) + ', ' + teacherName + ', ' + roomLabel + (severity === 'error' ? ', conflit bloquant' : severity === 'warning' ? ', avertissement' : ''),
      title: tooltip,
      style: {
        '--subject': color, '--card-bg': rgba(color, 0.11), '--card-border': rgba(color, 0.35),
        top: 'calc(var(--slot-h) * ' + top + ')', height: 'calc(var(--slot-h) * ' + height + ' - 2px)',
        left: 'calc(' + left + '% + 2px)', width: 'calc(' + width + '% - 4px)'
      }
    }, [
      h('div', { class: 'card-top' }, [
        h('span', { class: 'card-subject' }, [h('span', { class: 'long' }, subjectLabel), h('span', { class: 'short' }, subjectShort)]),
        h('span', { class: ['badge-aud', s.audience] }, audienceBadge(s.audience))
      ]),
      h('div', { class: 'card-line card-level' }, [h('span', { class: ['badge-aud', 'inline', s.audience] }, audienceBadge(s.audience)), h('span', { class: 'long' }, levelLabel(s.level)), h('span', { class: 'short' }, Nexus.levelShort(s.level)), variantText ? h('span', { class: 'variant-sep' }, ' · ') : null, variantText ? h('span', { class: 'variant' }, variantText) : null, group && group.variant ? h('span', { class: 'variant variant-short' }, group.variant) : null]),
      h('div', { class: 'card-line card-time' }, fmtRange(s.start, s.end)),
      h('div', { class: 'card-line card-who' }, [
        h('span', { class: 'teacher' }, teacherName),
        h('span', { class: 'code' }, teacherCode),
        h('span', { class: 'muted' }, '·'),
        h('span', { class: ['room', room && room.exceptional && 'exceptional'] }, roomLabel)
      ]),
      severity && severity !== 'info' ? h('span', { class: ['card-flag', severity], 'aria-hidden': 'true' }, severity === 'error' ? '!' : '⚠') : null
    ]);
    return card;
  }

  /* ---------------------------------------------------------------
     Vue liste (tableau trié par jour / heure)
     --------------------------------------------------------------- */
  function renderList(container, opts) {
    const { data, diagnostics, sessions, selectedId } = opts;
    const teachers = new Map(data.teachers.map((t) => [t.id, t]));
    const rooms = new Map(data.rooms.map((r) => [r.id, r]));
    const subjects = new Map(data.subjects.map((s) => [s.id, s]));
    const groups = new Map(data.groups.map((g) => [g.id, g]));
    const table = h('table', { class: 'table' }, [
      h('thead', null, h('tr', null, ['Horaire', 'Matière', 'Niveau', 'Public', 'Groupe', 'Enseignant', 'Salle', 'Statut', 'Diagnostic'].map((c) => h('th', null, c))))
    ]);
    const tbody = h('tbody');
    const sorted = sortSessions(sessions);
    let currentDay = null;
    sorted.forEach((s) => {
      if (s.day !== currentDay) {
        currentDay = s.day;
        tbody.appendChild(h('tr', { class: 'day-head' }, h('td', { colspan: 9 }, dayLabel(s.day))));
      }
      const subject = subjects.get(s.subjectId), t = teachers.get(s.teacherId), r = rooms.get(s.roomId), g = groups.get(s.groupId);
      const diag = diagnostics.bySession.get(s.id);
      tbody.appendChild(h('tr', { class: ['session', selectedId === s.id && 'selected', !s.active && 'inactive'], dataset: { id: s.id }, tabindex: 0 }, [
        h('td', null, fmtRange(s.start, s.end)),
        h('td', null, [h('span', { class: 'swatch', style: { background: subject ? subject.color : '#999' } }), subject ? subject.label : '—']),
        h('td', null, levelLabel(s.level)),
        h('td', null, h('span', { class: ['badge-aud', s.audience] }, audienceBadge(s.audience))),
        h('td', null, g ? g.label + (g.variant ? ' (' + g.variant + ')' : '') : '—'),
        h('td', null, t ? t.name : '—'),
        h('td', null, r ? r.name + (r.exceptional ? ' ★' : '') : '—'),
        h('td', null, s.active ? 'Active' : 'Inactive'),
        h('td', null, diag ? h('span', { class: ['chip', diag.severity] }, diag.severity === 'error' ? 'Conflit' : diag.severity === 'warning' ? 'Avertissement' : 'Conseil') : h('span', { class: 'chip success' }, 'OK'))
      ]));
    });
    table.appendChild(tbody);
    clear(container);
    container.appendChild(h('div', { class: 'table-wrap' }, table));
    if (!sorted.length) container.appendChild(h('div', { class: 'grid-empty' }, 'Aucune séance ne correspond aux filtres actuels.'));
  }

  /* ---------------------------------------------------------------
     Glisser-déposer (souris / stylet). Lié une seule fois au conteneur.
     handlers : { getSession(id), isDraggable(id), preview(candidate) -> {severity, issues}, onDrop(id, candidate) }
     --------------------------------------------------------------- */
  function bindDrag(container, handlers) {
    let drag = null;

    function geometry() {
      const grid = container.querySelector('.grid');
      if (!grid) return null;
      const cols = Array.from(grid.querySelectorAll('.grid-col'));
      if (!cols.length) return null;
      const from = Number(grid.dataset.from);
      const slot = Number(grid.dataset.slot) || 15;
      const totalSlots = Number(grid.style.getPropertyValue('--slots')) || 1;
      return { grid, cols, from, slot, totalSlots, laneMode: grid.dataset.laneMode };
    }

    function locate(clientX, clientY) {
      const g = geometry();
      if (!g) return null;
      for (const col of g.cols) {
        const r = col.getBoundingClientRect();
        if (clientX >= r.left && clientX < r.right) {
          const slotH = r.height / g.totalSlots;
          let idx = Math.round((clientY - r.top - drag.grabOffset) / slotH);
          idx = Math.max(0, Math.min(g.totalSlots - drag.durationSlots, idx));
          const start = g.from + idx * g.slot;
          const lanes = col.dataset.lanes ? col.dataset.lanes.split(',') : [];
          let laneIdx = 0;
          if (lanes.length) laneIdx = Math.max(0, Math.min(lanes.length - 1, Math.floor((clientX - r.left) / r.width * lanes.length)));
          return { col, rect: r, slotH, idx, start, day: col.dataset.day, lanes, laneIdx, laneMode: g.laneMode, laneId: lanes[laneIdx] };
        }
      }
      return null;
    }

    function onPointerDown(ev) {
      if (ev.button !== 0 || ev.pointerType === 'touch') return;
      const card = ev.target.closest('.card');
      if (!card || !container.contains(card)) return;
      const id = card.dataset.id;
      if (!handlers.isDraggable(id)) return;
      const session = handlers.getSession(id);
      if (!session) return;
      const g = geometry();
      if (!g) return;
      const rect = card.getBoundingClientRect();
      drag = {
        id, session, card, started: false, startX: ev.clientX, startY: ev.clientY,
        grabOffset: ev.clientY - rect.top, width: rect.width, height: rect.height,
        durationSlots: Math.max(1, Math.round(sessionMinutes(session) / g.slot)), ghost: null, preview: null, target: null, lastKey: ''
      };
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('pointercancel', onPointerCancel);
      document.addEventListener('keydown', onKey);
    }

    function startDrag() {
      drag.started = true;
      document.body.classList.add('is-dragging');
      drag.card.classList.add('dragging');
      const ghost = drag.card.cloneNode(true);
      ghost.classList.add('drag-ghost');
      ghost.classList.remove('dragging', 'selected', 'dimmed');
      ghost.style.width = drag.width + 'px';
      ghost.style.height = drag.height + 'px';
      ghost.style.left = '0px'; ghost.style.top = '0px';
      document.body.appendChild(ghost);
      drag.ghost = ghost;
    }

    function onPointerMove(ev) {
      if (!drag) return;
      if (!drag.started) {
        if (Math.abs(ev.clientX - drag.startX) < 6 && Math.abs(ev.clientY - drag.startY) < 6) return;
        startDrag();
      }
      ev.preventDefault();
      drag.ghost.style.transform = 'translate(' + (ev.clientX - drag.width / 2) + 'px, ' + (ev.clientY - drag.grabOffset) + 'px) rotate(-1deg)';
      const loc = locate(ev.clientX, ev.clientY);
      container.querySelectorAll('.grid-col.drop-target').forEach((c) => c.classList.remove('drop-target'));
      if (!loc) { removePreview(); drag.target = null; return; }
      loc.col.classList.add('drop-target');
      const slotMinutes = Number(loc.col.closest('.grid').dataset.slot) || 15;
      const endMinutes = loc.start + drag.durationSlots * slotMinutes;
      if (endMinutes > 1440 || loc.start >= 1440) { removePreview(); drag.target = null; return; }
      const candidate = Object.assign({}, drag.session, {
        day: loc.day, start: minutesToTime(loc.start), end: minutesToTime(endMinutes)
      });
      if (loc.laneMode === 'room') {
        candidate.roomId = (loc.laneId && loc.laneId !== '__none') ? loc.laneId : '';
      }
      drag.target = candidate;
      const key = candidate.day + candidate.start + candidate.roomId;
      if (key === drag.lastKey && drag.preview && drag.preview.parentNode === loc.col) return;
      drag.lastKey = key;
      const result = handlers.preview(candidate);
      const laneW = loc.lanes.length ? 100 / loc.lanes.length : 100;
      const leftPct = loc.lanes.length ? loc.laneIdx * laneW : 0;
      removePreview();
      const preview = h('div', {
        class: ['drop-preview', result.severity === 'error' && 'error', result.severity === 'warning' && 'warning'],
        style: { top: (loc.idx * loc.slotH) + 'px', height: (drag.durationSlots * loc.slotH - 2) + 'px', left: 'calc(' + leftPct + '% + 3px)', width: 'calc(' + laneW + '% - 6px)' }
      }, [
        h('div', null, dayShort(candidate.day) + ' ' + fmtRange(candidate.start, candidate.end) + (candidate.roomId !== drag.session.roomId ? ' · ' + Nexus.roomName(handlers.data(), candidate.roomId) : '')),
        result.issues && result.issues.length ? h('div', { class: 'msg' }, result.issues.filter((i) => i.severity !== 'info').slice(0, 2).map((i) => i.title).join(' · ')) : null
      ]);
      loc.col.appendChild(preview);
      drag.preview = preview;
    }

    function removePreview() {
      if (drag && drag.preview) { drag.preview.remove(); drag.preview = null; }
    }

    function cleanup() {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerCancel);
      document.removeEventListener('keydown', onKey);
      if (!drag) return;
      removePreview();
      if (drag.ghost) drag.ghost.remove();
      drag.card.classList.remove('dragging');
      container.querySelectorAll('.grid-col.drop-target').forEach((c) => c.classList.remove('drop-target'));
      document.body.classList.remove('is-dragging');
      const wasStarted = drag.started;
      drag = null;
      return wasStarted;
    }

    function onPointerCancel() {
      cleanup();
    }

    function onPointerUp(ev) {
      if (!drag) return;
      const target = drag.started ? drag.target : null;
      const id = drag.id;
      const original = drag.session;
      const started = cleanup();
      if (!started || !target) return;
      if (target.day === original.day && target.start === original.start && target.roomId === original.roomId) return;
      handlers.onDrop(id, { day: target.day, start: target.start, end: target.end, roomId: target.roomId });
      // Empêche le clic de sélection qui suit le relâchement
      const swallow = (e) => { e.stopPropagation(); e.preventDefault(); };
      container.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => container.removeEventListener('click', swallow, { capture: true }), 50);
    }

    function onKey(ev) {
      if (ev.key === 'Escape' && drag) { cleanup(); ev.stopPropagation(); }
    }

    container.addEventListener('pointerdown', onPointerDown);
    return { isDragging: () => Boolean(drag && drag.started) };
  }

  Nexus.Grid = { render, renderList, bindDrag, packSessions, computeRange };
})(typeof window !== 'undefined' ? window : globalThis);
