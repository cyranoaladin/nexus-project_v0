interface RoleBadgeProps {
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  ELEVE: "Élève",
  PARENT: "Parent",
  COACH: "Coach",
  ASSISTANTE: "Assistante",
  ADMIN: "Administrateur",
};

export function RoleBadge({ role }: RoleBadgeProps) {
  const normalized = role.toUpperCase();
  const label = ROLE_LABELS[normalized] ?? normalized;
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
      <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
      {label}
    </span>
  );
}
