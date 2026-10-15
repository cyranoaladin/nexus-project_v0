'use client';
import Link from 'next/link';
import { useCanonicalSession } from '@/components/auth/SessionRecoveryProvider';
import { useCoreMembership } from '@/hooks/use-core-membership';
import { CoreMembershipNotice, V1SpaceLink } from './CoreRoleHome';
import { ParentHousehold } from './ParentHousehold';
import { StudentEnrollments } from './StudentEnrollments';
import { CoachAssignments } from './CoachAssignments';
import { HouseholdsWorkspace } from './HouseholdsWorkspace';
import { HouseholdDetail } from './HouseholdDetail';
import { AcademicYearsPanel } from './AcademicYearsPanel';
import { PlanningWeek } from './PlanningWeek';
import { PilotageWorkspace } from './PilotageWorkspace';
import { DiagnosticsQueueWorkspace } from './DiagnosticsQueueWorkspace';
import { DiagnosticBilanReview } from './DiagnosticBilanReview';

const base = '/dashboard/core';
const familyBase = `${base}/familles`;
const diagnosticBase = `${base}/diagnostics-candidat-libre`;
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
function StaffPanel({ view, organizationTimezone }: { view: readonly string[]; organizationTimezone: string }) {
  const path = view.join('/');
  if (!path || path === 'pilotage') return <PilotageWorkspace basePath={familyBase} />;
  if (path === 'familles') return <HouseholdsWorkspace basePath={familyBase} organizationTimezone={organizationTimezone} />;
  if (path === 'familles/annees') return <AcademicYearsPanel />;
  if (path === 'familles/planning') return <PlanningWeek basePath={familyBase} />;
  if (view.length === 2 && view[0] === 'familles' && uuid.test(view[1])) return <HouseholdDetail householdId={view[1]} basePath={familyBase} />;
  if (path === 'diagnostics-candidat-libre') return <DiagnosticsQueueWorkspace basePath={diagnosticBase} organizationTimezone={organizationTimezone} />;
  if (view.length === 2 && view[0] === 'diagnostics-candidat-libre' && uuid.test(view[1])) return <DiagnosticBilanReview submissionId={view[1]} />;
  return <p role="status">Page indisponible.</p>;
}

/** The V1 role is never substituted; each mounted panel calls guarded Core APIs. */
export function CoreWorkspace({ view, organizationTimezone }: { view: readonly string[]; organizationTimezone: string }) {
  const membership = useCoreMembership();
  const session = useCanonicalSession();
  if (membership.state !== 'ACTIVE') return <CoreMembershipNotice membership={membership} />;
  const staff = membership.role === 'ADMIN' || membership.role === 'ASSISTANTE';
  return <section key={`${session.data?.user.id}:${membership.role}`} className="space-y-6">
    <header className="space-y-3"><h1 className="text-2xl font-semibold">Espace académique</h1><V1SpaceLink /></header>
    {staff ? <>
      <nav aria-label="Espace académique" className="flex flex-wrap gap-4">
        <Link href={familyBase}>Familles</Link>
        <Link href={`${familyBase}/planning`}>Planning</Link>
        <Link href={`${base}/pilotage`}>Suivi et habilitations</Link>
        <Link href={`${familyBase}/annees`}>Années scolaires</Link>
        <Link href={diagnosticBase}>Bilans</Link>
      </nav>
      <StaffPanel view={view} organizationTimezone={organizationTimezone} />
    </> : view.length > 0 ? <p role="status">Page indisponible.</p>
      : membership.role === 'PARENT' ? <ParentHousehold />
        : membership.role === 'COACH' ? <CoachAssignments />
          : <><Link href="/dashboard/eleve/aria">Mon cockpit ARIA</Link><StudentEnrollments /></>}
  </section>;
}
