import { StaffStudentsPage } from '@/components/dashboard/staff/StaffStudentsPage';

export default function AssistanteStudentsPage() {
  return StaffStudentsPage({ staffRole: 'ASSISTANTE' });
}
