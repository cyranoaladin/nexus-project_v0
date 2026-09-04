/* =====================================================================
   NEXUS PLANNING STUDIO — storage.js
   Persistance locale (localStorage) et pile Annuler / Rétablir.
   ===================================================================== */
(function (global) {
  'use strict';
  const Nexus = global.Nexus;
  const { STORAGE_KEY, SCHEMA_VERSION, normalize, deepClone } = Nexus;

  const PREFS_KEY = STORAGE_KEY + ':prefs';
  const HISTORY_LIMIT = 80;

  function storageAvailable() {
    try {
      const k = STORAGE_KEY + ':test';
      global.localStorage.setItem(k, '1');
      global.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Charge l'état sauvegardé. Retourne { data, source, message }
   * source ∈ 'storage' | 'default' | 'default-corrupt'
   */
  function load(defaultData) {
    if (!storageAvailable()) {
      return { data: normalize(deepClone(defaultData)), source: 'default', message: 'Stockage local indisponible : les modifications ne seront pas conservées.' };
    }
    let raw = null;
    try {
      raw = global.localStorage.getItem(STORAGE_KEY);
    } catch (e) { raw = null; }
    if (!raw) return { data: normalize(deepClone(defaultData)), source: 'default', message: '' };
    try {
      const parsed = JSON.parse(raw);
      const payload = parsed && parsed.data ? parsed.data : parsed;
      if (
        !payload ||
        typeof payload !== 'object' ||
        !Array.isArray(payload.sessions) ||
        !Array.isArray(payload.teachers) ||
        !Array.isArray(payload.rooms) ||
        !Array.isArray(payload.subjects)
      ) {
        throw new Error('structure');
      }
      return { data: normalize(payload), source: 'storage', message: '', savedAt: parsed.savedAt || '' };
    } catch (e) {
      // sauvegarde corrompue : on la conserve sous une clé de secours unique puis on nettoie la clé principale
      try {
        global.localStorage.setItem(STORAGE_KEY + ':corrupt-backup', raw);
        global.localStorage.removeItem(STORAGE_KEY);
      } catch (e2) { /* ignore */ }
      return { data: normalize(deepClone(defaultData)), source: 'default-corrupt', message: 'La sauvegarde locale était illisible : le planning initial a été rechargé (copie conservée).' };
    }
  }

  function save(data) {
    if (!storageAvailable()) return false;
    try {
      const payload = { schemaVersion: SCHEMA_VERSION, savedAt: new Date().toISOString(), data: data };
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearSaved() {
    try { global.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  function loadPrefs() {
    try {
      const raw = global.localStorage.getItem(PREFS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (e) { return {}; }
  }
  function savePrefs(prefs) {
    try { global.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ }
  }

  /* ---------------------------------------------------------------
     Historique : snapshots complets (données petites : quelques dizaines
     de Ko), limité à HISTORY_LIMIT entrées.
     --------------------------------------------------------------- */
  function createHistory(limit) {
    limit = limit || HISTORY_LIMIT;
    const past = [];
    const future = [];
    return {
      push(snapshot, label) {
        past.push({ snapshot: JSON.stringify(snapshot), label: label || '' });
        if (past.length > limit) past.shift();
        future.length = 0;
      },
      canUndo() { return past.length > 0; },
      canRedo() { return future.length > 0; },
      undo(current) {
        if (!past.length) return null;
        const entry = past.pop();
        future.push({ snapshot: JSON.stringify(current), label: entry.label });
        return { data: JSON.parse(entry.snapshot), label: entry.label };
      },
      redo(current) {
        if (!future.length) return null;
        const entry = future.pop();
        past.push({ snapshot: JSON.stringify(current), label: entry.label });
        return { data: JSON.parse(entry.snapshot), label: entry.label };
      },
      undoLabel() { return past.length ? past[past.length - 1].label : ''; },
      redoLabel() { return future.length ? future[future.length - 1].label : ''; },
      clear() { past.length = 0; future.length = 0; },
      dropFuture() { future.length = 0; },
      size() { return past.length; }
    };
  }

  Object.assign(Nexus, { storageAvailable, load, save, clearSaved, loadPrefs, savePrefs, createHistory, HISTORY_LIMIT });
})(typeof window !== 'undefined' ? window : globalThis);
