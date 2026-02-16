import type { Metadata } from "next";
import { Sidebar } from "@/components/navigation/Sidebar";
import { Navbar } from "@/components/navigation/Navbar";

export const metadata: Metadata = {
  title: "Dashboard | Nexus Réussite",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-darker">
      <Sidebar />
      <Navbar />
      <main className="lg:pl-[280px] pt-16">
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
