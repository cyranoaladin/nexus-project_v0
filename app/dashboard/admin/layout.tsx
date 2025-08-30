'use client';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Menu,
  LayoutDashboard,
  Users as UsersIcon,
  CreditCard,
  Activity,
  BarChart,
  Database,
  Settings,
  TestTube,
  Bug,
  FileText,
} from 'lucide-react';

interface NavLink {
  href: string;
  label: string;
  icon: React.ElementType;
}

const links: NavLink[] = [
  { href: '/dashboard/admin', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/dashboard/admin/users', label: 'Utilisateurs', icon: UsersIcon },
  { href: '/dashboard/admin/subscriptions', label: 'Abonnements', icon: CreditCard },
  { href: '/dashboard/admin/activities', label: 'Activités', icon: Activity },
  { href: '/dashboard/admin/analytics', label: 'Analytique', icon: BarChart },
  { href: '/dashboard/admin/rag-management', label: 'RAG', icon: Database },
  { href: '/dashboard/admin/settings/aria', label: 'Paramètres ARIA', icon: Settings },
  { href: '/dashboard/admin/tests', label: 'Tests', icon: TestTube },
  { href: '/dashboard/admin/debug/pdf', label: 'Debug PDF (Service)', icon: FileText },
  { href: '/dashboard/admin/debug/pdf-aria', label: 'Debug PDF (ARIA)', icon: Bug },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={`fixed z-40 inset-y-0 left-0 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
        aria-label="Admin navigation"
      >
        <div className="h-12 border-b flex items-center px-4 font-semibold text-gray-700">
          Administration
        </div>
        <nav className="p-3 space-y-1 overflow-y-auto h-[calc(100%-3rem)]">
          {links.map((l) => {
            const active =
              pathname === l.href ||
              (l.href !== '/dashboard/admin' && pathname?.startsWith(l.href));
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setOpen(false)}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-blue-700' : 'text-gray-500'}`} />
                <span>{l.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 md:ml-64">
        {/* Top bar */}
        <div className="h-12 bg-white border-b border-gray-200 flex items-center px-3 md:px-6 sticky top-0 z-30">
          <button
            className="md:hidden p-2 rounded hover:bg-gray-100 text-gray-600"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="ml-2 text-sm text-gray-500">Espace Admin</div>
        </div>
        <div className="p-4 md:p-6">{children}</div>
      </div>
    </div>
  );
}
