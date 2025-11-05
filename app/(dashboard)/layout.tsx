import type { ReactNode } from "react";
import Link from "next/link";
import { getServerSession } from "next-auth";

import { DashboardGuard } from "@/components/dashboard/DashboardGuard";
import { RoleBadge } from "@/components/common/RoleBadge";
import { authOptions } from "@/lib/auth";

const STUDENT_NAV = [
  { href: "/dashboard", label: "Synthèse" },
  { href: "/tasks", label: "Tâches" },
  { href: "/cours", label: "Cours et syllabus" },
  { href: "/agenda", label: "Agenda" },
  { href: "/epreuves", label: "Épreuves" },
  { href: "/evaluations", label: "Évaluations" },
  { href: "/grand-oral", label: "Grand Oral" },
  { href: "/parcoursup", label: "Parcoursup" },
  { href: "/ressources", label: "Ressources" },
] as const;

const PARENT_NAV = [
  { href: "/parent", label: "Vue parent" },
  { href: "/dashboard", label: "Synthèse élève" },
  { href: "/agenda", label: "Agenda" },
  { href: "/epreuves", label: "Épreuves" },
] as const;

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const sessionRole = session?.user?.role ? session.user.role.toUpperCase() : null;
  const navItems = sessionRole === "PARENT" ? PARENT_NAV : STUDENT_NAV;
  const headingLabel = sessionRole === "PARENT" ? "Tableau de bord parent" : "Tableau de bord élève";

  return (
    <DashboardGuard allowedRoles={["ELEVE", "PARENT"]}>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Nexus Réussite
              </p>
              <h1 className="text-xl font-semibold text-slate-900">
                {headingLabel}
              </h1>
            </div>
            {sessionRole ? <RoleBadge role={sessionRole} /> : null}
          </div>
          <nav className="mx-auto max-w-6xl px-4">
            <ul className="flex flex-wrap gap-2 pb-3 text-sm">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    className="inline-flex rounded-full px-3 py-1 font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8 pb-16">
          {children}
        </main>
      </div>
    </DashboardGuard>
  );
}
