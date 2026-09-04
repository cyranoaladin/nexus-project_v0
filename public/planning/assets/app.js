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
  const Sync = Nexus.Sync;
  const AUTOSAVE_DELAY_MS = 1500;
  const POLL_INTERVAL_MS = 60000;

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
    storageOk: true,
    // Mode intégré Nexus (source de vérité serveur)
    mode: 'standalone',
    revision: null,
    permissions: null,
    viewer: null,
    readOnly: false,
    sync: { status: 'saved', message: '', lastSavedAt: null, lastSavedBy: null, pending: false, latestRevision: null, latestBy: null, errors: [] }
  };
  let autosaveTimer = null;
  let pollTimer = null;
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

  /** Nombre de dimensions de filtrage actives — sert le compteur du bouton. */
  function activeFilterCount() {
    const f = state.filters;
    let n = 0;
    ['audience', 'level', 'subjectId', 'teacherId', 'roomId', 'day'].forEach((k) => { if (f[k] !== 'ALL') n += 1; });
    if (f.conflictsOnly) n += 1;
    if (f.showInactive) n += 1;
    return n;
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
    if (state.mode === 'integrated' && state.sync.status === 'loading') {
      Panels.toast('Chargement du planning partagé en cours… Veuillez patienter.', 'warning');
      return false;
    }
    if (state.readOnly) {
      Panels.toast('Planning partagé en lecture seule pour votre compte : aucune modification enregistrée.', 'warning');
      return false;
    }
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
    if (state.mode === 'integrated') {
      // Brouillon local de récupération ; le serveur reste la source de vérité.
      Sync.draft.save(state.data, state.revision);
      if (!state.readOnly) {
        if (state.sync.status !== 'saving') state.sync.status = 'dirty';
        else state.sync.pending = true;
        scheduleAutosave();
      }
      return;
    }
    if (!state.storageOk) { state.saveStatus = 'error'; return; }
    const ok = Nexus.save(state.data);
    state.saveStatus = ok ? 'saved' : 'error';
    if (ok) state.savedAt = new Date();
  }

  /* ---------------------------------------------------------------
     Mode intégré : synchronisation avec le serveur
     --------------------------------------------------------------- */
  function isIntegrated() { return state.mode === 'integrated'; }
  function isDirty() { return isIntegrated() && ['dirty', 'error', 'invalid', 'conflict'].includes(state.sync.status); }

  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => { saveToServer({ auto: true }); }, AUTOSAVE_DELAY_MS);
  }

  function applyServerDocument(doc) {
    state.data = normalize(doc.payload);
    state.revision = doc.document.revision;
    state.permissions = doc.permissions || state.permissions;
    state.viewer = doc.viewer || state.viewer;
    state.readOnly = !(state.permissions && state.permissions.canEdit);
    state.sync.status = state.readOnly ? 'readonly' : 'saved';
    state.sync.lastSavedAt = doc.document.updatedAt ? new Date(doc.document.updatedAt) : null;
    state.sync.lastSavedBy = doc.document.updatedBy || null;
    state.sync.latestRevision = doc.document.revision;
    state.sync.errors = [];
    history.clear();
    state.diagnostics = validate(state.data);
  }

  async function saveToServer(opts) {
    opts = opts || {};
    if (!isIntegrated() || state.readOnly) return false;
    clearTimeout(autosaveTimer);
    if (!opts.force && (state.sync.status === 'saved' || (!isDirty() && state.sync.status !== 'error'))) {
      return true;
    }
    if (state.sync.status === 'saving') { state.sync.pending = true; return false; }
    if (state.sync.status === 'conflict' && !opts.force) {
      Panels.showConflictDialog(app);
      return false;
    }
    if (state.diagnostics.counts.error > 0) {
      state.sync.status = 'invalid';
      state.sync.errors = state.diagnostics.issues.filter((i) => i.severity === 'error').map((i) => i.message);
      renderChrome();
      if (!opts.auto) Panels.toast('Enregistrement impossible : ' + plural(state.diagnostics.counts.error, 'conflit bloquant', 'conflits bloquants') + ' à résoudre (voir Diagnostic). Votre brouillon est conservé localement.', 'error', 7000);
      return false;
    }
    state.sync.status = 'saving';
    state.sync.pending = false;
    renderChrome();
    try {
      const result = await Sync.save({ expectedRevision: state.revision, payload: state.data, action: opts.action || 'SAVE', summary: opts.summary || undefined });
      state.revision = result.revision;
      state.sync.latestRevision = result.revision;
      state.sync.lastSavedAt = result.updatedAt ? new Date(result.updatedAt) : new Date();
      state.sync.lastSavedBy = state.viewer ? { id: state.viewer.id, name: state.viewer.name, role: state.viewer.role } : null;
      state.sync.errors = [];
      if (state.sync.pending) {
        state.sync.pending = false;
        state.sync.status = 'dirty';
        Sync.draft.save(state.data, state.revision);
        scheduleAutosave();
      } else {
        state.sync.status = 'saved';
        Sync.draft.clear();
      }
      renderChrome();
      if (!opts.auto) Panels.toast('Planning enregistré (révision ' + result.revision + ').', 'success', 2500);
      return true;
    } catch (err) {
      return handleSaveError(err, opts);
    }
  }

  function handleSaveError(err, opts) {
    const status = err && err.status;
    const body = (err && err.body) || {};
    if (status === 409) {
      state.sync.status = 'conflict';
      state.sync.latestRevision = body.currentRevision || state.sync.latestRevision;
      state.sync.latestBy = body.updatedBy || null;
      renderChrome();
      Panels.showConflictDialog(app, body);
    } else if (status === 422) {
      state.sync.status = 'invalid';
      state.sync.errors = (body.errors || []).concat((body.blocking || []).map((b) => b.message));
      renderChrome();
      Panels.toast('Non enregistré : ' + (body.errors && body.errors[0] ? body.errors[0] : 'planning refusé par le serveur') + ' Votre brouillon est conservé localement.', 'error', 8000);
    } else if (status === 401) {
      state.sync.status = 'error';
      renderChrome();
      Panels.toast('Session expirée : reconnectez-vous pour enregistrer (votre brouillon est conservé localement).', 'error', 10000);
    } else if (status === 403) {
      state.readOnly = true;
      state.sync.status = 'readonly';
      render();
      Panels.toast('Votre compte ne peut pas modifier le planning partagé.', 'error', 8000);
    } else {
      state.sync.status = 'error';
      state.sync.message = err && err.message ? err.message : 'Erreur réseau';
      renderChrome();
      if (!opts.auto) Panels.toast('Erreur d\'enregistrement : ' + state.sync.message + '. Nouvel essai à la prochaine modification ou via Enregistrer.', 'error', 7000);
    }
    return false;
  }

  async function loadFromServer(opts) {
    opts = opts || {};
    if (state.sync.status === 'saving') return false;
    const wasDirty = isDirty();
    try {
      const doc = await Sync.fetchDocument();
      if (state.sync.status === 'saving' || (!wasDirty && isDirty())) {
        state.sync.status = 'conflict';
        renderChrome();
        Panels.showConflictDialog(app, { currentRevision: doc.document.revision, updatedBy: doc.document.updatedBy });
        return false;
      }
      applyServerDocument(doc);
      state.selectedId = null;
      state.swap = { a: null, b: null };
      state.highlightIds = new Set();
      render();
      if (!opts.silent) Panels.toast('Planning partagé rechargé (révision ' + state.revision + ').', 'success', 2500);
      return true;
    } catch (err) {
      if (err && err.status === 401) { global.location.href = (Sync.config && Sync.config.signinPath) || '/auth/signin'; return false; }
      Panels.toast('Impossible de charger le planning partagé : ' + (err && err.message ? err.message : 'erreur'), 'error', 8000);
      return false;
    }
  }

  async function refreshFromServer() {
    if (!isIntegrated() || state.sync.status === 'saving') return;
    if (isDirty()) {
      const ok = await Panels.confirmDialog({
        title: 'Recharger la version enregistrée',
        message: 'Vous avez des modifications non enregistrées. Recharger la version du serveur les remplacera à l\'écran (le brouillon local est conservé jusqu\'au prochain enregistrement).',
        confirmLabel: 'Recharger', danger: true
      });
      if (!ok) return;
    }
    await loadFromServer();
  }

  async function checkLatest() {
    if (!isIntegrated() || state.sync.status === 'saving' || document.hidden) return;
    try {
      const meta = await Sync.fetchMeta();
      const latest = meta.document.revision;
      if (latest <= state.revision) return;
      state.sync.latestRevision = latest;
      state.sync.latestBy = meta.document.updatedBy || null;
      if (state.sync.status === 'saved' || state.sync.status === 'readonly') {
        await loadFromServer({ silent: true });
        Panels.toast('Planning mis à jour par ' + ((meta.document.updatedBy && meta.document.updatedBy.name) || 'un autre utilisateur') + ' (révision ' + latest + ').', '', 5000);
      } else {
        renderChrome();
      }
    } catch (e) {
      if (e && e.status === 401) {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        global.location.href = (Sync.config && Sync.config.signinPath) || '/auth/signin';
        return;
      }
      if (e && e.status === 404) {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        Panels.toast('Planning introuvable sur le serveur. Synchronisation interrompue.', 'error', 8000);
        return;
      }
      /* erreurs réseau transitoires : le sondage continuera */
    }
  }

  function exportDraft() {
    download(toExportJson(state.data), 'nexus-planning-brouillon-' + Nexus.todayIso() + '.json', 'application/json;charset=utf-8');
    Panels.toast('Brouillon exporté en JSON.', 'success');
  }

  async function restoreRevision(revision) {
    if (!isIntegrated() || !(state.permissions && state.permissions.canRestore)) return;
    const ok = await Panels.confirmDialog({
      title: 'Restaurer la révision ' + revision,
      message: 'Le planning partagé reviendra au contenu de la révision ' + revision + '. Une nouvelle révision sera créée : l\'historique reste intact.',
      confirmLabel: 'Restaurer', danger: true
    });
    if (!ok) return;
    try {
      const result = await Sync.restore({ revision: revision, expectedRevision: state.revision });
      Panels.closeModal();
      await loadFromServer({ silent: true });
      Panels.toast('Révision ' + revision + ' restaurée (nouvelle révision ' + result.revision + ').', 'success', 5000);
    } catch (err) {
      handleSaveError(err, {});
    }
  }

  async function exportRevision(revision) {
    try {
      const row = await Sync.getRevision(revision);
      download(JSON.stringify(row.payload, null, 2), 'nexus-planning-revision-' + revision + '.json', 'application/json;charset=utf-8');
    } catch (err) {
      Panels.toast('Export impossible : ' + (err && err.message), 'error');
    }
  }

  function undo() {
    if (state.readOnly) return;
    const r = history.undo(state.data);
    if (!r) return;
    state.data = normalize(r.data);
    afterChange();
    Panels.toast('Annulé : ' + (r.label || 'dernière opération'), 'success', 2500);
  }
  function redo() {
    if (state.readOnly) return;
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
    const oldRoomId = s.roomId;
    commit(label || 'Déplacement de ' + sessionLabel(state.data, s), (d) => {
      const x = d.sessions.find((y) => y.id === id);
      if (!x) return;
      x.day = patch.day; x.start = patch.start; x.end = patch.end;
      if (patch.roomId) x.roomId = patch.roomId;
    });
    const after = getSession(id);
    const diag = state.diagnostics.bySession.get(id);
    const roomChanged = patch.roomId && patch.roomId !== oldRoomId;
    const where = dayLabel(after.day) + ' ' + fmtRange(after.start, after.end) + (roomChanged ? ' · ' + Nexus.roomName(state.data, patch.roomId) : '');
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
    const filename = exportFileName('json', state.data);
    download(toExportJson(state.data), filename, 'application/json;charset=utf-8');
    Panels.toast('Export JSON créé : ' + filename, 'success');
  }
  function exportCsv() {
    const filename = exportFileName('csv', state.data);
    download(toCsv(state.data), filename, 'text/csv;charset=utf-8');
    Panels.toast('Export CSV créé (compatible Excel, séparateur « ; ») : ' + filename, 'success');
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
  function replaceData(raw, label, message, opts) {
    opts = opts || {};
    const ok = commit(label, (d) => {
      const next = normalize(raw);
      Object.keys(d).forEach((k) => { delete d[k]; });
      Object.assign(d, next);
    });
    if (!ok) return;
    state.selectedId = null;
    state.swap = { a: null, b: null };
    state.highlightIds = new Set();
    render();
    if (message) Panels.toast(message, 'success');
    if (isIntegrated()) saveToServer({ action: opts.action || 'IMPORT', summary: label });
  }
  function resetToDefault() {
    if (isIntegrated()) {
      if (!(state.permissions && state.permissions.canReset)) { Panels.toast('Réinitialisation réservée à la direction.', 'warning'); return; }
      Panels.confirmDialog({
        title: 'Réinitialiser au planning initial',
        message: 'Remplacer le planning partagé par le planning initial livré avec l\'application (' + plural(defaultData.sessions.length, 'séance') + ') ?',
        detail: 'Une nouvelle révision sera créée ; les révisions précédentes restent restaurables depuis l\'historique.',
        confirmLabel: 'Réinitialiser', danger: true
      }).then(async (ok) => {
        if (!ok) return;
        try {
          const result = await Sync.reset({ expectedRevision: state.revision });
          await loadFromServer({ silent: true });
          Panels.toast('Planning initial restauré (révision ' + result.revision + ').', 'success');
        } catch (err) { handleSaveError(err, {}); }
      });
      return;
    }
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
    document.querySelectorAll('#viewSwitch button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === state.view)));
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

    // Filtres replies : le bouton porte le nombre actif et le resume dit
    // lesquels. Sans cela, une semaine filtree ressemble a une semaine vide.
    const activeCount = activeFilterCount();
    const countEl = $('filterCount');
    countEl.textContent = activeCount ? String(activeCount) : '';
    countEl.hidden = activeCount === 0;
    $('btnFilters').classList.toggle('has-active', activeCount > 0);
    $('btnFilters').setAttribute('aria-label', activeCount
      ? 'Filtres, ' + activeCount + ' actif' + (activeCount > 1 ? 's' : '')
      : 'Filtres');
    const summary = $('filterSummary');
    summary.hidden = activeCount === 0;
    $('filterSummaryText').textContent = filterSummary();

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
      isDraggable: (id) => { const s = getSession(id); return Boolean(s && s.active && !state.readOnly); },
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
    const txt = st.querySelector('.txt');
    if (isIntegrated()) {
      const s = state.sync.status;
      st.className = 'save-status ' + (s === 'saved' ? '' : s);
      const when = state.sync.lastSavedAt ? state.sync.lastSavedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
      const label = Sync.STATUS_LABELS[s] || s;
      txt.textContent = label + (state.revision != null ? ' · rév. ' + state.revision : '') + (s === 'saved' && when ? ' · ' + when : '') + (s === 'conflict' && state.sync.latestRevision ? ' (serveur : rév. ' + state.sync.latestRevision + ')' : '');
      st.title = state.sync.errors && state.sync.errors.length ? state.sync.errors.join('\n') : (state.sync.lastSavedBy ? 'Dernier enregistrement par ' + state.sync.lastSavedBy.name : '');
      $('btnSave').hidden = state.readOnly;
      $('btnSave').disabled = !['dirty', 'error', 'invalid', 'conflict'].includes(s);
      $('btnRefresh').hidden = false;
      $('btnNewSession').hidden = state.readOnly;
      $('btnImport').hidden = state.readOnly || !(state.permissions && state.permissions.canImport);
      $('btnReset').hidden = !(state.permissions && state.permissions.canReset);
      $('btnUndo').hidden = state.readOnly;
      $('btnRedo').hidden = state.readOnly;
    } else {
      st.className = 'save-status ' + (state.saveStatus === 'saved' ? '' : state.saveStatus);
      if (!state.storageOk) txt.textContent = 'Non sauvegardé : stockage local indisponible';
      else if (state.saveStatus === 'saved') txt.textContent = 'Sauvegardé' + (state.savedAt ? ' · ' + state.savedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '');
      else txt.textContent = 'Échec de la sauvegarde locale';
    }

    const g = globalStats(state.data);
    const normal = state.data.rooms.filter((r) => r.active && !r.exceptional).length;
    const exc = state.data.rooms.filter((r) => r.active && r.exceptional).length;
    const c = state.diagnostics.counts;
    const bar = $('statusbar');
    clear(bar);
    // Les elements marques `sb-detail` sont masques sur ecran etroit : la barre
    // se reduit alors a un resume lisible plutot que d'etre tronquee au milieu
    // d'un mot derriere un defilement horizontal invisible.
    const item = (txt2) => h('span', { class: 'sb-detail' }, txt2);
    const sep = () => h('span', { class: 'sep sb-detail' }, '|');
    bar.appendChild(h('span', null, [h('strong', null, String(g.sessions)), ' séances actives' + (g.inactive ? ' (' + g.inactive + ' inactive' + (g.inactive > 1 ? 's' : '') + ')' : '')]));
    bar.appendChild(sep());
    bar.appendChild(h('span', { class: 'sb-detail' }, [h('strong', null, Nexus.fmtHours(g.minutes)), ' de cours / semaine']));
    bar.appendChild(sep());
    bar.appendChild(item(plural(state.data.teachers.filter((t) => t.active).length, 'enseignant')));
    bar.appendChild(sep());
    bar.appendChild(item(plural(normal, 'salle normale', 'salles normales') + (exc ? ' + ' + plural(exc, 'exceptionnelle') : '')));
    bar.appendChild(sep());
    bar.appendChild(h('span', { class: c.error ? 'chip error' : 'chip success' }, c.error ? plural(c.error, 'conflit bloquant', 'conflits bloquants') : 'Aucun conflit bloquant'));
    if (c.warning) bar.appendChild(h('span', { class: 'chip warning' }, plural(c.warning, 'avertissement')));
    if (c.info) bar.appendChild(h('span', { class: 'chip info' }, plural(c.info, 'conseil')));
    if (isIntegrated()) {
      const by = state.sync.lastSavedBy && state.sync.lastSavedBy.name ? ' par ' + state.sync.lastSavedBy.name : '';
      bar.appendChild(h('span', { class: 'right' }, [
        state.readOnly ? h('span', { class: 'chip readonly', style: { marginRight: '8px' } }, 'Lecture seule') : null,
        h('span', { class: 'sb-detail' }, 'Planning partagé · '),
        'révision ' + (state.revision != null ? state.revision : '—') + by + (state.sync.latestRevision && state.sync.latestRevision > state.revision ? ' · version plus récente disponible (rév. ' + state.sync.latestRevision + ')' : '')
      ]));
    } else {
      bar.appendChild(h('span', { class: 'right sb-detail' }, 'Ctrl+Z annuler · Ctrl+Shift+Z rétablir · Échap fermer'));
    }
    document.title = 'Nexus Planning Studio — ' + state.data.settings.academicYear + (c.error ? ' (' + c.error + ' conflit' + (c.error > 1 ? 's' : '') + ')' : '');
  }

  // Un clic sur le voile referme le panneau : la semaine entiere redevient
  // visible sans chercher le bouton de fermeture.
  function bindScrim() {
    const scrim = $('sideScrim');
    if (scrim) scrim.addEventListener('click', closeSide);
  }

  function openSide() { document.body.classList.add('side-open'); document.body.classList.remove('side-collapsed'); $('btnSide').setAttribute('aria-pressed', 'true'); }
  function closeSide() {
    document.body.classList.remove('side-open');
    $('btnSide').setAttribute('aria-pressed', String(isNarrow() ? false : !document.body.classList.contains('side-collapsed')));
  }

  /* ---------------------------------------------------------------
     Événements
     --------------------------------------------------------------- */
  function bindEvents() {
    /* Menu « plus d'actions » : les actions secondaires restent decouvrables
       sans defilement horizontal. Clavier et lecteurs d'ecran pris en charge. */
    const moreBtn = $('btnMore'), moreMenu = $('moreMenu');
    function closeMore(refocus) {
      if (moreMenu.hidden) return;
      moreMenu.hidden = true;
      moreBtn.setAttribute('aria-expanded', 'false');
      if (refocus) moreBtn.focus();
    }
    function openMore() {
      moreMenu.hidden = false;
      moreBtn.setAttribute('aria-expanded', 'true');
      const first = moreMenu.querySelector('.more-item:not([hidden])');
      if (first) first.focus();
    }
    moreBtn.addEventListener('click', (e) => { e.stopPropagation(); if (moreMenu.hidden) openMore(); else closeMore(true); });
    moreMenu.addEventListener('click', (e) => { if (e.target.closest('.more-item')) closeMore(false); });
    moreMenu.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeMore(true); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const items = Array.prototype.slice.call(moreMenu.querySelectorAll('.more-item:not([hidden])'));
      const at = items.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown' ? at + 1 : at - 1;
      items[(next + items.length) % items.length].focus();
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.more')) closeMore(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMore(true); });

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
    $('btnSave').addEventListener('click', () => saveToServer({ manual: true }));
    $('btnRefresh').addEventListener('click', refreshFromServer);
    global.addEventListener('beforeunload', (e) => {
      if (isDirty()) { e.preventDefault(); e.returnValue = ''; }
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkLatest(); });
    bindScrim();
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
    $('filterClearInline').addEventListener('click', clearFilters);

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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && isIntegrated()) { e.preventDefault(); saveToServer({ manual: true }); return; }
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
    if (Sync && Sync.isIntegrated()) { bootIntegrated(); return; }
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

  async function bootIntegrated() {
    state.mode = 'integrated';
    state.sync.status = 'loading';
    state.readOnly = true;
    defaultData = normalize(global.NEXUS_DEFAULT_PLANNING || { teachers: [], rooms: [], subjects: [], groups: [], sessions: [] });
    state.storageOk = Nexus.storageAvailable();
    const prefs = Nexus.loadPrefs();
    if (prefs.density === 'compact' || prefs.density === 'comfortable') { state.density = prefs.density; document.body.dataset.density = prefs.density; }
    if (prefs.sideCollapsed && !isNarrow()) { document.body.classList.add('side-collapsed'); $('btnSide').setAttribute('aria-pressed', 'false'); }
    state.data = defaultData;
    state.diagnostics = validate(state.data);
    bindEvents();
    renderChrome();
    let doc;
    try {
      doc = await Sync.fetchDocument();
    } catch (err) {
      if (err && err.status === 401) { global.location.href = (Sync.config && Sync.config.signinPath) || '/auth/signin'; return; }
      state.readOnly = true;
      state.sync.status = 'error';
      render();
      Panels.openModal({
        title: 'Planning partagé indisponible',
        narrow: true,
        body: h('p', null, 'Impossible de charger le planning depuis le serveur (' + (err && err.message ? err.message : 'erreur') + '). Le planning de démarrage est affiché en lecture seule.'),
        footer: [h('button', { type: 'button', class: 'btn primary', onclick: () => global.location.reload() }, 'Réessayer')]
      });
      return;
    }
    applyServerDocument(doc);
    state.viewTeacherId = (state.data.teachers.find((t) => t.active) || state.data.teachers[0] || {}).id || '';
    render();
    pollTimer = setInterval(checkLatest, POLL_INTERVAL_MS);
    if (doc.initialized) Panels.toast('Planning partagé initialisé depuis le planning livré (révision 1).', 'success', 6000);
    // Brouillon local non enregistré ?
    const draft = Sync.draft.load();
    if (draft && !state.readOnly) {
      const same = JSON.stringify(normalize(draft.data)) === JSON.stringify(state.data);
      if (same) Sync.draft.clear();
      else Panels.showDraftDialog(app, draft);
    } else if (draft) {
      Sync.draft.clear();
    }
  }

  function adoptDraft(draft) {
    if (draft.baseRevision !== state.revision) {
      Panels.toast('Ce brouillon est basé sur la révision ' + draft.baseRevision + ' ; le serveur est à la révision ' + state.revision + '. Il est exporté pour comparaison, pas appliqué.', 'warning', 8000);
      download(toExportJson(normalize(draft.data)), 'nexus-planning-brouillon-rev' + draft.baseRevision + '.json', 'application/json;charset=utf-8');
      Sync.draft.clear();
      return;
    }
    history.push(state.data, 'Reprise du brouillon local');
    state.data = normalize(draft.data);
    state.diagnostics = validate(state.data);
    state.sync.status = 'dirty';
    render();
    scheduleAutosave();
    Panels.toast('Brouillon local repris : il sera enregistré automatiquement.', 'success', 4000);
  }

  const app = {
    state, history,
    isIntegrated, isDirty, canEdit: () => !state.readOnly,
    saveToServer, refreshFromServer, loadFromServer, exportDraft, restoreRevision, exportRevision, adoptDraft,
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
