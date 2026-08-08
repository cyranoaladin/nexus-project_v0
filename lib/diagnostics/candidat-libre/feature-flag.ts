import 'server-only';

import { NextResponse } from 'next/server';

/**
 * Global kill switch for the whole candidate-libre diagnostic feature.
 *
 * Independent of the per-user entitlement system in lib/access/ — that
 * system grants features to paying accounts, this is a repo-wide dark
 * switch. OFF means dark for every role, including staff and ADMIN, with
 * no exemption, until a real dossier is explicitly activated (Phase P).
 * Defaults to disabled: an unset or misconfigured env var must never
 * accidentally turn the feature on.
 */
export function isCandidateDiagnosticFeatureEnabled(): boolean {
  return process.env.CANDIDATE_DIAGNOSTIC_ENABLED === 'true';
}

/** For API routes: returns a 404 (not 403 — the route must look absent) when the flag is off, else null. */
export function guardCandidateDiagnosticFeature(): NextResponse | null {
  if (isCandidateDiagnosticFeatureEnabled()) return null;
  return NextResponse.json({ error: 'Not Found' }, { status: 404 });
}

/**
 * Élèves pour lesquels le diagnostic est ouvert, dans l'ordre de configuration.
 *
 * Le rôle `ELEVE_CANDIDAT_LIBRE` n'existe pas et la fonctionnalité ne porte
 * aucun contrôle d'éligibilité : sans cette liste, allumer le drapeau
 * ouvrirait le diagnostic à tous les élèves et parents de la base. L'allowlist
 * tient donc lieu des deux, et permet d'ouvrir un dossier — et un seul.
 */
export function listAllowedCandidateStudentIds(): readonly string[] {
  const raw = process.env.CANDIDATE_DIAGNOSTIC_STUDENT_IDS ?? '';
  const seen = new Set<string>();
  for (const entry of raw.split(',')) {
    const id = entry.trim();
    if (id.length > 0) seen.add(id);
  }
  return Object.freeze([...seen]);
}

/**
 * Le diagnostic est-il ouvert pour cet élève ?
 *
 * Conjonction stricte : le kill switch garde le dernier mot, et une allowlist
 * vide n'ouvre rien. Aucune correspondance partielle — l'identifiant doit
 * figurer tel quel.
 */
export function isCandidateDiagnosticEnabledForStudent(studentId: string): boolean {
  if (!isCandidateDiagnosticFeatureEnabled()) return false;
  if (typeof studentId !== 'string' || studentId.length === 0) return false;
  return listAllowedCandidateStudentIds().includes(studentId);
}

/**
 * Pour les routes portant sur un élève : 404 tant qu'il n'est pas autorisé.
 *
 * Volontairement 404 et non 403 — hors allowlist, la fonctionnalité doit
 * paraître absente, exactement comme lorsque le kill switch est éteint. Un 403
 * révélerait son existence, et donc celle du dossier.
 */
export function guardCandidateDiagnosticForStudent(studentId: string): NextResponse | null {
  if (isCandidateDiagnosticEnabledForStudent(studentId)) return null;
  return NextResponse.json({ error: 'Not Found' }, { status: 404 });
}
