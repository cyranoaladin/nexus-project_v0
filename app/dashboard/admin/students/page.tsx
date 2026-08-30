import { StaffStudentsPage } from '@/components/dashboard/staff/StaffStudentsPage';

interface Props {
  searchParams?: Promise<{ intent?: string | string[] }>;
}

export default async function AdminStudentsPage({ searchParams = Promise.resolve({}) }: Props) {
  const { intent } = await searchParams;
  return StaffStudentsPage({ staffRole: 'ADMIN', intent });
}
