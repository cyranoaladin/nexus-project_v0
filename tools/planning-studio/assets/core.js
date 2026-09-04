/* =====================================================================
   NEXUS PLANNING STUDIO — core.js
   Espace de noms global, constantes métier, utilitaires temps / DOM.
   Aucune dépendance. Fonctionne en file:// (scripts classiques).
   ===================================================================== */
(function (global) {
  'use strict';

  const Nexus = global.Nexus || (global.Nexus = {});

  /* ---------------------------------------------------------------
     Constantes métier
     --------------------------------------------------------------- */
  const DAYS = [
    { id: 'MON', label: 'Lundi', short: 'Lun' },
    { id: 'TUE', label: 'Mardi', short: 'Mar' },
    { id: 'WED', label: 'Mercredi', short: 'Mer' },
    { id: 'THU', label: 'Jeudi', short: 'Jeu' },
    { id: 'FRI', label: 'Vendredi', short: 'Ven' },
    { id: 'SAT', label: 'Samedi', short: 'Sam' },
    { id: 'SUN', label: 'Dimanche', short: 'Dim' }
  ];
  const DAY_INDEX = Object.fromEntries(DAYS.map((d, i) => [d.id, i]));

  const LEVELS = [
    { id: 'QUATRIEME', label: 'Quatrième', short: '4e', cycle: 'COLLEGE' },
    { id: 'TROISIEME', label: 'Troisième', short: '3e', cycle: 'COLLEGE' },
    { id: 'SECONDE', label: 'Seconde', short: '2de', cycle: 'LYCEE' },
    { id: 'PREMIERE', label: 'Première', short: '1re', cycle: 'LYCEE' },
    { id: 'TERMINALE', label: 'Terminale', short: 'Tle', cycle: 'LYCEE' }
  ];
  /* ---------------------------------------------------------------
     POLITIQUE MÉTIER NEXUS — source unique et versionnée
     ---------------------------------------------------------------
     Ce bloc décrit ce que Nexus EXIGE, par opposition à `settings`, qui
     décrit la configuration d'un planning donné (plage d'ouverture,
     capacité, seuils de confort). Rien n'est dupliqué entre les deux :
     `normalSimultaneous`, `maxSimultaneous`, `lunchBreak`, `lateThreshold`
     et les seuils d'attente restent portés par `settings`.

     Toute évolution de cette politique est un changement métier : elle doit
     être versionnée (POLICY.version) et accompagnée de ses tests.
     --------------------------------------------------------------- */
  const POLICY = {
    version: 1,

    /** Durée d'une séance régulière du planning Nexus. */
    sessionDurationMinutes: 120,

    /**
     * Fenêtres de placement par public scolarisé.
     *  - `requiredDay` : hors de ce jour, c'est une erreur métier bloquante.
     *  - `preferredDay(s)` : hors de ces jours, c'est un avertissement.
     *  - la fenêtre horaire s'applique au même niveau de gravité que le jour.
     */
    levelWindows: [
      { id: 'COLLEGE_SCO', cycle: 'COLLEGE', audience: 'SCO', requiredDay: 'WED', windowStart: '14:00', windowEnd: '21:00', severity: 'error' },
      { id: 'SECONDE_SCO', levels: ['SECONDE'], audience: 'SCO', preferredDays: ['WED'], windowStart: '14:00', windowEnd: '21:00', severity: 'warning' },
      { id: 'SENIOR_SCO', levels: ['PREMIERE', 'TERMINALE'], audience: 'SCO', preferredDays: ['SAT', 'SUN'], severity: 'warning' }
    ],

    /**
     * Enseignant référent unique par famille de matières. Exprimé en
     * matières et public, jamais en identifiants d'enseignants : renommer
     * ou réaffecter un enseignant reste possible, scinder une famille entre
     * deux enseignants ne l'est pas.
     */
    teacherPolicies: [
      { id: 'MATHS_NSI_SCO', subjects: ['MATHS', 'NSI'], audience: 'SCO' },
      { id: 'MATHS_NSI_CL', subjects: ['MATHS', 'NSI'], audience: 'CL' },
      { id: 'FRANCAIS_PHILO', subjects: ['FRANCAIS', 'PHILO'], audience: null }
    ],

    /**
     * Prestations que Nexus s'engage à maintenir disponibles.
     *
     * Une prestation offerte n'est pas nécessairement une séance hebdomadaire.
     * Chaque matière déclare sa cadence :
     *
     *   WEEKLY  séance récurrente attendue dans la grille hebdomadaire ;
     *           son absence est une erreur de couverture.
     *   MODULE  enveloppe annuelle délivrée hors grille récurrente ; la
     *           couverture est portée par l'offre, pas par le planning type.
     *
     * ROTATING et ON_DEMAND ne sont pas introduits tant qu'aucune prestation
     * Nexus ne les exige réellement : un mode non utilisé serait une
     * abstraction non vérifiée.
     */
    coverageModes: { WEEKLY: 'WEEKLY', MODULE: 'MODULE' },

    requiredCoverage: [
      { level: 'QUATRIEME', audience: 'SCO', weekly: ['MATHS', 'FRANCAIS'] },
      { level: 'TROISIEME', audience: 'SCO', weekly: ['MATHS', 'FRANCAIS'] },
      { level: 'SECONDE', audience: 'SCO', weekly: ['MATHS', 'FRANCAIS'] },
      { level: 'PREMIERE', audience: 'SCO', weekly: ['MATHS', 'NSI', 'PC', 'SVT', 'SES', 'HGGSP', 'FRANCAIS'] },
      { level: 'TERMINALE', audience: 'SCO', weekly: ['MATHS', 'NSI', 'PC', 'SVT', 'SES', 'HGGSP', 'PHILO'] },
      { level: 'PREMIERE', audience: 'CL', weekly: ['MATHS', 'NSI', 'PC', 'SVT', 'SES', 'HGGSP', 'FRANCAIS', 'EAM', 'HG_EMC', 'LANGUES', 'ENS_SCI'] },
      {
        level: 'TERMINALE', audience: 'CL',
        weekly: ['MATHS', 'NSI', 'PC', 'SVT', 'SES', 'HGGSP', 'PHILO', 'HG_EMC', 'LANGUES', 'ENS_SCI'],
        // Grand Oral : 4 séances de 2 h sur l'année (8 h), enveloppe annuelle
        // définie par data/pricing.canonical.json → rules.grand_oral_policy,
        // applicable aux offres terminale-libre-focus-bac et -integrale.
        // Ce n'est PAS un cours hebdomadaire : l'exiger dans la grille type
        // serait une frequence inventee pour satisfaire une porte.
        modules: [{ subject: 'GRAND_ORAL', sessionsPerYear: 4, sessionDurationMinutes: 120 }]
      }
    ],

    /** Spécialités du bac général, utilisées par les tests combinatoires. */
    specialties: ['MATHS', 'NSI', 'PC', 'SVT', 'SES', 'HGGSP']
  };

  const LEVEL_INDEX = Object.fromEntries(LEVELS.map((l, i) => [l.id, i]));

  const AUDIENCES = [
    { id: 'SCO', label: 'Scolarisés', singular: 'Scolarisé', badge: 'SCO' },
    { id: 'CL', label: 'Candidats individuels', singular: 'Candidat individuel', badge: 'CL' }
  ];

  const VARIANTS = [
    { id: 'A', label: 'Maths A', hint: 'Enchaînement Maths → NSI' },
    { id: 'B', label: 'Maths B', hint: 'Enchaînement Maths → Physique-Chimie' }
  ];

  const SEVERITY = { ERROR: 'error', WARNING: 'warning', INFO: 'info' };
  const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 };
  const SEVERITY_LABEL = { error: 'Erreur bloquante', warning: 'Avertissement', info: 'Conseil' };

  const TEACHER_PALETTE = [
    '#0B1F3A', '#7A2E6B', '#0E7C9B', '#2E7D32', '#B7791F', '#B3261E',
    '#5B3FB8', '#C2571B', '#0F766E', '#8A5A2B', '#4D7C0F', '#64748B'
  ];

  /* ---------------------------------------------------------------
     Temps : "HH:MM" <-> minutes depuis minuit
     --------------------------------------------------------------- */
  const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

  function parseTime(str) {
    if (typeof str !== 'string') return null;
    const m = TIME_RE.exec(str.trim());
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  function isValidTime(str) {
    return parseTime(str) !== null;
  }

  function minutesToTime(min) {
    min = Math.max(0, Math.min(1439, Math.round(min)));
    const h = Math.floor(min / 60);
    const m = min % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  /** Format d'affichage français : 09h00 */
  function fmtTime(str) {
    const min = parseTime(str);
    if (min === null) return str ? String(str) : '—';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return String(h).padStart(2, '0') + 'h' + String(m).padStart(2, '0');
  }

  function fmtRange(start, end) {
    return fmtTime(start) + '–' + fmtTime(end);
  }

  function fmtDuration(minutes) {
    if (!isFinite(minutes) || minutes <= 0) return '0 h';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (m === 0) return h + ' h';
    if (h === 0) return m + ' min';
    return h + ' h ' + String(m).padStart(2, '0');
  }

  function fmtHours(minutes) {
    const h = minutes / 60;
    return (Math.round(h * 4) / 4).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' h';
  }

  function snapMinutes(min, step) {
    step = step || 15;
    return Math.round(min / step) * step;
  }

  function dayLabel(id) {
    const d = DAYS.find((x) => x.id === id);
    return d ? d.label : String(id || '—');
  }
  function dayShort(id) {
    const d = DAYS.find((x) => x.id === id);
    return d ? d.short : String(id || '—');
  }
  function levelLabel(id) {
    const l = LEVELS.find((x) => x.id === id);
    return l ? l.label : String(id || '—');
  }
  function levelShort(id) {
    const l = LEVELS.find((x) => x.id === id);
    return l ? l.short : String(id || '—');
  }
  function audienceLabel(id) {
    const a = AUDIENCES.find((x) => x.id === id);
    return a ? a.label : String(id || '—');
  }
  function audienceBadge(id) {
    const a = AUDIENCES.find((x) => x.id === id);
    return a ? a.badge : String(id || '?');
  }

  /* ---------------------------------------------------------------
     Divers
     --------------------------------------------------------------- */
  let idCounter = 0;
  function uid(prefix) {
    idCounter += 1;
    const t = Date.now().toString(36);
    const r = Math.random().toString(36).slice(2, 6);
    return (prefix || 'id') + '-' + t + r + idCounter.toString(36);
  }

  function slugify(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'item';
  }

  function deepClone(obj) {
    if (typeof structuredClone === 'function') return structuredClone(obj);
    return JSON.parse(JSON.stringify(obj));
  }

  function todayIso() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function nowLabel() {
    return new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
  }

  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return null;
    let h = m[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function isValidHex(hex) {
    return hexToRgb(hex) !== null;
  }

  function rgba(hex, alpha) {
    const c = hexToRgb(hex) || { r: 100, g: 116, b: 139 };
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alpha + ')';
  }

  /** Luminance relative (WCAG) pour choisir la couleur de texte. */
  function textOn(hex) {
    const c = hexToRgb(hex);
    if (!c) return '#0B1F3A';
    const lin = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const L = 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
    return L > 0.4 ? '#0B1F3A' : '#FFFFFF';
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function plural(n, singular, pluralForm) {
    return n + ' ' + (n > 1 ? (pluralForm || singular + 's') : singular);
  }

  function compareBy() {
    const keys = Array.prototype.slice.call(arguments);
    return function (a, b) {
      for (const k of keys) {
        const va = typeof k === 'function' ? k(a) : a[k];
        const vb = typeof k === 'function' ? k(b) : b[k];
        if (va < vb) return -1;
        if (va > vb) return 1;
      }
      return 0;
    };
  }

  /* ---------------------------------------------------------------
     DOM sûr : aucune injection de HTML dynamique.
     h('div', { class: 'x', onclick: fn, dataset: {...} }, [children])
     --------------------------------------------------------------- */
  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const key of Object.keys(attrs)) {
        const val = attrs[key];
        if (val === null || val === undefined || val === false) continue;
        if (key === 'class' || key === 'className') {
          el.className = Array.isArray(val) ? val.filter(Boolean).join(' ') : String(val);
        } else if (key === 'style' && typeof val === 'object') {
          for (const p of Object.keys(val)) {
            if (p.startsWith('--')) el.style.setProperty(p, val[p]);
            else el.style[p] = val[p];
          }
        } else if (key === 'dataset' && typeof val === 'object') {
          for (const p of Object.keys(val)) el.dataset[p] = val[p];
        } else if (key.startsWith('on') && typeof val === 'function') {
          el.addEventListener(key.slice(2).toLowerCase(), val);
        } else if (key === 'text') {
          el.textContent = String(val);
        } else if (key === 'value' && 'value' in el) {
          el.value = val;
        } else if (key === 'checked' || key === 'disabled' || key === 'selected' || key === 'hidden' || key === 'required' || key === 'multiple') {
          el[key] = Boolean(val);
        } else {
          el.setAttribute(key, val === true ? '' : String(val));
        }
      }
    }
    appendChildren(el, children);
    return el;
  }

  function appendChildren(el, children) {
    if (children === null || children === undefined || children === false) return;
    if (Array.isArray(children)) {
      children.forEach((c) => appendChildren(el, c));
    } else if (children instanceof Node) {
      el.appendChild(children);
    } else {
      el.appendChild(document.createTextNode(String(children)));
    }
  }

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  }

  function option(value, label, selected) {
    return h('option', { value: value, selected: !!selected }, label);
  }

  function fillSelect(select, items, current, placeholder) {
    clear(select);
    if (placeholder) select.appendChild(option('', placeholder, current === '' || current == null));
    items.forEach((it) => {
      select.appendChild(option(it.value, it.label, it.value === current));
    });
    if (current != null && current !== '' && items.every((it) => it.value !== current)) {
      select.appendChild(option(current, String(current) + ' (inconnu)', true));
    }
    return select;
  }

  function debounce(fn, ms) {
    let t = null;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  }

  /* ---------------------------------------------------------------
     Export
     --------------------------------------------------------------- */
  Object.assign(Nexus, {
    DAYS, DAY_INDEX, LEVELS, LEVEL_INDEX, AUDIENCES, VARIANTS, POLICY,
    SEVERITY, SEVERITY_ORDER, SEVERITY_LABEL, TEACHER_PALETTE,
    parseTime, isValidTime, minutesToTime, fmtTime, fmtRange, fmtDuration, fmtHours, snapMinutes,
    dayLabel, dayShort, levelLabel, levelShort, audienceLabel, audienceBadge,
    uid, slugify, deepClone, todayIso, nowLabel, hexToRgb, isValidHex, rgba, textOn, initials, plural, compareBy,
    h, appendChildren, clear, option, fillSelect, debounce
  });
})(typeof window !== 'undefined' ? window : globalThis);
