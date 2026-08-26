import type { Metadata } from "next";
import { Sidebar } from "@/components/navigation/Sidebar";
import { Navbar } from "@/components/navigation/Navbar";
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Dashboard | Nexus Réussite",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/auth/signin');

  return (
    <div className="dashboard-soft min-h-screen bg-surface-darker">
      <Sidebar user={session.user} />
      <Navbar user={session.user} />
      <main id="main-content" tabIndex={-1} className="lg:pl-[280px] pt-16 focus:outline-none">
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
