import { CandidatIndividuelPage } from '@/components/dashboard/assistante/CandidatIndividuelPage';

export const metadata = {
  title: 'Simulateur de devis - Candidat individuel | Nexus Réussite',
  robots: { index: false, follow: false },
};

export default function AdminCandidatIndividuelPage() {
  return CandidatIndividuelPage({ staffRole: 'ADMIN' });
}
