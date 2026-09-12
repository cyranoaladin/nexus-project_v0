import { Suspense } from 'react';
import { PlanningWeek } from '@/components/dashboard/core-v2/PlanningWeek';

export default function PlanningPage() {
  return (
    <Suspense fallback={<p role="status" className="text-neutral-300">Chargement du planning…</p>}>
      <PlanningWeek basePath="/dashboard/assistante/familles" />
    </Suspense>
  );
}
