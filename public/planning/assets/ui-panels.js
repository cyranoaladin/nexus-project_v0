/* =====================================================================
   NEXUS PLANNING STUDIO — ui-panels.js
   Panneaux : éditeur de séance, diagnostic, charge / statistiques,
   légende, barre d'échange, modales (configuration, import, confirmation),
   notifications.
   ===================================================================== */
(function (global) {
  'use strict';
  const Nexus = global.Nexus;
  const { h, clear, option, fillSelect, DAYS, LEVELS, AUDIENCES, VARIANTS, SEVERITY_LABEL, parseTime, isValidTime, fmtTime, fmtRange, fmtHours, fmtDuration,
    dayLabel, levelLabel, audienceLabel, audienceBadge, sessionLabel, sessionWhen, sessionMinutes, teacherStats, roomStats, globalStats,
    findFreeSlots, previewConflicts, rgba, initials, plural, deepClone, isValidHex, slugify, sortSessions } = Nexus;

  /* ---------------------------------------------------------------
     Notifications
     --------------------------------------------------------------- */
  function toast(message, type, ms) {
    const root = document.getElementById('toasts');
    if (!root) return;
    const el = h('div', { class: ['toast', type || ''], role: 'status' }, [
      h('span', null, message),
      h('button', { type: 'button', 'aria-label': 'Fermer', onclick: () => el.remove() }, '×')
    ]);
    root.appendChild(el);
    while (root.children.length > 3) root.firstChild.remove();
    setTimeout(() => { if (el.parentNode) el.remove(); }, ms || (type === 'error' ? 7000 : 3800));
  }

  /* ---------------------------------------------------------------
     Modales
     --------------------------------------------------------------- */
  let activeModal = null;

  function openModal(opts) {
    closeModal();
    const root = document.getElementById('modalRoot');
    const modal = h('div', { class: ['modal', opts.narrow && 'narrow'], role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'modalTitle' }, [
      h('div', { class: 'modal-head' }, [
        h('h2', { id: 'modalTitle' }, opts.title),
        h('button', { type: 'button', class: 'btn ghost icon', 'aria-label': 'Fermer', onclick: () => closeModal() }, '✕')
      ]),
      opts.tabs ? h('div', { class: 'modal-tabs', role: 'tablist' }, opts.tabs) : null,
      h('div', { class: 'modal-body' }, opts.body),
      opts.footer ? h('div', { class: 'modal-foot' }, opts.footer) : null
    ]);
    clear(root);
    root.appendChild(h('div', { class: 'modal-backdrop', onclick: () => { if (!opts.blocking) closeModal(); } }));
    root.appendChild(modal);
    root.classList.add('open');
    activeModal = { opts, modal, rerender: opts.rerender || null };
    const focusable = modal.querySelector('input, select, textarea, button:not(.icon)');
    if (focusable) setTimeout(() => focusable.focus(), 10);
    return modal;
  }

  function closeModal() {
    const root = document.getElementById('modalRoot');
    if (!root) return;
    if (activeModal && activeModal.opts.onClose) activeModal.opts.onClose();
    clear(root);
    root.classList.remove('open');
    activeModal = null;
  }

  function refreshModal() {
    if (activeModal && activeModal.rerender) activeModal.rerender();
  }

  function isModalOpen() { return Boolean(activeModal); }

  function confirmDialog(opts) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (done) return; done = true; closeModal(); resolve(v); };
      openModal({
        title: opts.title,
        narrow: true,
        body: h('div', { class: 'stack' }, [
          typeof opts.message === 'string' ? h('p', null, opts.message) : opts.message,
          opts.detail ? h('p', { class: 'help' }, opts.detail) : null
        ]),
        footer: [
          h('button', { type: 'button', class: 'btn', onclick: () => finish(false) }, opts.cancelLabel || 'Annuler'),
          h('button', { type: 'button', class: ['btn', opts.danger ? 'danger' : 'primary'], onclick: () => finish(true) }, opts.confirmLabel || 'Confirmer')
        ],
        onClose: () => finish(false)
      });
    });
  }

  /* ---------------------------------------------------------------
     Helpers de formulaire
     --------------------------------------------------------------- */
  function field(label, control, hint) {
    const id = control.id || (control.id = 'f-' + Math.random().toString(36).slice(2, 8));
    return h('div', { class: 'field' }, [h('label', { for: id }, label), control, hint ? h('span', { class: 'hint' }, hint) : null]);
  }
  function selectOf(items, current, attrs, placeholder) {
    const sel = h('select', Object.assign({ class: 'select' }, attrs || {}));
    fillSelect(sel, items, current, placeholder);
    return sel;
  }
  function switchOf(label, checked, onchange, attrs) {
    const input = h('input', Object.assign({ type: 'checkbox', checked: checked, onchange: onchange }, attrs || {}));
    return h('label', { class: 'switch' }, [input, h('span', { class: 'track' }), label]);
  }

  /* ---------------------------------------------------------------
     Éditeur de séance
     --------------------------------------------------------------- */
  const editor = { id: null, draft: null, dirty: false };

  function editorHasUnsaved(id) {
    return editor.dirty && editor.id === id;
  }

  function renderEditor(container, app) {
    const { data, diagnostics, selectedId } = app.state;
    clear(container);
    const session = data.sessions.find((s) => s.id === selectedId);
    const readOnly = Boolean(app.state.readOnly);
    if (!session) {
      editor.id = null; editor.draft = null; editor.dirty = false;
      container.appendChild(h('div', { class: 'empty-state' }, readOnly ? [
        h('strong', null, 'Aucune séance sélectionnée'),
        h('span', null, 'Cliquez sur une carte pour voir son détail. Votre compte consulte le planning partagé en lecture seule.')
      ] : [
        h('strong', null, 'Aucune séance sélectionnée'),
        h('span', null, 'Cliquez sur une carte du planning pour la modifier, glissez-la pour la déplacer, ou créez une nouvelle séance.'),
        h('button', { type: 'button', class: 'btn primary', onclick: () => app.addSession() }, '+ Nouvelle séance'),
        h('span', { class: 'help' }, 'Astuce : Ctrl + clic sur une seconde carte pour préparer un échange de créneaux.')
      ]));
      return;
    }
    if (readOnly) {
      renderReadOnlySession(container, app, session);
      return;
    }
    if (editor.id !== session.id || !editor.draft) {
      editor.id = session.id;
      editor.draft = deepClone(session);
      editor.dirty = false;
    }
    const d = editor.draft;
    const subject = data.subjects.find((s) => s.id === d.subjectId);
    const color = subject ? subject.color : '#64748B';
    const diag = diagnostics.bySession.get(session.id);

    const head = h('div', { class: 'editor-head', style: { '--subject': color } }, [
      h('div', { style: { flex: 1, minWidth: 0 } }, [
        h('div', { class: 'title' }, sessionLabel(data, session)),
        h('div', { class: 'when' }, sessionWhen(session) + ' · ' + Nexus.roomName(data, session.roomId) + ' · ' + Nexus.teacherName(data, session.teacherId)),
        !session.active ? h('div', { class: 'chip warning', style: { marginTop: '4px' } }, 'Séance désactivée') : null
      ])
    ]);

    // ---- champs
    const errors = {};
    const inputs = {};
    const mark = (name, input) => { inputs[name] = input; input.id = 'sess-' + name; return input; };
    const onChange = (name, transform) => (ev) => {
      const v = transform ? transform(ev.target) : ev.target.value;
      d[name] = v;
      editor.dirty = true;
      if (name === 'groupId' && v) {
        const g = data.groups.find((x) => x.id === v);
        if (g) { d.level = g.level; d.audience = g.audience; inputs.level.value = g.level; inputs.audience.value = g.audience; }
      }
      if (name === 'level' || name === 'audience') refreshGroupOptions();
      refreshPreview();
    };

    const groupItems = () => data.groups
      .filter((g) => g.level === d.level && g.audience === d.audience || g.id === d.groupId)
      .map((g) => ({ value: g.id, label: levelLabel(g.level) + ' · ' + g.label + (g.variant ? ' (parcours ' + g.variant + ')' : '') }));
    const groupSelect = mark('groupId', selectOf(groupItems(), d.groupId, { onchange: onChange('groupId') }, '— Aucun groupe —'));
    function refreshGroupOptions() { fillSelect(groupSelect, groupItems(), d.groupId, '— Aucun groupe —'); }

    const form = h('form', { class: 'stack', novalidate: true, onsubmit: (ev) => { ev.preventDefault(); apply(); } }, [
      field('Intitulé (facultatif)', mark('title', h('input', { class: 'input', type: 'text', value: d.title, placeholder: 'ex. Terminale — Maths A', oninput: onChange('title') })), 'Laissé vide, la carte affiche matière, niveau et groupe.'),
      h('div', { class: 'row' }, [
        field('Jour', mark('day', selectOf(DAYS.map((x) => ({ value: x.id, label: x.label })), d.day, { onchange: onChange('day') }))),
        field('Public', mark('audience', selectOf(AUDIENCES.map((a) => ({ value: a.id, label: a.label })), d.audience, { onchange: onChange('audience') })))
      ]),
      h('div', { class: 'row' }, [
        field('Début', mark('start', h('input', { class: 'input', type: 'time', step: 300, value: d.start, required: true, oninput: onChange('start') }))),
        field('Fin', mark('end', h('input', { class: 'input', type: 'time', step: 300, value: d.end, required: true, oninput: onChange('end') })))
      ]),
      h('div', { class: 'row' }, [
        field('Niveau', mark('level', selectOf(LEVELS.map((l) => ({ value: l.id, label: l.label })), d.level, { onchange: onChange('level') }))),
        field('Matière', mark('subjectId', selectOf(data.subjects.filter((s) => s.active || s.id === d.subjectId).map((s) => ({ value: s.id, label: s.label })), d.subjectId, { onchange: onChange('subjectId') })))
      ]),
      field('Groupe', groupSelect, 'Le groupe porte le parcours Maths A / Maths B. Gérer les groupes dans Configuration.'),
      h('div', { class: 'row' }, [
        field('Enseignant', mark('teacherId', selectOf(data.teachers.filter((t) => t.active || t.id === d.teacherId).map((t) => ({ value: t.id, label: t.name + ' (' + t.code + ')' + (t.active ? '' : ' — inactif') })), d.teacherId, { onchange: onChange('teacherId') }, '— Non affecté —'))),
        field('Salle', mark('roomId', selectOf(data.rooms.filter((r) => r.active || r.id === d.roomId).map((r) => ({ value: r.id, label: r.name + (r.exceptional ? ' (exceptionnelle)' : '') })), d.roomId, { onchange: onChange('roomId') }, '— Non affectée —')))
      ]),
      field('Notes', mark('notes', h('textarea', { class: 'textarea', rows: 2, value: d.notes, oninput: onChange('notes') }))),
      switchOf('Séance active (occupe salle et enseignant)', d.active, onChange('active', (t) => t.checked)),
      h('div', { class: 'preview', id: 'editorPreview' }),
      h('div', { class: 'form-actions' }, [
        h('button', { type: 'submit', class: 'btn primary', id: 'btnApply' }, 'Appliquer'),
        h('button', { type: 'button', class: 'btn', onclick: () => { editor.draft = deepClone(session); editor.dirty = false; app.renderSide(); } }, 'Annuler')
      ])
    ]);

    const previewBox = form.querySelector('#editorPreview');
    function refreshPreview() {
      clear(previewBox);
      const changed = JSON.stringify(d) !== JSON.stringify(session);
      if (!changed) return;
      const check = validateDraft(d);
      if (check.length) {
        previewBox.appendChild(h('div', { class: 'inline-danger' }, check.map((m) => h('span', null, m))));
        return;
      }
      const res = previewConflicts(data, d);
      const relevant = res.issues.filter((i) => i.severity !== 'info');
      if (!relevant.length) {
        previewBox.appendChild(h('div', { class: 'inline-info' }, 'Modifications non enregistrées : aucun conflit détecté pour ce créneau.'));
      } else {
        previewBox.appendChild(h('div', { class: res.severity === 'error' ? 'inline-danger' : 'inline-warning' }, [
          h('strong', null, res.severity === 'error' ? 'Conflit bloquant si vous appliquez :' : 'Avertissement si vous appliquez :'),
          h('ul', { style: { margin: '4px 0 0', paddingLeft: '18px' } }, relevant.slice(0, 4).map((i) => h('li', null, i.message)))
        ]));
      }
    }

    function validateDraft(x) {
      const out = [];
      if (!isValidTime(x.start)) out.push('L\'heure de début est manquante ou invalide.');
      if (!isValidTime(x.end)) out.push('L\'heure de fin est manquante ou invalide.');
      if (isValidTime(x.start) && isValidTime(x.end) && parseTime(x.end) <= parseTime(x.start)) out.push('L\'heure de fin doit être postérieure à l\'heure de début (une séance ne peut pas dépasser minuit).');
      if (!x.subjectId) out.push('Choisissez une matière.');
      return out;
    }

    function apply() {
      const problems = validateDraft(d);
      inputs.start.setAttribute('aria-invalid', String(!isValidTime(d.start) || (isValidTime(d.end) && parseTime(d.end) <= parseTime(d.start))));
      inputs.end.setAttribute('aria-invalid', String(!isValidTime(d.end) || (isValidTime(d.start) && parseTime(d.end) <= parseTime(d.start))));
      if (problems.length) {
        clear(previewBox);
        previewBox.appendChild(h('div', { class: 'inline-danger' }, problems.map((m) => h('span', null, m))));
        toast('Corrigez le formulaire avant d\'appliquer.', 'error');
        return;
      }
      editor.dirty = false;
      app.updateSession(session.id, deepClone(d));
    }

    // ---- diagnostic de la séance
    const diagBox = diag ? h('div', { class: 'stack' }, [
      h('div', { class: 'section-title' }, 'Diagnostic de cette séance'),
      h('div', { class: 'issue-list' }, diag.issues.filter((i) => i.code !== 'INACTIVE_SESSIONS').map((i) => issueButton(i, app)))
    ]) : null;

    // ---- créneaux disponibles
    const slotsDetails = h('details', { class: 'box' }, [
      h('summary', null, 'Créneaux disponibles pour cette séance'),
      h('div', { class: 'content' })
    ]);
    slotsDetails.addEventListener('toggle', () => {
      const content = slotsDetails.querySelector('.content');
      clear(content);
      if (!slotsDetails.open) return;
      const slots = findFreeSlots(data, session, { limit: 14 });
      if (!slots.length) { content.appendChild(h('p', { class: 'help' }, 'Aucun créneau standard libre avec cet enseignant et ce groupe. Essayez un autre jour ou une autre durée.')); return; }
      content.appendChild(h('p', { class: 'help', style: { marginBottom: '6px' } }, 'Créneaux standards où l\'enseignant, le groupe et une salle normale sont libres (durée conservée). Cliquer pour déplacer.'));
      content.appendChild(h('div', { class: 'slot-list' }, slots.map((sl) => h('button', {
        type: 'button', onclick: () => app.moveSession(session.id, { day: sl.day, start: sl.start, end: sl.end, roomId: sl.roomId }, 'Déplacement vers un créneau libre')
      }, [h('span', { style: { color: 'inherit' } }, dayLabel(sl.day) + ' ' + fmtRange(sl.start, sl.end)), h('span', null, sl.roomName)]))));
    });

    // ---- actions
    const actions = h('div', { class: 'editor-actions' }, [
      h('button', { type: 'button', class: 'btn', onclick: () => app.startSwap(session.id), title: 'Échanger jour, horaire et salle avec une autre séance' }, '⇄ Interchanger avec…'),
      h('button', { type: 'button', class: 'btn', onclick: () => app.duplicateSession(session.id) }, 'Dupliquer'),
      h('button', { type: 'button', class: 'btn', onclick: () => app.toggleSession(session.id) }, session.active ? 'Désactiver' : 'Réactiver'),
      h('button', { type: 'button', class: 'btn danger-outline', onclick: () => app.deleteSession(session.id) }, 'Supprimer')
    ]);

    container.appendChild(h('div', { class: 'stack' }, [head, actions, form, slotsDetails, diagBox]));
    refreshPreview();
  }

  function renderReadOnlySession(container, app, session) {
    const { data, diagnostics } = app.state;
    const subject = data.subjects.find((s) => s.id === session.subjectId);
    const diag = diagnostics.bySession.get(session.id);
    const group = data.groups.find((g) => g.id === session.groupId);
    const teacher = data.teachers.find((t) => t.id === session.teacherId);
    const dl = h('dl', { class: 'readonly-card', style: { '--subject': subject ? subject.color : '#64748B' } }, [
      h('dt', null, 'Séance'), h('dd', null, sessionLabel(data, session)),
      h('dt', null, 'Créneau'), h('dd', null, sessionWhen(session)),
      h('dt', null, 'Enseignant'), h('dd', null, teacher ? teacher.name + ' (' + teacher.code + ')' : '—'),
      h('dt', null, 'Salle'), h('dd', null, Nexus.roomName(data, session.roomId)),
      h('dt', null, 'Groupe'), h('dd', null, group ? levelLabel(group.level) + ' · ' + group.label + (group.variant ? ' (Maths ' + group.variant + ')' : '') : '—'),
      h('dt', null, 'Public'), h('dd', null, audienceLabel(session.audience)),
      session.title ? h('dt', null, 'Intitulé') : null, session.title ? h('dd', null, session.title) : null,
      session.notes ? h('dt', null, 'Notes') : null, session.notes ? h('dd', null, session.notes) : null,
      h('dt', null, 'Statut'), h('dd', null, session.active ? 'Active' : 'Désactivée')
    ]);
    container.appendChild(h('div', { class: 'stack' }, [
      h('div', { class: 'chip readonly' }, 'Lecture seule'),
      dl,
      diag ? h('div', null, [h('div', { class: 'section-title' }, 'Diagnostic de cette séance'), h('div', { class: 'issue-list' }, diag.issues.filter((i) => i.code !== 'INACTIVE_SESSIONS').map((i) => issueButton(i, app)))]) : null
    ]));
  }

  function issueButton(issue, app, active) {
    return h('button', { type: 'button', class: ['issue', issue.severity, active && 'active'], onclick: () => app.focusIssue(issue) }, [
      h('span', { class: 'sev' }, issue.severity === 'error' ? 'Erreur' : issue.severity === 'warning' ? 'Avert.' : 'Conseil'),
      h('span', { class: 'body' }, [h('strong', null, issue.title), h('span', null, issue.message)])
    ]);
  }

  /* ---------------------------------------------------------------
     Diagnostic
     --------------------------------------------------------------- */
  function renderDiagnostics(container, app) {
    const { diagnostics, diagFilter, activeIssueId } = app.state;
    clear(container);
    const c = diagnostics.counts;
    const summary = h('div', { class: 'diag-summary' }, ['error', 'warning', 'info'].map((sev) => h('button', {
      type: 'button', class: sev, 'aria-pressed': String(diagFilter === sev),
      onclick: () => app.setDiagFilter(diagFilter === sev ? null : sev)
    }, [h('b', null, String(c[sev])), h('span', null, sev === 'error' ? (c.error > 1 ? 'erreurs' : 'erreur') : sev === 'warning' ? (c.warning > 1 ? 'avertissements' : 'avertissement') : (c.info > 1 ? 'conseils' : 'conseil'))])));
    container.appendChild(h('div', { class: 'panel-title' }, [h('h3', null, 'Diagnostic du planning'), h('button', { type: 'button', class: 'btn xs ghost', onclick: () => app.clearHighlight() }, 'Effacer la sélection')]));
    container.appendChild(summary);
    if (!c.error) container.appendChild(h('div', { class: 'diag-ok', style: { marginBottom: '10px' } }, ['✓ ', 'Aucun conflit bloquant']));
    const list = diagnostics.issues.filter((i) => !diagFilter || i.severity === diagFilter);
    if (!list.length) {
      container.appendChild(h('p', { class: 'help' }, 'Rien à signaler dans cette catégorie.'));
      return;
    }
    container.appendChild(h('p', { class: 'help', style: { marginBottom: '8px' } }, 'Cliquer sur une anomalie met en évidence les séances concernées dans le planning.'));
    container.appendChild(h('div', { class: 'issue-list' }, list.map((i) => issueButton(i, app, activeIssueId === i.id))));
  }

  /* ---------------------------------------------------------------
     Charge / statistiques
     --------------------------------------------------------------- */
  function renderStats(container, app) {
    const { data, diagnostics } = app.state;
    clear(container);
    const g = globalStats(data);
    const normalRooms = data.rooms.filter((r) => r.active && !r.exceptional).length;
    container.appendChild(h('div', { class: 'panel-title' }, h('h3', null, 'Tableau de bord')));
    container.appendChild(h('div', { class: 'kpi-grid' }, [
      kpi(String(g.sessions), 'séances actives'),
      kpi(fmtHours(g.minutes), 'heures / sem.'),
      kpi(String(data.teachers.filter((t) => t.active).length), 'enseignants'),
      kpi(String(g.rooms), 'salles utilisées'),
      kpi(String(g.groups), 'groupes'),
      kpi(String(diagnostics.counts.error), diagnostics.counts.error > 1 ? 'erreurs' : 'erreur', diagnostics.counts.error ? 'error' : ''),
      kpi(String(diagnostics.counts.warning), diagnostics.counts.warning > 1 ? 'avertissements' : 'avertissement', diagnostics.counts.warning ? 'warning' : ''),
      kpi(String(g.inactive), 'inactives'),
      kpi(String(normalRooms), 'salles normales')
    ]));

    // enseignants
    container.appendChild(h('div', { class: 'section-title' }, ['Charge des enseignants', h('button', { type: 'button', class: 'btn xs ghost', onclick: () => app.openConfig('teachers') }, 'Gérer')]));
    const maxMinutes = Math.max(60, ...data.teachers.map((t) => teacherStats(data, t.id).minutes));
    container.appendChild(h('div', { class: 'stat-list' }, data.teachers.filter((t) => t.active).map((t) => {
      const st = teacherStats(data, t.id);
      return h('button', { type: 'button', class: 'stat-row', onclick: () => app.setView('teacher', { teacherId: t.id }), title: 'Voir le planning de ' + t.name }, [
        h('span', { class: 'avatar', style: { background: t.color } }, t.code.slice(0, 4)),
        h('span', { class: 'who' }, [
          h('strong', null, t.name),
          h('span', null, [st.days.length ? st.days.map((x) => x.slice(0, 3)).join(', ') : 'Aucune séance', st.subjects.length ? ' · ' + st.subjects.join(' / ') : '', st.idleMinutes ? ' · ' + fmtDuration(st.idleMinutes) + ' de creux' : '']),
          h('span', { class: 'bar' }, h('i', { style: { width: Math.round(st.minutes / maxMinutes * 100) + '%' } }))
        ]),
        h('span', { class: 'num' }, [h('b', null, fmtHours(st.minutes)), h('span', null, plural(st.sessions, 'séance'))])
      ]);
    })));

    // salles
    container.appendChild(h('div', { class: 'section-title' }, ['Occupation des salles', h('button', { type: 'button', class: 'btn xs ghost', onclick: () => app.openConfig('rooms') }, 'Gérer')]));
    container.appendChild(h('div', { class: 'stat-list' }, data.rooms.filter((r) => r.active).map((r) => {
      const st = roomStats(data, r.id);
      return h('button', { type: 'button', class: ['stat-row', r.exceptional && 'exceptional'], onclick: () => app.setView('room'), title: 'Vue par salles' }, [
        h('span', { class: 'who' }, [
          h('strong', null, [r.name, r.exceptional ? h('span', { class: 'chip gold', style: { marginLeft: '6px' } }, 'exceptionnelle') : null]),
          h('span', null, 'Capacité ' + r.capacity + ' · ' + Math.round(st.rate * 100) + ' % de la plage d\'ouverture'),
          h('span', { class: 'bar' }, h('i', { style: { width: Math.round(st.rate * 100) + '%' } }))
        ]),
        h('span', { class: 'num' }, [h('b', null, fmtHours(st.minutes)), h('span', null, plural(st.sessions, 'séance'))])
      ]);
    })));

    // groupes
    container.appendChild(h('div', { class: 'section-title' }, ['Heures par groupe', h('button', { type: 'button', class: 'btn xs ghost', onclick: () => app.openConfig('groups') }, 'Gérer')]));
    const byGroup = data.groups.map((gr) => {
      const list = data.sessions.filter((s) => s.active && s.groupId === gr.id);
      return { gr, minutes: list.reduce((a, s) => a + sessionMinutes(s), 0), sessions: list.length, days: new Set(list.map((s) => s.day)).size };
    }).filter((x) => x.sessions).sort((a, b) => Nexus.LEVEL_INDEX[a.gr.level] - Nexus.LEVEL_INDEX[b.gr.level] || a.gr.label.localeCompare(b.gr.label));
    container.appendChild(h('div', { class: 'stat-list' }, byGroup.map((x) => h('button', { type: 'button', class: 'stat-row', onclick: () => app.highlightGroup(x.gr.id) }, [
      h('span', { class: 'who' }, [
        h('strong', null, levelLabel(x.gr.level) + ' · ' + x.gr.label + (x.gr.variant ? ' (' + x.gr.variant + ')' : '')),
        h('span', null, audienceLabel(x.gr.audience) + ' · ' + plural(x.days, 'jour'))
      ]),
      h('span', { class: 'num' }, [h('b', null, fmtHours(x.minutes)), h('span', null, plural(x.sessions, 'séance'))])
    ]))));
  }

  function kpi(value, label, cls) {
    return h('div', { class: ['kpi', cls] }, [h('b', null, value), h('span', null, label)]);
  }

  /* ---------------------------------------------------------------
     En-tête de planning, légende, bannière enseignant, en-tête impression
     --------------------------------------------------------------- */
  function renderPlanningHead(container, app) {
    const { data, diagnostics, view } = app.state;
    const visible = app.visibleSessions();
    const active = visible.filter((s) => s.active);
    const minutes = active.reduce((a, s) => a + sessionMinutes(s), 0);
    const titles = { week: 'Semaine type', teacher: 'Planning enseignant', room: 'Occupation des salles', audience: 'Scolarisés / Candidats individuels', level: 'Vue par niveau', list: 'Liste des séances' };
    const subs = {
      week: 'Cliquez sur une séance pour la modifier · glissez pour déplacer (pas de 15 min) · Ctrl + clic pour préparer un échange.',
      teacher: 'Charge hebdomadaire et créneaux de l\'enseignant sélectionné. Les zones hachurées rouges sont ses indisponibilités.',
      room: 'Une colonne par salle dans chaque journée. La salle exceptionnelle est signalée en or.',
      audience: 'Colonne gauche : élèves scolarisés · colonne droite : candidats individuels.',
      level: 'Séances du niveau sélectionné ; les autres niveaux sont masqués.',
      list: 'Tableau trié par jour et heure. Cliquez sur une ligne pour ouvrir la séance.'
    };
    const filterText = app.filterSummary();
    clear(container);
    container.appendChild(h('div', null, [
      h('h2', null, [titles[view] || 'Planning', app.state.readOnly ? h('span', { class: 'chip readonly', style: { marginLeft: '8px', verticalAlign: 'middle' } }, 'Lecture seule') : null]),
      h('div', { class: 'sub hint' }, app.state.readOnly && view === 'week' ? 'Planning partagé consulté en lecture seule : filtres, vues, impression et export restent disponibles.' : (subs[view] || '')),
      filterText ? h('div', { class: 'sub' }, [h('span', { class: 'chip gold' }, 'Filtres : ' + filterText)]) : null
    ]));
    container.appendChild(h('div', { class: 'kpis' }, [
      kpi(String(active.length), 'séances'),
      kpi(fmtHours(minutes), 'heures'),
      kpi(String(new Set(active.map((s) => s.teacherId).filter(Boolean)).size), 'enseignants'),
      kpi(String(diagnostics.counts.error), diagnostics.counts.error > 1 ? 'erreurs' : 'erreur', diagnostics.counts.error ? 'error' : ''),
      kpi(String(diagnostics.counts.warning), diagnostics.counts.warning > 1 ? 'avertissements' : 'avertissement', diagnostics.counts.warning ? 'warning' : '')
    ]));
  }

  function renderTeacherBanner(container, app) {
    const { data, view, viewTeacherId } = app.state;
    const t = data.teachers.find((x) => x.id === viewTeacherId);
    if (view !== 'teacher' || !t) { container.hidden = true; clear(container); return; }
    const st = teacherStats(data, t.id);
    clear(container);
    container.hidden = false;
    container.appendChild(h('div', { class: 'avatar', style: { background: t.color } }, initials(t.name)));
    container.appendChild(h('div', { class: 'who' }, [
      h('strong', null, t.name + ' (' + t.code + ')'),
      h('span', null, [t.subjects.length ? 'Matières : ' + t.subjects.map((id) => Nexus.subjectShort(data, id)).join(', ') : 'Aucune matière déclarée', t.unavailability.length ? ' · ' + plural(t.unavailability.length, 'indisponibilité') : '', !t.active ? ' · inactif' : ''])
    ]));
    container.appendChild(h('div', { class: 'metrics' }, [
      metric(fmtHours(st.minutes), 'heures / sem.'),
      metric(String(st.sessions), 'séances'),
      metric(st.days.length ? st.days.map((x) => x.slice(0, 3)).join(' · ') : '—', 'jours'),
      metric(st.idleMinutes ? fmtDuration(st.idleMinutes) : '0', 'temps morts'),
      h('button', { type: 'button', class: 'btn sm', onclick: () => app.openConfig('teachers', t.id) }, 'Modifier la fiche')
    ]));
  }
  function metric(v, l) { return h('div', { class: 'metric' }, [h('b', null, v), h('span', null, l)]); }

  function renderLegend(container, app) {
    const { data } = app.state;
    const used = new Set(data.sessions.map((s) => s.subjectId));
    clear(container);
    container.appendChild(h('span', { class: 'title' }, 'Matières'));
    data.subjects.filter((s) => s.active && used.has(s.id)).forEach((s) => {
      container.appendChild(h('span', { class: 'item' }, [h('span', { class: 'swatch', style: { background: rgba(s.color, 0.15), borderColor: s.color } }), s.label]));
    });
    container.appendChild(h('span', { class: 'sep' }));
    container.appendChild(h('span', { class: 'title' }, 'Public'));
    container.appendChild(h('span', { class: 'item' }, [h('span', { class: 'badge-aud SCO' }, 'SCO'), 'Scolarisés']));
    container.appendChild(h('span', { class: 'item' }, [h('span', { class: 'badge-aud CL' }, 'CL'), 'Candidats individuels (bord double)']));
    container.appendChild(h('span', { class: 'sep' }));
    container.appendChild(h('span', { class: 'item' }, [h('span', { class: 'variant', style: { padding: '0 4px', borderRadius: '3px', background: 'rgba(11,31,58,.08)', fontWeight: 700 } }, 'Maths A'), 'Maths → NSI']));
    container.appendChild(h('span', { class: 'item' }, [h('span', { class: 'variant', style: { padding: '0 4px', borderRadius: '3px', background: 'rgba(11,31,58,.08)', fontWeight: 700 } }, 'Maths B'), 'Maths → Physique-Chimie']));
    container.appendChild(h('span', { class: 'sep' }));
    container.appendChild(h('span', { class: 'item' }, [h('span', { class: 'flag error' }, '!'), 'Conflit bloquant']));
    container.appendChild(h('span', { class: 'item' }, [h('span', { class: 'flag warning' }, '⚠'), 'Avertissement']));
    const exc = data.rooms.filter((r) => r.exceptional && r.active);
    if (exc.length) container.appendChild(h('span', { class: 'item' }, [h('span', { class: 'chip gold' }, exc.map((r) => r.name).join(', ')), 'salle exceptionnelle (pointillé or)']));
  }

  function renderPrintHeader(container, app) {
    const { data, view, viewTeacherId, viewLevel } = app.state;
    clear(container);
    const parts = [];
    if (view === 'teacher') { const t = data.teachers.find((x) => x.id === viewTeacherId); if (t) parts.push('Enseignant : ' + t.name); }
    if (view === 'level') parts.push('Niveau : ' + levelLabel(viewLevel));
    const f = app.filterSummary();
    if (f) parts.push('Filtres : ' + f);
    container.appendChild(h('div', null, [h('h1', null, data.meta.title || 'Planning Nexus Réussite'), h('div', { class: 'meta' }, parts.join(' · ') || 'Semaine type — toutes les séances actives')]));
    container.appendChild(h('div', { class: 'meta' }, 'Nexus Réussite · Année ' + data.settings.academicYear + ' · édité le ' + Nexus.nowLabel()));
  }

  /* ---------------------------------------------------------------
     Barre d'échange
     --------------------------------------------------------------- */
  function renderSwapbar(container, app) {
    const { data, swap } = app.state;
    clear(container);
    if (!swap.a) { container.hidden = true; return; }
    container.hidden = false;
    const a = data.sessions.find((s) => s.id === swap.a);
    const b = data.sessions.find((s) => s.id === swap.b);
    const slot = (label, s) => h('div', { class: 'slot' }, [h('small', null, label), h('strong', null, s ? sessionLabel(data, s) : '…'), h('span', null, s ? sessionWhen(s) + ' · ' + Nexus.roomName(data, s.roomId) : 'Cliquez sur la seconde séance dans le planning')]);
    container.appendChild(slot('Séance A', a));
    container.appendChild(h('span', { class: 'arrow', 'aria-hidden': 'true' }, '⇄'));
    container.appendChild(slot('Séance B', b));
    container.appendChild(h('span', { class: 'spacer' }));
    if (a && b) container.appendChild(h('button', { type: 'button', class: 'btn gold', onclick: () => app.performSwap() }, 'Interchanger les créneaux'));
    container.appendChild(h('button', { type: 'button', class: 'btn', onclick: () => app.cancelSwap() }, 'Annuler'));
  }

  /* ---------------------------------------------------------------
     Configuration : enseignants / salles / matières / groupes / paramètres
     --------------------------------------------------------------- */
  const config = { tab: 'teachers', editingId: null };

  function openConfig(app, tab, editingId) {
    config.tab = tab || config.tab || 'teachers';
    config.editingId = editingId || null;
    const tabs = [
      ['teachers', 'Enseignants'], ['rooms', 'Salles'], ['subjects', 'Matières'], ['groups', 'Groupes'], ['settings', 'Paramètres']
    ];
    if (app.state.mode === 'integrated' && app.state.permissions && app.state.permissions.canViewHistory) tabs.push(['history', 'Historique']);
    const body = h('div');
    const tabButtons = tabs.map(([id, label]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(config.tab === id), dataset: { tab: id }, onclick: () => { config.tab = id; config.editingId = null; rerender(); } }, label));
    function rerender() {
      const modal = activeModal && activeModal.modal;
      if (modal) modal.querySelectorAll('.modal-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === config.tab)));
      clear(body);
      const renderers = { teachers: renderTeachersConfig, rooms: renderRoomsConfig, subjects: renderSubjectsConfig, groups: renderGroupsConfig, settings: renderSettingsConfig, history: renderHistoryConfig };
      renderers[config.tab](body, app);
    }
    openModal({ title: 'Configuration du planificateur', tabs: tabButtons, body, rerender, footer: [h('button', { type: 'button', class: 'btn primary', onclick: () => closeModal() }, 'Fermer')] });
    rerender();
  }

  function usageCount(data, key, id) {
    return data.sessions.filter((s) => s[key] === id).length;
  }

  function deleteWithReassign(app, opts) {
    // opts : { label, count, alternatives:[{value,label}], onConfirm(replacementId) }
    const sel = selectOf(opts.alternatives, '', { class: 'select' }, '— Laisser vide (avertissement) —');
    confirmDialog({
      title: 'Supprimer ' + opts.label,
      danger: true,
      confirmLabel: 'Supprimer',
      message: h('div', { class: 'stack' }, [
        h('p', null, opts.count ? plural(opts.count, 'séance') + ' font référence à cet élément (séances actives et inactives).' : 'Aucune séance ne fait référence à cet élément.'),
        opts.count ? field('Réaffecter ces séances à', sel) : null
      ])
    }).then((ok) => { if (ok) opts.onConfirm(sel.value); });
  }

  /* ---- Enseignants ---- */
  function renderTeachersConfig(body, app) {
    const { data } = app.state;
    body.appendChild(h('div', { class: 'panel-title' }, [
      h('div', null, [h('h3', null, 'Enseignants'), h('p', { class: 'help' }, 'Renommer un enseignant met à jour toutes ses séances : l\'identifiant interne ne change jamais.')]),
      app.state.readOnly ? h('span', { class: 'chip readonly' }, 'Lecture seule') : h('button', { type: 'button', class: 'btn primary sm', onclick: () => { app.commit('Ajout d\'un enseignant', (d) => { const t = Nexus.newTeacher(d); d.teachers.push(t); config.editingId = t.id; }); } }, '+ Ajouter')
    ]));
    const list = h('div', { class: 'manage-list' });
    data.teachers.forEach((t) => {
      const st = teacherStats(data, t.id);
      const item = h('div', { class: ['manage-item', !t.active && 'inactive'] });
      item.appendChild(h('div', { class: 'head' }, [
        h('span', { class: 'avatar', style: { background: t.color } }, t.code.slice(0, 4)),
        h('div', { class: 'info' }, [
          h('strong', null, [t.name, !t.active ? h('span', { class: 'chip', style: { marginLeft: '6px' } }, 'inactif') : null]),
          h('div', { class: 'meta' }, [
            h('span', null, 'Code ' + t.code),
            h('span', null, t.subjects.length ? t.subjects.map((id) => Nexus.subjectShort(data, id)).join(', ') : 'Aucune matière déclarée'),
            h('span', null, fmtHours(st.minutes) + ' · ' + plural(st.sessions, 'séance')),
            t.unavailability.length ? h('span', null, plural(t.unavailability.length, 'indisponibilité')) : null
          ])
        ]),
        app.state.readOnly ? null : h('div', { class: 'actions' }, [
          h('button', { type: 'button', class: 'btn sm', onclick: () => { config.editingId = config.editingId === t.id ? null : t.id; refreshModal(); } }, config.editingId === t.id ? 'Fermer' : 'Modifier'),
          h('button', { type: 'button', class: 'btn sm', onclick: () => app.commit((t.active ? 'Désactivation' : 'Activation') + ' de ' + t.name, (d) => { const x = d.teachers.find((y) => y.id === t.id); if (x) x.active = !x.active; }) }, t.active ? 'Désactiver' : 'Activer'),
          h('button', { type: 'button', class: 'btn sm danger-outline', onclick: () => deleteWithReassign(app, {
            label: t.name, count: usageCount(data, 'teacherId', t.id),
            alternatives: data.teachers.filter((x) => x.id !== t.id).map((x) => ({ value: x.id, label: x.name + ' (' + x.code + ')' })),
            onConfirm: (rep) => app.commit('Suppression de ' + t.name, (d) => { d.teachers = d.teachers.filter((x) => x.id !== t.id); d.sessions.forEach((s) => { if (s.teacherId === t.id) s.teacherId = rep || ''; }); })
          }) }, 'Supprimer')
        ])
      ]));
      if (config.editingId === t.id) item.appendChild(teacherForm(app, t));
      list.appendChild(item);
    });
    body.appendChild(list);
  }

  function teacherForm(app, t) {
    const { data } = app.state;
    const draft = deepClone(t);
    const codeInput = h('input', { class: 'input', type: 'text', value: draft.code, maxlength: 12, oninput: (e) => { draft.code = e.target.value; } });
    const nameInput = h('input', { class: 'input', type: 'text', value: draft.name, oninput: (e) => { draft.name = e.target.value; } });
    const colorInput = h('input', { class: 'color-input', type: 'color', value: draft.color, oninput: (e) => { draft.color = e.target.value; } });
    const notesInput = h('textarea', { class: 'textarea', rows: 2, value: draft.notes, oninput: (e) => { draft.notes = e.target.value; } });
    const subjectChecks = h('div', { class: 'checks' }, data.subjects.filter((s) => s.active || draft.subjects.includes(s.id)).map((s) => h('label', null, [
      h('input', { type: 'checkbox', checked: draft.subjects.includes(s.id), onchange: (e) => { draft.subjects = e.target.checked ? draft.subjects.concat([s.id]) : draft.subjects.filter((x) => x !== s.id); } }),
      h('span', { class: 'subject-swatch', style: { background: s.color } }), s.label
    ])));
    const unavailList = h('div', { class: 'unavail-list' });
    function refreshUnavail() {
      clear(unavailList);
      if (!draft.unavailability.length) unavailList.appendChild(h('p', { class: 'help' }, 'Aucune indisponibilité déclarée.'));
      draft.unavailability.forEach((u, i) => unavailList.appendChild(h('div', { class: 'u' }, [
        h('span', null, dayLabel(u.day) + ' ' + fmtRange(u.start, u.end) + (u.note ? ' — ' + u.note : '')),
        h('button', { type: 'button', class: 'btn xs', onclick: () => { draft.unavailability.splice(i, 1); refreshUnavail(); } }, 'Retirer')
      ])));
    }
    refreshUnavail();
    const uDay = selectOf(DAYS.map((x) => ({ value: x.id, label: x.label })), 'MON', { class: 'select sm' });
    const uStart = h('input', { class: 'input sm', type: 'time', value: '08:00' });
    const uEnd = h('input', { class: 'input sm', type: 'time', value: '12:00' });
    const uNote = h('input', { class: 'input sm', type: 'text', placeholder: 'motif (facultatif)' });
    const addUnavail = h('button', { type: 'button', class: 'btn sm', onclick: () => {
      if (!isValidTime(uStart.value) || !isValidTime(uEnd.value) || parseTime(uEnd.value) <= parseTime(uStart.value)) { toast('Indisponibilité : horaires invalides.', 'error'); return; }
      draft.unavailability.push({ day: uDay.value, start: uStart.value, end: uEnd.value, note: uNote.value.trim() });
      refreshUnavail();
    } }, '+ Ajouter');

    return h('div', { class: 'edit stack' }, [
      h('div', { class: 'row-3' }, [field('Code court', codeInput, 'ex. M1, F1'), field('Nom affiché', nameInput, 'ex. Alaeddine Ben Rhouma'), field('Couleur', colorInput)]),
      h('div', { class: 'field' }, [h('span', null, 'Matières enseignées'), subjectChecks, h('span', { class: 'hint' }, 'Une séance sur une matière non cochée déclenche un avertissement (pas un blocage).')]),
      h('div', { class: 'field' }, [h('span', null, 'Indisponibilités (bloquantes)'), unavailList, h('div', { class: 'row-3', style: { gridTemplateColumns: '1.2fr 1fr 1fr' } }, [uDay, uStart, uEnd]), h('div', { class: 'row', style: { gridTemplateColumns: '1fr auto' } }, [uNote, addUnavail])]),
      field('Notes', notesInput),
      h('div', { class: 'editor-actions' }, [
        h('button', { type: 'button', class: 'btn primary', onclick: () => {
          if (!draft.name.trim()) { toast('Le nom est obligatoire.', 'error'); return; }
          if (!draft.code.trim()) { toast('Le code est obligatoire.', 'error'); return; }
          if (data.teachers.some((x) => x.id !== t.id && x.code.toLowerCase() === draft.code.trim().toLowerCase())) { toast('Ce code est déjà utilisé par un autre enseignant.', 'error'); return; }
          config.editingId = null;
          app.commit('Modification de ' + draft.name.trim(), (d) => { const i = d.teachers.findIndex((x) => x.id === t.id); if (i >= 0) d.teachers[i] = Nexus.normalizeTeacher(Object.assign({}, draft, { code: draft.code.trim(), name: draft.name.trim() }), i); });
          toast('Enseignant mis à jour : toutes ses séances affichent le nouveau nom.', 'success');
        } }, 'Enregistrer'),
        h('button', { type: 'button', class: 'btn', onclick: () => { config.editingId = null; refreshModal(); } }, 'Annuler')
      ])
    ]);
  }

  /* ---- Salles ---- */
  function renderRoomsConfig(body, app) {
    const { data } = app.state;
    body.appendChild(h('div', { class: 'panel-title' }, [
      h('div', null, [h('h3', null, 'Salles'), h('p', { class: 'help' }, 'Fonctionnement normal : ' + data.settings.normalSimultaneous + ' salles simultanées. Une salle « exceptionnelle » reste utilisable mais chaque usage est signalé.')]),
      app.state.readOnly ? h('span', { class: 'chip readonly' }, 'Lecture seule') : h('button', { type: 'button', class: 'btn primary sm', onclick: () => app.commit('Ajout d\'une salle', (d) => { const r = Nexus.newRoom(d); d.rooms.push(r); config.editingId = r.id; }) }, '+ Ajouter')
    ]));
    const list = h('div', { class: 'manage-list' });
    data.rooms.forEach((r) => {
      const st = roomStats(data, r.id);
      const item = h('div', { class: ['manage-item', !r.active && 'inactive'] });
      item.appendChild(h('div', { class: 'head' }, [
        h('span', { class: 'swatch', style: { background: r.exceptional ? 'var(--gold)' : 'var(--navy)' } }),
        h('div', { class: 'info' }, [
          h('strong', null, [r.name, r.exceptional ? h('span', { class: 'chip gold', style: { marginLeft: '6px' } }, 'exceptionnelle') : null, !r.active ? h('span', { class: 'chip', style: { marginLeft: '6px' } }, 'inactive') : null]),
          h('div', { class: 'meta' }, [h('span', null, 'Capacité ' + r.capacity), h('span', null, fmtHours(st.minutes) + ' · ' + plural(st.sessions, 'séance')), r.notes ? h('span', null, r.notes) : null])
        ]),
        app.state.readOnly ? null : h('div', { class: 'actions' }, [
          h('button', { type: 'button', class: 'btn sm', onclick: () => { config.editingId = config.editingId === r.id ? null : r.id; refreshModal(); } }, config.editingId === r.id ? 'Fermer' : 'Modifier'),
          h('button', { type: 'button', class: 'btn sm danger-outline', onclick: () => deleteWithReassign(app, {
            label: r.name, count: usageCount(data, 'roomId', r.id),
            alternatives: data.rooms.filter((x) => x.id !== r.id).map((x) => ({ value: x.id, label: x.name })),
            onConfirm: (rep) => app.commit('Suppression de ' + r.name, (d) => { d.rooms = d.rooms.filter((x) => x.id !== r.id); d.sessions.forEach((s) => { if (s.roomId === r.id) s.roomId = rep || ''; }); })
          }) }, 'Supprimer')
        ])
      ]));
      if (config.editingId === r.id) {
        const draft = deepClone(r);
        item.appendChild(h('div', { class: 'edit stack' }, [
          h('div', { class: 'row-3' }, [
            field('Nom', h('input', { class: 'input', type: 'text', value: draft.name, oninput: (e) => { draft.name = e.target.value; } })),
            field('Capacité', h('input', { class: 'input', type: 'number', min: 0, max: 60, value: draft.capacity, oninput: (e) => { draft.capacity = Number(e.target.value); } })),
            field('Notes', h('input', { class: 'input', type: 'text', value: draft.notes, oninput: (e) => { draft.notes = e.target.value; } }))
          ]),
          h('div', { style: { display: 'flex', gap: '18px', flexWrap: 'wrap' } }, [
            switchOf('Salle exceptionnelle (usage signalé)', draft.exceptional, (e) => { draft.exceptional = e.target.checked; }),
            switchOf('Salle active', draft.active, (e) => { draft.active = e.target.checked; })
          ]),
          h('div', { class: 'editor-actions' }, [
            h('button', { type: 'button', class: 'btn primary', onclick: () => {
              if (!draft.name.trim()) { toast('Le nom est obligatoire.', 'error'); return; }
              config.editingId = null;
              app.commit('Modification de ' + draft.name.trim(), (d) => { const i = d.rooms.findIndex((x) => x.id === r.id); if (i >= 0) d.rooms[i] = Nexus.normalizeRoom(draft, i); });
            } }, 'Enregistrer'),
            h('button', { type: 'button', class: 'btn', onclick: () => { config.editingId = null; refreshModal(); } }, 'Annuler')
          ])
        ]));
      }
      list.appendChild(item);
    });
    body.appendChild(list);
  }

  /* ---- Matières ---- */
  function renderSubjectsConfig(body, app) {
    const { data } = app.state;
    body.appendChild(h('div', { class: 'panel-title' }, [
      h('div', null, [h('h3', null, 'Matières'), h('p', { class: 'help' }, 'Ajoutez librement de nouvelles matières (Maths expertes, Grand Oral…). La couleur identifie la matière sur les cartes.')]),
      app.state.readOnly ? h('span', { class: 'chip readonly' }, 'Lecture seule') : h('button', { type: 'button', class: 'btn primary sm', onclick: () => app.commit('Ajout d\'une matière', (d) => { const s = Nexus.newSubject(d); d.subjects.push(s); config.editingId = s.id; }) }, '+ Ajouter')
    ]));
    const list = h('div', { class: 'manage-list' });
    data.subjects.forEach((s) => {
      const count = usageCount(data, 'subjectId', s.id);
      const item = h('div', { class: ['manage-item', !s.active && 'inactive'] });
      item.appendChild(h('div', { class: 'head' }, [
        h('span', { class: 'swatch', style: { background: s.color } }),
        h('div', { class: 'info' }, [
          h('strong', null, [s.label, !s.active ? h('span', { class: 'chip', style: { marginLeft: '6px' } }, 'désactivée') : null]),
          h('div', { class: 'meta' }, [h('span', null, 'Abrégé : ' + s.short), h('span', null, plural(count, 'séance')), s.levels.length ? h('span', null, 'Niveaux : ' + s.levels.map(Nexus.levelShort).join(', ')) : null])
        ]),
        app.state.readOnly ? null : h('div', { class: 'actions' }, [
          h('button', { type: 'button', class: 'btn sm', onclick: () => { config.editingId = config.editingId === s.id ? null : s.id; refreshModal(); } }, config.editingId === s.id ? 'Fermer' : 'Modifier'),
          h('button', { type: 'button', class: 'btn sm danger-outline', onclick: () => deleteWithReassign(app, {
            label: s.label, count: count,
            alternatives: data.subjects.filter((x) => x.id !== s.id).map((x) => ({ value: x.id, label: x.label })),
            onConfirm: (rep) => app.commit('Suppression de ' + s.label, (d) => { d.subjects = d.subjects.filter((x) => x.id !== s.id); d.sessions.forEach((x) => { if (x.subjectId === s.id) x.subjectId = rep || ''; }); d.teachers.forEach((t) => { t.subjects = t.subjects.filter((x) => x !== s.id); }); })
          }) }, 'Supprimer')
        ])
      ]));
      if (config.editingId === s.id) {
        const draft = deepClone(s);
        item.appendChild(h('div', { class: 'edit stack' }, [
          h('div', { class: 'row-3' }, [
            field('Nom complet', h('input', { class: 'input', type: 'text', value: draft.label, oninput: (e) => { draft.label = e.target.value; } })),
            field('Abrégé (cartes étroites)', h('input', { class: 'input', type: 'text', value: draft.short, maxlength: 12, oninput: (e) => { draft.short = e.target.value; } })),
            field('Couleur', h('input', { class: 'color-input', type: 'color', value: draft.color, oninput: (e) => { draft.color = e.target.value; } }))
          ]),
          h('div', { class: 'field' }, [h('span', null, 'Niveaux concernés (indicatif)'), h('div', { class: 'checks' }, LEVELS.map((l) => h('label', null, [
            h('input', { type: 'checkbox', checked: draft.levels.includes(l.id), onchange: (e) => { draft.levels = e.target.checked ? draft.levels.concat([l.id]) : draft.levels.filter((x) => x !== l.id); } }), l.label
          ])))]),
          switchOf('Matière active', draft.active, (e) => { draft.active = e.target.checked; }),
          h('div', { class: 'editor-actions' }, [
            h('button', { type: 'button', class: 'btn primary', onclick: () => {
              if (!draft.label.trim()) { toast('Le nom est obligatoire.', 'error'); return; }
              config.editingId = null;
              app.commit('Modification de ' + draft.label.trim(), (d) => { const i = d.subjects.findIndex((x) => x.id === s.id); if (i >= 0) d.subjects[i] = Nexus.normalizeSubject(Object.assign({}, draft, { label: draft.label.trim(), short: draft.short.trim() || draft.label.trim().slice(0, 8) }), i); });
            } }, 'Enregistrer'),
            h('button', { type: 'button', class: 'btn', onclick: () => { config.editingId = null; refreshModal(); } }, 'Annuler')
          ])
        ]));
      }
      list.appendChild(item);
    });
    body.appendChild(list);
  }

  /* ---- Groupes ---- */
  function renderGroupsConfig(body, app) {
    const { data } = app.state;
    body.appendChild(h('div', { class: 'panel-title' }, [
      h('div', null, [h('h3', null, 'Groupes'), h('p', { class: 'help' }, 'Un groupe = un ensemble d\'élèves d\'un niveau et d\'un public (ex. Terminale · Maths A). Deux séances d\'un même groupe ne peuvent pas être simultanées.')]),
      app.state.readOnly ? h('span', { class: 'chip readonly' }, 'Lecture seule') : h('button', { type: 'button', class: 'btn primary sm', onclick: () => app.commit('Ajout d\'un groupe', (d) => { const g = Nexus.newGroup(d); d.groups.push(g); config.editingId = g.id; }) }, '+ Ajouter')
    ]));
    const list = h('div', { class: 'manage-list' });
    const sorted = data.groups.slice().sort((a, b) => Nexus.LEVEL_INDEX[a.level] - Nexus.LEVEL_INDEX[b.level] || a.audience.localeCompare(b.audience) || a.label.localeCompare(b.label));
    sorted.forEach((g) => {
      const count = usageCount(data, 'groupId', g.id);
      const item = h('div', { class: 'manage-item' });
      item.appendChild(h('div', { class: 'head' }, [
        h('span', { class: ['badge-aud', g.audience] }, audienceBadge(g.audience)),
        h('div', { class: 'info' }, [
          h('strong', null, [levelLabel(g.level) + ' · ' + g.label, g.variant ? h('span', { class: 'chip navy', style: { marginLeft: '6px' } }, 'Maths ' + g.variant) : null]),
          h('div', { class: 'meta' }, [h('span', null, audienceLabel(g.audience)), h('span', null, plural(count, 'séance')), g.notes ? h('span', null, g.notes) : null])
        ]),
        app.state.readOnly ? null : h('div', { class: 'actions' }, [
          h('button', { type: 'button', class: 'btn sm', onclick: () => { config.editingId = config.editingId === g.id ? null : g.id; refreshModal(); } }, config.editingId === g.id ? 'Fermer' : 'Modifier'),
          h('button', { type: 'button', class: 'btn sm danger-outline', onclick: () => deleteWithReassign(app, {
            label: 'le groupe ' + g.label, count: count,
            alternatives: data.groups.filter((x) => x.id !== g.id).map((x) => ({ value: x.id, label: levelLabel(x.level) + ' · ' + x.label })),
            onConfirm: (rep) => app.commit('Suppression du groupe ' + g.label, (d) => { d.groups = d.groups.filter((x) => x.id !== g.id); d.sessions.forEach((x) => { if (x.groupId === g.id) x.groupId = rep || ''; }); })
          }) }, 'Supprimer')
        ])
      ]));
      if (config.editingId === g.id) {
        const draft = deepClone(g);
        item.appendChild(h('div', { class: 'edit stack' }, [
          h('div', { class: 'row' }, [
            field('Nom du groupe', h('input', { class: 'input', type: 'text', value: draft.label, oninput: (e) => { draft.label = e.target.value; } }), 'ex. Maths A, Scolarisés, Candidats individuels'),
            field('Parcours Maths', selectOf([{ value: '', label: '— Aucun —' }].concat(VARIANTS.map((v) => ({ value: v.id, label: v.label + ' — ' + v.hint }))), draft.variant || '', { onchange: (e) => { draft.variant = e.target.value || null; } }))
          ]),
          h('div', { class: 'row' }, [
            field('Niveau', selectOf(LEVELS.map((l) => ({ value: l.id, label: l.label })), draft.level, { onchange: (e) => { draft.level = e.target.value; } })),
            field('Public', selectOf(AUDIENCES.map((a) => ({ value: a.id, label: a.label })), draft.audience, { onchange: (e) => { draft.audience = e.target.value; } }))
          ]),
          field('Notes', h('input', { class: 'input', type: 'text', value: draft.notes, oninput: (e) => { draft.notes = e.target.value; } })),
          h('div', { class: 'editor-actions' }, [
            h('button', { type: 'button', class: 'btn primary', onclick: () => {
              if (!draft.label.trim()) { toast('Le nom est obligatoire.', 'error'); return; }
              config.editingId = null;
              app.commit('Modification du groupe ' + draft.label.trim(), (d) => { const i = d.groups.findIndex((x) => x.id === g.id); if (i >= 0) d.groups[i] = Nexus.normalizeGroup(Object.assign({}, draft, { label: draft.label.trim() }), i); });
            } }, 'Enregistrer'),
            h('button', { type: 'button', class: 'btn', onclick: () => { config.editingId = null; refreshModal(); } }, 'Annuler')
          ])
        ]));
      }
      list.appendChild(item);
    });
    body.appendChild(list);
  }

  /* ---- Paramètres ---- */
  function renderSettingsConfig(body, app) {
    const { data } = app.state;
    const s = deepClone(data.settings);
    const meta = { title: data.meta.title };
    const num = (name, attrs) => h('input', Object.assign({ class: 'input', type: 'number', value: s[name], oninput: (e) => { s[name] = Number(e.target.value); } }, attrs || {}));
    const time = (name) => h('input', { class: 'input', type: 'time', value: s[name], oninput: (e) => { s[name] = e.target.value; } });
    const lunch = s.lunchBreak || { start: '', end: '' };
    const lunchStart = h('input', { class: 'input', type: 'time', value: lunch.start, oninput: (e) => { lunch.start = e.target.value; } });
    const lunchEnd = h('input', { class: 'input', type: 'time', value: lunch.end, oninput: (e) => { lunch.end = e.target.value; } });
    body.appendChild(h('div', { class: 'stack' }, [
      h('h3', null, 'Paramètres du centre'),
      h('div', { class: 'settings-grid' }, [
        field('Titre du planning', h('input', { class: 'input', type: 'text', value: meta.title, oninput: (e) => { meta.title = e.target.value; } })),
        field('Année scolaire', h('input', { class: 'input', type: 'text', value: s.academicYear, oninput: (e) => { s.academicYear = e.target.value; } })),
        field('Ouverture (début de journée)', time('dayStart')),
        field('Fermeture (fin de journée)', time('dayEnd')),
        field('Salles simultanées en fonctionnement normal', num('normalSimultaneous', { min: 1, max: 10 }), 'Au-delà : avertissement « salle exceptionnelle ».'),
        field('Maximum absolu de cours simultanés', num('maxSimultaneous', { min: 1, max: 10 }), 'Au-delà : erreur bloquante.'),
        field('Seuil « cours tardif » (fin après)', time('lateThreshold')),
        field('Attente à surveiller (minutes)', num('waitLightMinutes', { min: 0, max: 600 })),
        field('Attente importante (minutes)', num('waitStrongMinutes', { min: 0, max: 600 })),
        field('Amplitude maximale conseillée (minutes)', num('amplitudeWarnMinutes', { min: 60, max: 900 })),
        field('Pause déjeuner — début', lunchStart, 'Affichée en fond de grille (indicatif).'),
        field('Pause déjeuner — fin', lunchEnd)
      ]),
      app.state.readOnly ? h('p', { class: 'help' }, 'Paramètres consultables en lecture seule.') : h('div', { class: 'editor-actions' }, [
        h('button', { type: 'button', class: 'btn primary', onclick: () => {
          if (!isValidTime(s.dayStart) || !isValidTime(s.dayEnd) || parseTime(s.dayEnd) <= parseTime(s.dayStart)) { toast('Plage d\'ouverture invalide.', 'error'); return; }
          s.lunchBreak = isValidTime(lunch.start) && isValidTime(lunch.end) && parseTime(lunch.end) > parseTime(lunch.start) ? { start: lunch.start, end: lunch.end } : null;
          app.commit('Modification des paramètres', (d) => { d.settings = Nexus.normalize(Object.assign({}, d, { settings: s })).settings; d.meta.title = meta.title.trim() || d.meta.title; });
          toast('Paramètres enregistrés.', 'success');
        } }, 'Enregistrer les paramètres')
      ]),
      h('div', { class: 'section-title' }, 'Stockage'),
      h('p', { class: 'help' }, app.state.mode === 'integrated'
        ? 'Le planning est partagé : chaque enregistrement crée une révision sur le serveur Nexus (révision courante : ' + app.state.revision + '). Le navigateur ne conserve qu\'un brouillon de récupération.'
        : 'Les modifications sont enregistrées automatiquement dans ce navigateur (' + (Nexus.storageAvailable() ? 'stockage local disponible' : 'stockage local indisponible') + '). Exportez régulièrement un fichier JSON comme sauvegarde ou pour transférer le planning vers un autre poste.')
    ]));
  }

  /* ---- Historique des révisions (mode intégré, ADMIN) ---- */
  function renderHistoryConfig(body, app) {
    body.appendChild(h('div', { class: 'panel-title' }, [
      h('div', null, [h('h3', null, 'Historique des révisions'), h('p', { class: 'help' }, 'Chaque enregistrement crée une révision. Restaurer une révision ancienne crée une nouvelle révision : rien n\'est jamais effacé.')])
    ]));
    const list = h('div', { class: 'history-list' }, h('p', { class: 'help' }, 'Chargement…'));
    body.appendChild(list);
    Nexus.Sync.listRevisions(60).then((res) => {
      clear(list);
      if (!res.revisions.length) { list.appendChild(h('p', { class: 'help' }, 'Aucune révision.')); return; }
      res.revisions.forEach((r) => {
        const isCurrent = r.revision === app.state.revision;
        list.appendChild(h('div', { class: ['history-item', isCurrent && 'current'] }, [
          h('span', { class: 'rev' }, 'rév. ' + r.revision),
          h('div', { class: 'info' }, [
            h('strong', null, [h('span', { class: ['action-tag', r.action] }, ACTION_LABELS[r.action] || r.action), r.summary || '—']),
            h('span', null, new Date(r.createdAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) + ' · ' + (r.createdBy ? r.createdBy.name : 'système') + (isCurrent ? ' · version courante' : ''))
          ]),
          h('div', { class: 'actions' }, [
            h('button', { type: 'button', class: 'btn xs', onclick: () => app.exportRevision(r.revision) }, 'Exporter'),
            isCurrent || !(app.state.permissions && app.state.permissions.canRestore) ? null : h('button', { type: 'button', class: 'btn xs danger-outline', onclick: () => app.restoreRevision(r.revision) }, 'Restaurer')
          ])
        ]));
      });
    }).catch((err) => {
      clear(list);
      list.appendChild(h('div', { class: 'inline-danger' }, 'Historique indisponible : ' + (err && err.message ? err.message : 'erreur')));
    });
  }
  const ACTION_LABELS = { INIT: 'Initialisation', SAVE: 'Enregistrement', IMPORT: 'Import', RESTORE: 'Restauration', RESET: 'Réinitialisation' };

  /* ---- Dialogues de synchronisation ---- */
  function showConflictDialog(app, info) {
    info = info || {};
    const by = info.updatedBy && info.updatedBy.name ? info.updatedBy.name : 'un autre utilisateur';
    const when = info.updatedAt ? new Date(info.updatedAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    openModal({
      title: 'Conflit de version',
      narrow: true,
      body: h('div', { class: 'stack' }, [
        h('div', { class: 'inline-warning' }, 'Le planning a été modifié par ' + by + (when ? ' le ' + when : '') + ' (révision ' + (info.currentRevision || app.state.sync.latestRevision || '?') + '). Vos modifications s\'appuient sur la révision ' + app.state.revision + ' et ne peuvent pas être enregistrées telles quelles.'),
        h('p', null, 'Rechargez la version actuelle, puis rejouez vos changements. Vous pouvez d\'abord exporter votre brouillon pour comparer.'),
        h('p', { class: 'help' }, 'Aucune donnée n\'est perdue : votre brouillon reste conservé dans ce navigateur tant que vous ne rechargez pas.')
      ]),
      footer: [
        h('button', { type: 'button', class: 'btn', onclick: () => app.exportDraft() }, 'Exporter mon brouillon'),
        h('button', { type: 'button', class: 'btn', onclick: () => closeModal() }, 'Fermer'),
        h('button', { type: 'button', class: 'btn primary', onclick: () => { closeModal(); Nexus.Sync.draft.clear(); app.loadFromServer(); } }, 'Recharger la version actuelle')
      ]
    });
  }

  function showDraftDialog(app, draft) {
    const when = draft.savedAt ? new Date(draft.savedAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    const sameBase = draft.baseRevision === app.state.revision;
    openModal({
      title: 'Brouillon local non enregistré',
      narrow: true,
      body: h('div', { class: 'stack' }, [
        h('p', null, 'Un brouillon non enregistré a été retrouvé dans ce navigateur' + (when ? ' (' + when + ')' : '') + ', basé sur la révision ' + draft.baseRevision + '.'),
        sameBase
          ? h('div', { class: 'inline-info' }, 'Le planning partagé est toujours à la révision ' + app.state.revision + ' : vous pouvez reprendre ce brouillon, il sera enregistré automatiquement.')
          : h('div', { class: 'inline-warning' }, 'Le planning partagé est passé à la révision ' + app.state.revision + ' : ce brouillon ne sera pas appliqué automatiquement. Il peut être exporté en JSON pour comparaison.')
      ]),
      footer: [
        h('button', { type: 'button', class: 'btn', onclick: () => { closeModal(); Nexus.Sync.draft.clear(); toast('Brouillon ignoré.', '', 2500); } }, 'Ignorer le brouillon'),
        h('button', { type: 'button', class: 'btn primary', onclick: () => { closeModal(); app.adoptDraft(draft); } }, sameBase ? 'Reprendre le brouillon' : 'Exporter le brouillon')
      ],
      blocking: true
    });
  }

  /* ---------------------------------------------------------------
     Import : contrôle + confirmation
     --------------------------------------------------------------- */
  function openImportDialog(app, raw, inspection, fileName) {
    const body = h('div', { class: 'stack' });
    if (!inspection.ok) {
      body.appendChild(h('div', { class: 'inline-danger' }, [h('strong', null, 'Le fichier ne peut pas être importé.'), h('ul', { class: 'import-errors' }, inspection.errors.map((e) => h('li', null, e)))]));
      openModal({ title: 'Import impossible — ' + (fileName || 'fichier'), narrow: true, body, footer: [h('button', { type: 'button', class: 'btn primary', onclick: () => closeModal() }, 'Fermer')] });
      return;
    }
    const s = inspection.summary;
    body.appendChild(h('p', null, 'Le fichier « ' + (fileName || 'planning.json') + ' » semble valide. Son contenu remplacera le planning actuel (cette opération peut être annulée avec Annuler).'));
    body.appendChild(h('div', { class: 'import-summary' }, [
      h('span', null, ['Séances : ', h('b', null, String(s.sessions))]), h('span', null, ['Enseignants : ', h('b', null, String(s.teachers))]),
      h('span', null, ['Salles : ', h('b', null, String(s.rooms))]), h('span', null, ['Matières : ', h('b', null, String(s.subjects))]),
      h('span', null, ['Groupes : ', h('b', null, String(s.groups || '— (déduits)'))]), h('span', null, ['Mis à jour : ', h('b', null, s.updatedAt || '—')])
    ]));
    if (inspection.warnings.length) body.appendChild(h('div', { class: 'inline-warning' }, inspection.warnings.map((w) => h('div', null, w))));
    openModal({
      title: 'Importer un planning', narrow: true, body,
      footer: [
        h('button', { type: 'button', class: 'btn', onclick: () => closeModal() }, 'Annuler'),
        h('button', { type: 'button', class: 'btn primary', onclick: () => { closeModal(); app.replaceData(raw, 'Import de ' + (fileName || 'planning'), 'Planning importé : ' + plural(s.sessions, 'séance') + '.'); } }, 'Remplacer le planning')
      ]
    });
  }

  Nexus.Panels = {
    toast, openModal, closeModal, refreshModal, isModalOpen, confirmDialog,
    renderEditor, renderDiagnostics, renderStats, renderPlanningHead, renderTeacherBanner, renderLegend, renderPrintHeader, renderSwapbar,
    openConfig, openImportDialog, editorHasUnsaved, editor,
    showConflictDialog, showDraftDialog
  };
})(typeof window !== 'undefined' ? window : globalThis);
