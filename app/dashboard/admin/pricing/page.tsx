'use client';

import dynamic from 'next/dynamic';

const AdminPricingDashboard = dynamic(() => import('@/components/admin/AdminPricingDashboard'), { ssr: false });

export default function Page() {
  return <AdminPricingDashboard />;
}
