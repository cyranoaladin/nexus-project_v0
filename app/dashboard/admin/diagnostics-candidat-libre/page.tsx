import { DiagnosticsQueueWorkspace } from '@/components/dashboard/core-v2/DiagnosticsQueueWorkspace';
import { getOrganizationTimezone } from '@/lib/timezone';

export default function DiagnosticsCandidatLibreQueuePage() {
  return (
    <DiagnosticsQueueWorkspace
      basePath="/dashboard/admin/diagnostics-candidat-libre"
      organizationTimezone={getOrganizationTimezone()}
    />
  );
}
