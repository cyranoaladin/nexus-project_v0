import { StaffStudentsPage } from '@/components/dashboard/staff/StaffStudentsPage';

export default function AdminStudentsPage() {
  return StaffStudentsPage({ staffRole: 'ADMIN' });
}
