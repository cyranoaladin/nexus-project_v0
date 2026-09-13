/**
 * Utilitaires pour la gestion des salles de visioconférence Jitsi
 * Implémentation selon les directives CTO pour Nexus Réussite
 *
 * Ce module est importé à la fois côté serveur (app/api/sessions/[sessionId])
 * ET côté client (components/ui/video-conference.tsx, "use client") — il ne
 * doit donc JAMAIS importer `node:crypto` ou tout autre module Node-only, ce
 * qui casserait le bundle webpack client (`UnhandledSchemeError: node:crypto`).
 * La résolution déterministe du nom de salle (qui a réellement besoin de
 * `node:crypto` et d'un secret serveur) vit exclusivement dans
 * lib/jitsi-server.ts, importé uniquement côté serveur — aucun nom de salle
 * n'est jamais calculé côté client, seulement affiché tel que renvoyé par
 * `GET`/`POST /api/sessions/[sessionId]`.
 */

const DEFAULT_JITSI_SERVER_URL = 'https://meet.jit.si';

/**
 * Seule autorité pour l'URL du serveur Jitsi — toute lecture de
 * `NEXT_PUBLIC_JITSI_SERVER_URL` (serveur ou client) doit passer par ici,
 * jamais réimplémenter `process.env.NEXT_PUBLIC_JITSI_SERVER_URL ||
 * 'https://meet.jit.si'` localement (c'était le cas à 4 endroits séparés,
 * dont un composant client qui ignorait totalement la variable d'env).
 */
export function getJitsiServerUrl(): string {
  return process.env.NEXT_PUBLIC_JITSI_SERVER_URL || DEFAULT_JITSI_SERVER_URL;
}

/** Domaine nu (sans protocole), tel qu'attendu par `JitsiMeetExternalAPI(domain, options)`. */
export function getJitsiDomain(): string {
  return getJitsiServerUrl().replace(/^https?:\/\//, '').replace(/\/$/, '');
}
