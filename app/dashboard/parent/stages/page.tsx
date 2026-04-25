import { redirect } from 'next/navigation';

/**
 * Phase 5 — l'inscription stages parent est désormais une section
 * (anchor `#stages`) de `/dashboard/parent`. Cette ancienne page est
 * conservée comme redirect pour ne casser aucun bookmark.
 */
export default function ParentStagesLegacyRedirectPage() {
  redirect('/dashboard/parent#stages');
}
