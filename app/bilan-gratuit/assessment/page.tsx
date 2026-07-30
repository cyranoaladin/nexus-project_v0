import { CanonicalAssessmentWorkspace } from '@/components/bilans/CanonicalAssessmentWorkspace';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';

export default function BilanAssessmentPage() {
  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100">
      <CorporateNavbar />
      <main id="main-content">
        <CanonicalAssessmentWorkspace />
      </main>
      <CorporateFooter />
    </div>
  );
}
