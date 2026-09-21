import { HouseholdsWorkspace } from '@/components/dashboard/core-v2/HouseholdsWorkspace';
import { getOrganizationTimezone } from '@/lib/timezone';

export default function FamillesPage() {
  return <HouseholdsWorkspace basePath="/dashboard/admin/familles" organizationTimezone={getOrganizationTimezone()} />;
}
