/* =====================================================================
   NEXUS PLANNING STUDIO — app.js
   État applicatif, actions métier, orchestration du rendu, événements.
   Le DOM est une projection de `state` ; toute modification passe par
   `commit()` (historique + validation + sauvegarde + rendu).
   ===================================================================== */
(function (global) {
  'use strict';
  const Nexus = global.Nexus;
  const { h, clear, fillSelect, DAYS, LEVELS, AUDIENCES, parseTime, minutesToTime, fmtTime, fmtRange, dayLabel, dayShort, levelLabel, audienceLabel,
    normalize, validate, previewConflicts, sessionLabel, sessionWhen, sessionMinutes, findFreeSlots, deepClone, plural, debounce, uid,
    toExportJson, toCsv, exportFileName, inspectImport, globalStats } = Nexus;
  const Panels = Nexus.Panels;
  const Grid = Nexus.Grid;

  const $ = (id) => document.getElementById(id);

  /* ---------------------------------------------------------------
     État
     --------------------------------------------------------------- */
  const state = {
    data: null,
    diagnostics: { issues: [], bySession: new Map(), counts: { error: 0, warning: 0, info: 0 } },
    view: 'week',
    viewTeacherId: '',
    viewLevel: 'TERMINALE',
    filters: { audience: 'ALL', level: 'ALL', subjectId: 'ALL', teacherId: 'ALL', roomId: 'ALL', day: 'ALL', showInactive: false, conflictsOnly: false },
    selectedId: null,
    swap: { a: null, b: null },
    highlightIds: new Set(),
    activeIssueId: null,
    diagFilter: null,
    panelTab: 'session',
    density: 'comfortable',
    mobileDay: 'WED',
    saveStatus: 'saved',
    savedAt: null,
    storageOk: true
  };
  const history = Nexus.createHistory();
  let defaultData = null;
  let dragApi = null;

  const mobileQuery = global.matchMedia ? global.matchMedia('(max-width: 760px)') : { matches: false };
  const narrowQuery = global.matchMedia ? global.matchMedia('(max-width: 1100px)') : { matches: false };
  const isMobile = () => mobileQuery.matches;
  const isNarrow = () => narrowQuery.matches;

  /* ---------------------------------------------------------------
     Sélection visible : vue + filtres
     --------------------------------------------------------------- */
  function visibleSessions() {
    const f = state.filters;
    const bySession = state.diagnostics.bySession;
    return state.data.sessions.filter((s) => {
      if (!s.active && !f.showInactive) return false;
      if (state.view === 'teacher' && s.teacherId !== state.viewTeacherId) return false;
      if (state.view === 'level' && s.level !== state.viewLevel) return false;
      if (f.audience !== 'ALL' && s.audience !== f.audience) return false;
      if (f.level !== 'ALL' && s.level !== f.level) return false;
      if (f.subjectId !== 'ALL' && s.subjectId !== f.subjectId) return false;
      if (f.teacherId !== 'ALL' && s.teacherId !== f.teacherId) return false;
      if (f.roomId !== 'ALL' && s.roomId !== f.roomId) return false;
      if (f.day !== 'ALL' && s.day !== f.day) return false;
      if (f.conflictsOnly) {
        const d = bySession.get(s.id);
        if (!d || d.severity === 'info') return false;
      }
      return true;
    });
  }

  function filterSummary() {
    const f = state.filters, d = state.data;
    const parts = [];
    if (f.audience !== 'ALL') parts.push(audienceLabel(f.audience));
    if (f.level !== 'ALL') parts.push(levelLabel(f.level));
    if (f.subjectId !== 'ALL') parts.push(Nexus.subjectLabel(d, f.subjectId));
    if (f.teacherId !== 'ALL') parts.push(Nexus.teacherName(d, f.teacherId));
    if (f.roomId !== 'ALL') parts.push(Nexus.roomName(d, f.roomId));
    if (f.day !== 'ALL') parts.push(dayLabel(f.day));
    if (f.conflictsOnly) parts.push('conflits seulement');
    if (f.showInactive) parts.push('inactives visibles');
    return parts.join(' · ');
  }

  function hasFilters() {
    const f = state.filters;
    return f.audience !== 'ALL' || f.level !== 'ALL' || f.subjectId !== 'ALL' || f.teacherId !== 'ALL' || f.roomId !== 'ALL' || f.day !== 'ALL' || f.conflictsOnly || f.showInactive;
  }

  /* ---------------------------------------------------------------
     Mutations
     --------------------------------------------------------------- */
  function commit(label, mutator, opts) {
    opts = opts || {};
    history.push(state.data, label);
    try {
      mutator(state.data);
    } catch (err) {
      console.error('Mutation échouée :', err);
      const back = history.undo(state.data);
      if (back) state.data = back.data;
      history.dropFuture();
      Panels.toast('L\'opération a échoué : ' + (err && err.message ? err.message : 'erreur inattendue'), 'error');
      afterChange();
      return false;
    }
    state.data = normalize(state.data);
    state.data.meta.updatedAt = Nexus.todayIso();
    afterChange();
    if (opts.toast) Panels.toast(opts.toast, opts.toastType || 'success');
    return true;
  }

  function afterChange() {
    state.diagnostics = validate(state.data);
    // nettoie les sélections orphelines
    const ids = new Set(state.data.sessions.map((s) => s.id));
    if (state.selectedId && !ids.has(state.selectedId)) state.selectedId = null;
    if (state.swap.a && !ids.has(state.swap.a)) state.swap = { a: null, b: null };
    if (state.swap.b && !ids.has(state.swap.b)) state.swap.b = null;
    if (state.highlightIds.size) state.highlightIds = new Set(Array.from(state.highlightIds).filter((id) => ids.has(id)));
    if (state.view === 'teacher' && !state.data.teachers.some((t) => t.id === state.viewTeacherId)) state.viewTeacherId = (state.data.teachers[0] || {}).id || '';
    persist();
    render();
  }

  function persist() {
    if (!state.storageOk) { state.saveStatus = 'error'; return; }
    const ok = Nexus.save(state.data);
    state.saveStatus = ok ? 'saved' : 'error';
    if (ok) state.savedAt = new Date();
  }

  function undo() {
    const r = history.undo(state.data);
    if (!r) return;
    state.data = normalize(r.data);
    afterChange();
    Panels.toast('Annulé : ' + (r.label || 'dernière opération'), 'success', 2500);
  }
  function redo() {
    const r = history.redo(state.data);
    if (!r) return;
    state.data = normalize(r.data);
    afterChange();
    Panels.toast('Rétabli : ' + (r.label || 'opération'), 'success', 2500);
  }

  /* ---- séances ---- */
  function getSession(id) { return state.data.sessions.find((s) => s.id === id) || null; }

  function select(id, opts) {
    opts = opts || {};
    if (state.swap.a && !state.swap.b && id && id !== state.swap.a) {
      state.swap.b = id;
      render();
      return;
    }
    state.selectedId = id;
    state.activeIssueId = null;
    if (id) state.panelTab = 'session';
    if (opts.openSide !== false && id) openSide();
    render();
    if (opts.scroll && id) {
      const el = $('gridWrap').querySelector('.card[data-id="' + CSS.escape(id) + '"]');
      if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  function updateSession(id, patch) {
    const s = getSession(id);
    if (!s) return;
    const label = 'Modification de ' + sessionLabel(state.data, s);
    commit(label, (d) => { const i = d.sessions.findIndex((x) => x.id === id); if (i >= 0) d.sessions[i] = Nexus.normalizeSession(Object.assign({}, d.sessions[i], patch, { id })); });
    const diag = state.diagnostics.bySession.get(id);
    if (diag && diag.severity === 'error') Panels.toast('Séance enregistrée, mais un conflit bloquant a été détecté : voir le diagnostic.', 'warning');
    else Panels.toast('Séance mise à jour.', 'success', 2000);
  }

  function moveSession(id, patch, label) {
    const s = getSession(id);
    if (!s) return;
    const before = sessionWhen(s);
    commit(label || 'Déplacement de ' + sessionLabel(state.data, s), (d) => {
      const x = d.sessions.find((y) => y.id === id);
      if (!x) return;
      x.day = patch.day; x.start = patch.start; x.end = patch.end;
      if (patch.roomId) x.roomId = patch.roomId;
    });
    const after = getSession(id);
    const diag = state.diagnostics.bySession.get(id);
    const where = dayLabel(after.day) + ' ' + fmtRange(after.start, after.end) + (patch.roomId && patch.roomId !== s.roomId ? ' · ' + Nexus.roomName(state.data, patch.roomId) : '');
    if (diag && diag.severity === 'error') Panels.toast('Séance déplacée vers ' + where + ' — conflit bloquant : ' + diag.issues.find((i) => i.severity === 'error').title + '.', 'error');
    else if (diag && diag.severity === 'warning') Panels.toast('Séance déplacée vers ' + where + ' — avertissement : ' + diag.issues.find((i) => i.severity === 'warning').title + '.', 'warning');
    else Panels.toast('Séance déplacée vers ' + where + ' (avant : ' + before + ').', 'success');
  }

  function addSession(partial) {
    const template = Nexus.newSession(state.data, Object.assign({ groupId: '' }, partial || {}));
    // premier créneau standard libre en salle normale
    if (!partial || !partial.day) {
      const free = findFreeSlots(state.data, Object.assign({}, template, { teacherId: '', groupId: '' }), { limit: 1 });
      if (free.length) { template.day = free[0].day; template.start = free[0].start; template.end = free[0].end; template.roomId = free[0].roomId; }
    }
    commit('Création d\'une séance', (d) => { d.sessions.push(template); });
    state.selectedId = template.id;
    state.panelTab = 'session';
    openSide();
    render();
    Panels.toast('Nouvelle séance créée ' + sessionWhen(template) + ' : complétez matière, groupe et enseignant.', 'success');
  }

  function duplicateSession(id) {
    const s = getSession(id);
    if (!s) return;
    const copy = Object.assign(deepClone(s), { id: uid('session'), title: s.title ? s.title + ' (copie)' : '' });
    // décale la copie sur le premier créneau libre pour l'enseignant, sinon même créneau
    const free = findFreeSlots(state.data, copy, { limit: 1 });
    if (free.length) { copy.day = free[0].day; copy.start = free[0].start; copy.end = free[0].end; copy.roomId = free[0].roomId; }
    commit('Duplication de ' + sessionLabel(state.data, s), (d) => { d.sessions.push(copy); });
    state.selectedId = copy.id;
    render();
    Panels.toast('Séance dupliquée ' + sessionWhen(copy) + '. Ajustez-la si besoin.', 'success');
  }

  function toggleSession(id) {
    const s = getSession(id);
    if (!s) return;
    commit((s.active ? 'Désactivation' : 'Réactivation') + ' de ' + sessionLabel(state.data, s), (d) => { const x = d.sessions.find((y) => y.id === id); if (x) x.active = !x.active; });
    if (!getSession(id).active && !state.filters.showInactive) Panels.toast('Séance désactivée : elle reste dans les données (filtre « Inactives » pour la voir).', 'success');
  }

  function deleteSession(id) {
    const s = getSession(id);
    if (!s) return;
    Panels.confirmDialog({
      title: 'Supprimer la séance',
      message: 'Supprimer définitivement « ' + sessionLabel(state.data, s) + ' » (' + sessionWhen(s) + ') ?',
      detail: 'Vous pourrez annuler cette suppression avec le bouton Annuler (Ctrl+Z). Pour une mise en pause, préférez « Désactiver ».',
      confirmLabel: 'Supprimer', danger: true
    }).then((ok) => {
      if (!ok) return;
      commit('Suppression de ' + sessionLabel(state.data, s), (d) => { d.sessions = d.sessions.filter((x) => x.id !== id); });
      if (state.selectedId === id) state.selectedId = null;
      render();
      Panels.toast('Séance supprimée.', 'success');
    });
  }

  /* ---- échange ---- */
  function startSwap(aId) {
    state.swap = { a: aId, b: null };
    render();
    Panels.toast('Cliquez sur la seconde séance à interchanger.', '', 3000);
  }
  function setSwap(aId, bId) {
    state.swap = { a: aId, b: bId };
    render();
  }
  function cancelSwap() {
    state.swap = { a: null, b: null };
    render();
  }
  function performSwap() {
    const a = getSession(state.swap.a), b = getSession(state.swap.b);
    if (!a || !b || a.id === b.id) return;
    const la = sessionLabel(state.data, a), lb = sessionLabel(state.data, b);
    commit('Échange ' + la + ' ⇄ ' + lb, (d) => {
      const x = d.sessions.find((s) => s.id === a.id), y = d.sessions.find((s) => s.id === b.id);
      const tmp = { day: x.day, start: x.start, end: x.end, roomId: x.roomId };
      x.day = y.day; x.start = y.start; x.end = y.end; x.roomId = y.roomId;
      y.day = tmp.day; y.start = tmp.start; y.end = tmp.end; y.roomId = tmp.roomId;
    });
    state.swap = { a: null, b: null };
    state.highlightIds = new Set([a.id, b.id]);
    render();
    const da = state.diagnostics.bySession.get(a.id), db = state.diagnostics.bySession.get(b.id);
    const err = (da && da.severity === 'error') || (db && db.severity === 'error');
    Panels.toast('Créneaux interchangés : ' + la + ' est maintenant ' + sessionWhen(getSession(a.id)) + ' ; ' + lb + ' est maintenant ' + sessionWhen(getSession(b.id)) + '.' + (err ? ' Un conflit bloquant en résulte : voir le diagnostic.' : ''), err ? 'error' : 'success', 6000);
  }

  /* ---- diagnostic ---- */
  function focusIssue(issue) {
    state.activeIssueId = issue.id;
    state.highlightIds = new Set(issue.sessionIds);
    if (issue.sessionIds.length) {
      state.selectedId = issue.sessionIds[0];
      const s = getSession(state.selectedId);
      if (s && !s.active) state.filters.showInactive = true;
      if (state.view === 'teacher' && s && s.teacherId !== state.viewTeacherId) state.view = 'week';
      if (state.view === 'level' && s && s.level !== state.viewLevel) state.view = 'week';
    }
    if (issue.teacherId) { state.view = 'teacher'; state.viewTeacherId = issue.teacherId; }
    render();
    if (issue.sessionIds.length) {
      const el = $('gridWrap').querySelector('.card[data-id="' + CSS.escape(issue.sessionIds[0]) + '"]');
      if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }
  function setDiagFilter(sev) { state.diagFilter = sev; renderSide(); }
  function clearHighlight() { state.highlightIds = new Set(); state.activeIssueId = null; render(); }
  function highlightGroup(groupId) {
    state.highlightIds = new Set(state.data.sessions.filter((s) => s.groupId === groupId && s.active).map((s) => s.id));
    state.activeIssueId = null;
    render();
    const g = state.data.groups.find((x) => x.id === groupId);
    if (g) Panels.toast('Parcours du groupe « ' + levelLabel(g.level) + ' · ' + g.label + ' » mis en évidence. Échap pour effacer.', '', 3000);
  }

  /* ---- vues, filtres ---- */
  function setView(view, opts) {
    opts = opts || {};
    state.view = view;
    if (opts.teacherId) state.viewTeacherId = opts.teacherId;
    if (opts.level) state.viewLevel = opts.level;
    if (view === 'teacher' && !state.data.teachers.some((t) => t.id === state.viewTeacherId)) state.viewTeacherId = (state.data.teachers.find((t) => t.active) || state.data.teachers[0] || {}).id || '';
    render();
  }
  function setFilter(key, value) {
    state.filters[key] = value;
    render();
  }
  function clearFilters() {
    state.filters = { audience: 'ALL', level: 'ALL', subjectId: 'ALL', teacherId: 'ALL', roomId: 'ALL', day: 'ALL', showInactive: false, conflictsOnly: false };
    render();
  }
  function setDensity(d) {
    state.density = d;
    document.body.dataset.density = d;
    Nexus.savePrefs(Object.assign(Nexus.loadPrefs(), { density: d }));
    render();
  }
  function openConfig(tab, editingId) { Panels.openConfig(app, tab, editingId); }

  /* ---- import / export / reset ---- */
  function download(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 500);
  }
  function exportJson() {
    download(toExportJson(state.data), exportFileName('json'), 'application/json;charset=utf-8');
    Panels.toast('Export JSON créé : ' + exportFileName('json'), 'success');
  }
  function exportCsv() {
    download(toCsv(state.data), exportFileName('csv'), 'text/csv;charset=utf-8');
    Panels.toast('Export CSV créé (compatible Excel, séparateur « ; »).', 'success');
  }
  function importFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => Panels.toast('Lecture du fichier impossible.', 'error');
    reader.onload = () => {
      let raw;
      try {
        raw = JSON.parse(String(reader.result));
      } catch (e) {
        Panels.openImportDialog(app, null, { ok: false, errors: ['Le fichier n\'est pas un JSON valide (' + e.message + ').'], warnings: [] }, file.name);
        return;
      }
      Panels.openImportDialog(app, raw, inspectImport(raw), file.name);
    };
    reader.readAsText(file, 'utf-8');
  }
  function replaceData(raw, label, message) {
    commit(label, (d) => {
      const next = normalize(raw);
      Object.keys(d).forEach((k) => { delete d[k]; });
      Object.assign(d, next);
    });
    state.selectedId = null;
    state.swap = { a: null, b: null };
    state.highlightIds = new Set();
    render();
    if (message) Panels.toast(message, 'success');
  }
  function resetToDefault() {
    Panels.confirmDialog({
      title: 'Réinitialiser au planning initial',
      message: 'Remplacer le planning actuel par le planning initial fourni avec l\'application (' + plural(defaultData.sessions.length, 'séance') + ') ?',
      detail: 'Vos modifications seront perdues sauf si vous les avez exportées. L\'opération reste annulable avec Ctrl+Z tant que la page n\'est pas rechargée.',
      confirmLabel: 'Réinitialiser', danger: true
    }).then((ok) => {
      if (!ok) return;
      replaceData(deepClone(defaultData), 'Réinitialisation au planning initial', 'Planning initial restauré.');
    });
  }

  /* ---------------------------------------------------------------
     Rendu
     --------------------------------------------------------------- */
  function render() {
    renderToolbar();
    renderPlanning();
    renderSide();
    renderChrome();
    Panels.renderSwapbar($('swapbar'), app);
    Panels.refreshModal();
  }

  function renderToolbar() {
    const d = state.data, f = state.filters;
    document.querySelectorAll('#viewSwitch button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    document.querySelectorAll('#filterAudience button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === f.audience)));
    document.querySelectorAll('#densitySwitch button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === state.density)));
    fillSelect($('filterLevel'), [{ value: 'ALL', label: 'Niveau : tous' }].concat(LEVELS.map((l) => ({ value: l.id, label: l.label }))), f.level);
    fillSelect($('filterSubject'), [{ value: 'ALL', label: 'Matière : toutes' }].concat(d.subjects.filter((s) => s.active).map((s) => ({ value: s.id, label: s.label }))), f.subjectId);
    fillSelect($('filterTeacher'), [{ value: 'ALL', label: 'Enseignant : tous' }].concat(d.teachers.map((t) => ({ value: t.id, label: t.name + ' (' + t.code + ')' }))), f.teacherId);
    fillSelect($('filterRoom'), [{ value: 'ALL', label: 'Salle : toutes' }].concat(d.rooms.map((r) => ({ value: r.id, label: r.name }))), f.roomId);
    fillSelect($('filterDay'), [{ value: 'ALL', label: 'Jour : tous' }].concat(DAYS.map((x) => ({ value: x.id, label: x.label }))), f.day);
    ['filterLevel', 'filterSubject', 'filterTeacher', 'filterRoom', 'filterDay'].forEach((id) => $(id).classList.toggle('filter-active', $(id).value !== 'ALL'));
    $('filterConflicts').setAttribute('aria-pressed', String(f.conflictsOnly));
    $('filterConflicts').classList.toggle('filter-active', f.conflictsOnly);
    $('filterInactive').checked = f.showInactive;
    $('filterClear').hidden = !hasFilters();

    const ctx = $('viewContext');
    clear(ctx);
    if (state.view === 'teacher') {
      const sel = h('select', { class: 'select sm', 'aria-label': 'Enseignant affiché', onchange: (e) => setView('teacher', { teacherId: e.target.value }) });
      fillSelect(sel, d.teachers.map((t) => ({ value: t.id, label: t.name + ' (' + t.code + ')' + (t.active ? '' : ' — inactif') })), state.viewTeacherId);
      ctx.appendChild(sel);
    } else if (state.view === 'level') {
      const sel = h('select', { class: 'select sm', 'aria-label': 'Niveau affiché', onchange: (e) => setView('level', { level: e.target.value }) });
      fillSelect(sel, LEVELS.map((l) => ({ value: l.id, label: l.label })), state.viewLevel);
      ctx.appendChild(sel);
    }
  }

  function renderPlanning() {
    const sessions = visibleSessions();
    Panels.renderPlanningHead($('planningHead'), app);
    Panels.renderTeacherBanner($('teacherBanner'), app);
    Panels.renderPrintHeader($('printHeader'), app);
    Panels.renderLegend($('legend'), app);

    const wrap = $('gridWrap');
    if (state.view === 'list') {
      $('mobileDays').hidden = true;
      Grid.renderList(wrap, { data: state.data, diagnostics: state.diagnostics, sessions, selectedId: state.selectedId });
      return;
    }
    let days = DAYS.map((x) => x.id);
    if (state.filters.day !== 'ALL') days = [state.filters.day];
    const mobile = isMobile() && days.length > 1;
    const md = $('mobileDays');
    md.hidden = !mobile;
    if (mobile) {
      clear(md);
      DAYS.forEach((x) => {
        const n = sessions.filter((s) => s.day === x.id).length;
        md.appendChild(h('button', { type: 'button', 'aria-pressed': String(state.mobileDay === x.id), onclick: () => { state.mobileDay = x.id; render(); } }, [x.short, h('span', { class: 'n' }, n ? String(n) : '·')]));
      });
      days = [state.mobileDay];
    }
    const laneMode = state.view === 'room' ? 'room' : state.view === 'audience' ? 'audience' : 'auto';
    Grid.render(wrap, {
      data: state.data, diagnostics: state.diagnostics, sessions, days, laneMode,
      selectedId: state.selectedId, swap: state.swap, highlightIds: state.highlightIds,
      teacherId: state.view === 'teacher' ? state.viewTeacherId : null
    });
    if (!dragApi) dragApi = Grid.bindDrag(wrap, {
      data: () => state.data,
      getSession: (id) => getSession(id),
      isDraggable: (id) => { const s = getSession(id); return Boolean(s && s.active); },
      preview: (candidate) => previewConflicts(state.data, candidate),
      onDrop: (id, patch) => moveSession(id, patch)
    });
  }

  function renderSide() {
    document.querySelectorAll('.side-tabs [role="tab"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === state.panelTab)));
    const c = state.diagnostics.counts;
    const badge = $('diagCount');
    badge.textContent = String(c.error || c.warning);
    badge.className = 'count ' + (c.error ? 'error' : c.warning ? 'warning' : '');
    const body = $('sideBody');
    if (state.panelTab === 'session') Panels.renderEditor(body, app);
    else if (state.panelTab === 'diagnostic') Panels.renderDiagnostics(body, app);
    else Panels.renderStats(body, app);
  }

  function renderChrome() {
    $('btnUndo').disabled = !history.canUndo();
    $('btnRedo').disabled = !history.canRedo();
    $('btnUndo').title = history.canUndo() ? 'Annuler : ' + history.undoLabel() + ' (Ctrl+Z)' : 'Rien à annuler';
    $('btnRedo').title = history.canRedo() ? 'Rétablir : ' + history.redoLabel() + ' (Ctrl+Shift+Z)' : 'Rien à rétablir';

    const st = $('saveStatus');
    st.className = 'save-status ' + (state.saveStatus === 'saved' ? '' : state.saveStatus);
    const txt = st.querySelector('.txt');
    if (!state.storageOk) txt.textContent = 'Non sauvegardé : stockage local indisponible';
    else if (state.saveStatus === 'saved') txt.textContent = 'Sauvegardé' + (state.savedAt ? ' · ' + state.savedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '');
    else txt.textContent = 'Échec de la sauvegarde locale';

    const g = globalStats(state.data);
    const normal = state.data.rooms.filter((r) => r.active && !r.exceptional).length;
    const exc = state.data.rooms.filter((r) => r.active && r.exceptional).length;
    const c = state.diagnostics.counts;
    const bar = $('statusbar');
    clear(bar);
    const item = (txt2) => h('span', null, txt2);
    const sep = () => h('span', { class: 'sep' }, '|');
    bar.appendChild(h('span', null, [h('strong', null, String(g.sessions)), ' séances actives' + (g.inactive ? ' (' + g.inactive + ' inactive' + (g.inactive > 1 ? 's' : '') + ')' : '')]));
    bar.appendChild(sep());
    bar.appendChild(h('span', null, [h('strong', null, Nexus.fmtHours(g.minutes)), ' de cours / semaine']));
    bar.appendChild(sep());
    bar.appendChild(item(plural(state.data.teachers.filter((t) => t.active).length, 'enseignant')));
    bar.appendChild(sep());
    bar.appendChild(item(plural(normal, 'salle normale') + (exc ? ' + ' + plural(exc, 'exceptionnelle') : '')));
    bar.appendChild(sep());
    bar.appendChild(h('span', { class: c.error ? 'chip error' : 'chip success' }, c.error ? plural(c.error, 'conflit bloquant', 'conflits bloquants') : 'Aucun conflit bloquant'));
    if (c.warning) bar.appendChild(h('span', { class: 'chip warning' }, plural(c.warning, 'avertissement')));
    if (c.info) bar.appendChild(h('span', { class: 'chip info' }, plural(c.info, 'conseil')));
    bar.appendChild(h('span', { class: 'right' }, 'Ctrl+Z annuler · Ctrl+Shift+Z rétablir · Échap fermer'));
    document.title = 'Nexus Planning Studio — ' + state.data.settings.academicYear + (c.error ? ' (' + c.error + ' conflit' + (c.error > 1 ? 's' : '') + ')' : '');
  }

  function openSide() { document.body.classList.add('side-open'); document.body.classList.remove('side-collapsed'); $('btnSide').setAttribute('aria-pressed', 'true'); }
  function closeSide() { document.body.classList.remove('side-open'); }

  /* ---------------------------------------------------------------
     Événements
     --------------------------------------------------------------- */
  function bindEvents() {
    $('btnUndo').addEventListener('click', undo);
    $('btnRedo').addEventListener('click', redo);
    $('btnNewSession').addEventListener('click', () => addSession());
    $('btnSettings').addEventListener('click', () => openConfig('teachers'));
    $('btnImport').addEventListener('click', () => $('importFile').click());
    $('importFile').addEventListener('change', (e) => { importFromFile(e.target.files[0]); e.target.value = ''; });
    $('btnExportJson').addEventListener('click', exportJson);
    $('btnExportCsv').addEventListener('click', exportCsv);
    $('btnPrint').addEventListener('click', () => { Panels.renderPrintHeader($('printHeader'), app); global.print(); });
    $('btnReset').addEventListener('click', resetToDefault);
    $('btnSide').addEventListener('click', () => {
      if (isNarrow()) document.body.classList.toggle('side-open');
      else { document.body.classList.toggle('side-collapsed'); Nexus.savePrefs(Object.assign(Nexus.loadPrefs(), { sideCollapsed: document.body.classList.contains('side-collapsed') })); }
      $('btnSide').setAttribute('aria-pressed', String(isNarrow() ? document.body.classList.contains('side-open') : !document.body.classList.contains('side-collapsed')));
    });
    $('btnFilters').addEventListener('click', () => { const open = document.body.classList.toggle('filters-open'); $('btnFilters').setAttribute('aria-expanded', String(open)); });
    $('btnSideClose').addEventListener('click', closeSide);

    $('viewSwitch').addEventListener('click', (e) => { const b = e.target.closest('button[data-view]'); if (b) setView(b.dataset.view); });
    $('filterAudience').addEventListener('click', (e) => { const b = e.target.closest('button[data-value]'); if (b) setFilter('audience', b.dataset.value); });
    $('densitySwitch').addEventListener('click', (e) => { const b = e.target.closest('button[data-value]'); if (b) setDensity(b.dataset.value); });
    $('filterLevel').addEventListener('change', (e) => setFilter('level', e.target.value));
    $('filterSubject').addEventListener('change', (e) => setFilter('subjectId', e.target.value));
    $('filterTeacher').addEventListener('change', (e) => setFilter('teacherId', e.target.value));
    $('filterRoom').addEventListener('change', (e) => setFilter('roomId', e.target.value));
    $('filterDay').addEventListener('change', (e) => setFilter('day', e.target.value));
    $('filterConflicts').addEventListener('click', () => setFilter('conflictsOnly', !state.filters.conflictsOnly));
    $('filterInactive').addEventListener('change', (e) => setFilter('showInactive', e.target.checked));
    $('filterClear').addEventListener('click', clearFilters);

    document.querySelector('.side-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[role="tab"]');
      if (!b) return;
      state.panelTab = b.dataset.tab;
      $('sideBody').scrollTop = 0;
      renderSide();
    });

    // sélection dans la grille / la liste (délégation)
    const wrap = $('gridWrap');
    wrap.addEventListener('click', (e) => {
      if (dragApi && dragApi.isDragging()) return;
      const card = e.target.closest('.card, tr.session');
      if (!card) return;
      const id = card.dataset.id;
      if ((e.ctrlKey || e.metaKey) && state.selectedId && state.selectedId !== id) { setSwap(state.selectedId, id); return; }
      select(id);
    });
    wrap.addEventListener('keydown', (e) => {
      const card = e.target.closest('.card, tr.session');
      if (!card) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(card.dataset.id); }
    });

    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
      if (e.key === 'Escape') {
        if (Panels.isModalOpen()) { Panels.closeModal(); return; }
        if (state.swap.a) { cancelSwap(); return; }
        if (state.highlightIds.size) { clearHighlight(); return; }
        if (document.body.classList.contains('side-open')) { closeSide(); return; }
        if (state.selectedId) { state.selectedId = null; render(); }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !typing) {
        if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        else if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      }
    });

    global.addEventListener('resize', debounce(() => renderPlanning(), 150));
    global.addEventListener('beforeprint', () => Panels.renderPrintHeader($('printHeader'), app));
    global.addEventListener('storage', (e) => { if (e.key === Nexus.STORAGE_KEY) Panels.toast('Le planning a été modifié dans un autre onglet. Rechargez la page pour voir la dernière version.', 'warning', 8000); });
  }

  /* ---------------------------------------------------------------
     Démarrage
     --------------------------------------------------------------- */
  function loadDefault() {
    if (global.NEXUS_DEFAULT_PLANNING) return Promise.resolve(global.NEXUS_DEFAULT_PLANNING);
    // secours : fichier JSON (fonctionne via http://, pas toujours en file://)
    return fetch('data/planning.default.json').then((r) => r.json()).catch(() => ({ teachers: [], rooms: [], subjects: [], groups: [], sessions: [] }));
  }

  function boot() {
    loadDefault().then((raw) => {
      defaultData = normalize(raw);
      state.storageOk = Nexus.storageAvailable();
      const loaded = Nexus.load(defaultData);
      state.data = loaded.data;
      if (loaded.savedAt) state.savedAt = new Date(loaded.savedAt);
      const prefs = Nexus.loadPrefs();
      if (prefs.density === 'compact' || prefs.density === 'comfortable') { state.density = prefs.density; document.body.dataset.density = prefs.density; }
      if (prefs.sideCollapsed && !isNarrow()) { document.body.classList.add('side-collapsed'); $('btnSide').setAttribute('aria-pressed', 'false'); }
      state.viewTeacherId = (state.data.teachers.find((t) => t.active) || state.data.teachers[0] || {}).id || '';
      state.diagnostics = validate(state.data);
      bindEvents();
      render();
      if (loaded.message) Panels.toast(loaded.message, loaded.source === 'default-corrupt' ? 'warning' : 'warning', 8000);
      if (!defaultData.sessions.length) Panels.toast('Données initiales introuvables : vérifiez que data/default-data.js est présent.', 'error', 10000);
    });
  }

  const app = {
    state, history,
    visibleSessions, filterSummary, hasFilters,
    commit, undo, redo,
    getSession, select, updateSession, moveSession, addSession, duplicateSession, toggleSession, deleteSession,
    startSwap, setSwap, cancelSwap, performSwap,
    focusIssue, setDiagFilter, clearHighlight, highlightGroup,
    setView, setFilter, clearFilters, setDensity, openConfig,
    exportJson, exportCsv, importFromFile, replaceData, resetToDefault,
    render, renderSide, renderPlanning, openSide, closeSide
  };
  Nexus.app = app;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
