import { serializeError } from '@/lib/utils/serialize-error';
/**
 * Utilitaires pour la gestion des salles de visioconférence Jitsi
 * Implémentation selon les directives CTO pour Nexus Réussite
 *
 * Ce module est importé à la fois côté serveur (app/api/sessions/[sessionId])
 * ET côté client (components/ui/video-conference.tsx, "use client") — il ne
 * doit donc JAMAIS importer `node:crypto` ou tout autre module Node-only, ce
 * qui casserait le bundle webpack client (`UnhandledSchemeError: node:crypto`).
 * Le générateur de graine HMAC (qui a réellement besoin de `node:crypto`) vit
 * séparément dans lib/jitsi-server.ts, importé uniquement côté serveur.
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

/**
 * Génère une URL de salle Jitsi unique et sécurisée
 * @param sessionId - L'ID de la session de cours
 * @param userType - Type d'utilisateur ('coach' | 'student')
 * @returns L'URL complète de la salle Jitsi
 */
export function generateJitsiRoomUrl(sessionId: string, userType: 'coach' | 'student' = 'student'): string {
  // Générer un UUID unique pour cette session
  const uuid = crypto.randomUUID();

  // Construire le nom de salle unique et difficile à deviner
  const roomName = `nexus-reussite-session-${sessionId}-${uuid}`;

  // Construire l'URL complète
  return `${getJitsiServerUrl()}/${roomName}`;
}

/**
 * Génère un nom de salle Jitsi déterministe pour une session donnée
 * Utile quand on veut que tous les participants rejoignent la même salle
 * @param sessionId - L'ID de la session de cours
 * @param additionalSeed - Graine additionnelle optionnelle
 * @returns Le nom de la salle (sans l'URL du serveur)
 */
export function generateDeterministicRoomName(sessionId: string, additionalSeed?: string): string {
  const seed = additionalSeed || 'nexus-default';
  // Utiliser sessionId + seed pour créer un nom déterministe mais unique
  const hash = btoa(`${sessionId}-${seed}`).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return `nexus-reussite-${sessionId.slice(0, 8)}-${hash.slice(0, 12)}`;
}

/**
 * Génère l'URL complète Jitsi avec nom déterministe
 * @param sessionId - L'ID de la session de cours
 * @param additionalSeed - Graine additionnelle optionnelle
 * @returns L'URL complète de la salle Jitsi
 */
export function generateDeterministicJitsiUrl(sessionId: string, additionalSeed?: string): string {
  const roomName = generateDeterministicRoomName(sessionId, additionalSeed);
  return `${getJitsiServerUrl()}/${roomName}`;
}

/**
 * Extrait les informations d'une URL Jitsi
 * @param jitsiUrl - L'URL complète Jitsi
 * @returns Objet contenant le serveur et le nom de salle
 */
export function parseJitsiUrl(jitsiUrl: string): { server: string; roomName: string; } | null {
  try {
    const url = new URL(jitsiUrl);
    const roomName = url.pathname.substring(1); // Enlever le '/' initial
    return {
      server: `${url.protocol}//${url.host}`,
      roomName
    };
  } catch (error) {
    console.error('Erreur parsing URL Jitsi:', serializeError(error));
    return null;
  }
}

/**
 * Valide qu'une URL Jitsi est correctement formée
 * @param jitsiUrl - L'URL à valider
 * @returns true si l'URL est valide
 */
export function isValidJitsiUrl(jitsiUrl: string): boolean {
  const parsed = parseJitsiUrl(jitsiUrl);
  return parsed !== null && parsed.roomName.length > 0;
}

/**
 * Configuration des paramètres Jitsi pour l'iframe
 * @param userDisplayName - Le nom d'affichage de l'utilisateur
 * @param isHost - Si l'utilisateur est l'hôte (coach)
 * @returns URL avec paramètres configurés
 */
export function buildJitsiUrlWithConfig(
  baseUrl: string,
  userDisplayName: string,
  isHost: boolean = false
): string {
  const url = new URL(baseUrl);

  // Paramètres standard pour Nexus Réussite
  const params = new URLSearchParams({
    // Configuration utilisateur
    'userInfo.displayName': userDisplayName,

    // Configuration interface
    'config.startWithAudioMuted': 'false',
    'config.startWithVideoMuted': 'false',
    'config.prejoinPageEnabled': 'false',
    'config.subject': 'Session Nexus Réussite',
    'config.defaultLanguage': 'fr',

    // Limitations pour étudiants
    ...(isHost ? {} : {
      'config.disableModeratorIndicator': 'true',
      'config.disableProfile': 'true'
    }),

    // Branding et sécurité
    'interfaceConfig.SHOW_JITSI_WATERMARK': 'false',
    'interfaceConfig.SHOW_WATERMARK_FOR_GUESTS': 'false',
    'interfaceConfig.BRAND_WATERMARK_LINK': '',
    'interfaceConfig.SHOW_POWERED_BY': 'false'
  });

  // Ajouter les paramètres à l'URL
  url.search = params.toString();

  return url.toString();
}

/**
 * Types TypeScript pour une meilleure sécurité de type
 */
export interface JitsiRoomInfo {
  roomName: string;
  fullUrl: string;
  serverUrl: string;
  sessionId: string;
  isHost: boolean;
}

/**
 * Crée un objet JitsiRoomInfo complet
 * @param sessionId - L'ID de la session
 * @param userDisplayName - Nom d'affichage
 * @param isHost - Si c'est l'hôte
 * @returns Objet JitsiRoomInfo complet
 */
export function createJitsiRoomInfo(
  sessionId: string,
  userDisplayName: string,
  isHost: boolean = false
): JitsiRoomInfo {
  const baseUrl = generateDeterministicJitsiUrl(sessionId);
  const fullUrl = buildJitsiUrlWithConfig(baseUrl, userDisplayName, isHost);
  const serverUrl = getJitsiServerUrl();
  const roomName = generateDeterministicRoomName(sessionId);

  return {
    roomName,
    fullUrl,
    serverUrl,
    sessionId,
    isHost
  };
}
