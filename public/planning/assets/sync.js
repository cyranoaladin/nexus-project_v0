/* =====================================================================
   NEXUS PLANNING STUDIO — sync.js
   Mode intégré Nexus : source de vérité serveur (/api/planning-studio),
   verrou optimiste (expectedRevision), brouillon local de récupération,
   sondage léger de la révision courante.
   En mode autonome (double-clic sur index.html, pas de config.js) ce
   module est inerte : Nexus.Sync.isIntegrated() vaut false.
   ===================================================================== */
(function (global) {
  'use strict';
  const Nexus = global.Nexus;

  const config = global.NEXUS_PLANNING_CONFIG && global.NEXUS_PLANNING_CONFIG.mode === 'integrated'
    ? global.NEXUS_PLANNING_CONFIG
    : null;

  function isIntegrated() { return Boolean(config); }
  function apiBase() { return (config && config.apiBase) || '/api/planning-studio'; }

  class SyncError extends Error {
    constructor(status, body, message) {
      super(message || (body && body.message) || ('HTTP ' + status));
      this.name = 'SyncError';
      this.status = status;
      this.body = body || null;
    }
  }

  async function request(path, options) {
    options = options || {};
    let response;
    try {
      response = await fetch(apiBase() + (path || ''), {
        method: options.method || 'GET',
        headers: Object.assign({ 'Accept': 'application/json' }, options.body ? { 'Content-Type': 'application/json' } : {}),
        credentials: 'same-origin',
        cache: 'no-store',
        body: options.body ? JSON.stringify(options.body) : undefined
      });
    } catch (err) {
      throw new SyncError(0, null, 'Serveur injoignable : vérifiez votre connexion.');
    }
    let body = null;
    const text = await response.text();
    if (text) {
      try { body = JSON.parse(text); } catch (e) { body = null; }
    }
    if (!response.ok) throw new SyncError(response.status, body);
    return body;
  }

  function fetchDocument() { return request(''); }
  function fetchMeta() { return request('?meta=1'); }
  function save(input) {
    return request('', { method: 'PUT', body: { expectedRevision: input.expectedRevision, payload: input.payload, action: input.action || 'SAVE', summary: input.summary || undefined } });
  }
  function reset(input) { return request('', { method: 'PUT', body: { expectedRevision: input.expectedRevision, action: 'RESET' } }); }
  function listRevisions(limit) { return request('/revisions' + (limit ? '?limit=' + encodeURIComponent(limit) : '')); }
  function getRevision(revision) { return request('/revisions/' + encodeURIComponent(revision)); }
  function restore(input) { return request('/restore', { method: 'POST', body: { revision: input.revision, expectedRevision: input.expectedRevision } }); }

  /* ---------------------------------------------------------------
     Brouillon local : filet de sécurité (fermeture accidentelle, panne
     réseau, conflit). Jamais appliqué silencieusement au démarrage.
     --------------------------------------------------------------- */
  const DRAFT_KEY = Nexus.STORAGE_KEY + ':draft';
  const draft = {
    save(data, baseRevision) {
      try { global.localStorage.setItem(DRAFT_KEY, JSON.stringify({ baseRevision: baseRevision, savedAt: new Date().toISOString(), data: data })); } catch (e) { /* ignore */ }
    },
    load() {
      try {
        const raw = global.localStorage.getItem(DRAFT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !parsed.data || !Array.isArray(parsed.data.sessions)) return null;
        return parsed;
      } catch (e) { return null; }
    },
    clear() { try { global.localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ } }
  };

  const STATUS_LABELS = {
    saved: 'Enregistré',
    dirty: 'Modifications non enregistrées',
    saving: 'Enregistrement…',
    conflict: 'Conflit de version',
    invalid: 'Non enregistré : conflits bloquants',
    error: 'Erreur d\'enregistrement',
    readonly: 'Lecture seule',
    loading: 'Chargement du planning partagé…'
  };

  Nexus.Sync = { config, isIntegrated, apiBase, request, fetchDocument, fetchMeta, save, reset, listRevisions, getRevision, restore, draft, SyncError, STATUS_LABELS };
})(typeof window !== 'undefined' ? window : globalThis);
