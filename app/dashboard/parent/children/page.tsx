import { redirect } from 'next/navigation';

/**
 * Phase 5 — la liste des enfants est désormais la home parent (`/dashboard/parent`).
 * Cette ancienne page est conservée comme redirect pour ne casser aucun bookmark.
 */
export default function ParentChildrenLegacyRedirectPage() {
  redirect('/dashboard/parent');
}
