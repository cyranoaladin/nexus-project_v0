"use client";

import { useEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const ROLE_REDIRECTS: Record<string, string> = {
  ELEVE: "/dashboard",
  PARENT: "/dashboard/parent",
  COACH: "/dashboard/coach",
  ASSISTANTE: "/dashboard/assistante",
  ADMIN: "/dashboard/admin",
};

export interface DashboardGuardProps {
  allowedRoles?: string[];
  children: React.ReactNode;
}

// Ensures the authenticated user can access protected dashboard pages.
export function DashboardGuard({
  allowedRoles = ["ELEVE"],
  children,
}: DashboardGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const normalizedAllowed = useMemo(
    () => allowedRoles.map((role) => role.toUpperCase()),
    [allowedRoles],
  );

  const destination = useMemo(() => {
    const role = session?.user?.role;
    if (!role) return undefined;
    const normalizedRole = role.toUpperCase();
    if (normalizedAllowed.includes(normalizedRole)) return undefined;
    const candidate = ROLE_REDIRECTS[normalizedRole] ?? "/auth/signin";
    if (candidate === pathname) return undefined;
    return candidate;
  }, [normalizedAllowed, pathname, session?.user?.role]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      router.replace("/auth/signin");
      return;
    }
    if (!destination) return;
    router.replace(destination);
  }, [destination, router, session?.user, status]);

  if (status === "loading" || !session?.user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin" />
          <p>Chargement de votre espace…</p>
        </div>
      </div>
    );
  }

  if (destination) {
    return null;
  }

  return <>{children}</>;
}
