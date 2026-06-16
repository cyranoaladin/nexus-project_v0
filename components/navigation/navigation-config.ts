import { UserRole } from '@/types/enums';

export interface NavigationItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
  match?: 'exact' | 'prefix';
}

export const navigationConfig: Record<UserRole, NavigationItem[]> = {
  [UserRole.ELEVE]: [
    {
      label: 'Dashboard',
      href: '/dashboard/eleve',
      icon: 'Home',
      match: 'exact'
    },
    {
      label: 'Sessions',
      href: '/dashboard/eleve#sessions',
      icon: 'Calendar',
      match: 'exact'
    },
    {
      label: 'Programme',
      href: '/dashboard/eleve#programme-maths',
      icon: 'Clock',
      match: 'exact'
    },
    {
      label: 'Ressources',
      href: '/dashboard/eleve#resources',
      icon: 'BookOpen',
      match: 'exact'
    },
    {
      label: 'ARIA',
      href: '/dashboard/eleve#aria',
      icon: 'MessageSquare',
      match: 'exact'
    },
    {
      label: 'Stages',
      href: '/dashboard/eleve#stages',
      icon: 'GraduationCap',
      match: 'exact'
    },
    {
      label: 'NSI Pratique',
      href: '/dashboard/eleve/nsi-pratique-2026',
      icon: 'Code2',
      match: 'prefix'
    },
    {
      label: 'Mes Diagnostics',
      href: '/dashboard/eleve/npc',
      icon: 'ClipboardCheck',
      match: 'prefix'
    }
  ],
  [UserRole.PARENT]: [
    {
      label: 'Dashboard',
      href: '/dashboard/parent',
      icon: 'Home',
      match: 'exact'
    },
    {
      label: 'Abonnements',
      href: '/dashboard/parent/abonnements',
      icon: 'CreditCard',
      match: 'prefix'
    },
    {
      label: 'Paiements',
      href: '/dashboard/parent/paiement',
      icon: 'DollarSign',
      match: 'prefix'
    },
    {
      label: 'Factures',
      href: '/dashboard/parent/factures',
      icon: 'Receipt',
      match: 'prefix'
    },
    {
      label: 'Mes Ressources',
      href: '/dashboard/parent/ressources',
      icon: 'FileText',
      match: 'prefix'
    },
    {
      label: 'Stages',
      href: '/dashboard/parent/stages',
      icon: 'GraduationCap',
      match: 'prefix'
    },
    {
      label: 'Diagnostics',
      href: '/dashboard/parent/npc',
      icon: 'ClipboardCheck',
      match: 'prefix'
    }
  ],
  [UserRole.COACH]: [
    {
      label: 'Dashboard',
      href: '/dashboard/coach',
      icon: 'Home',
      match: 'exact'
    },
    {
      label: 'Mes Sessions',
      href: '/dashboard/coach/sessions',
      icon: 'Calendar',
      match: 'prefix'
    },
    {
      label: 'Mes Étudiants',
      href: '/dashboard/coach/students',
      icon: 'Users',
      match: 'prefix'
    },
    {
      label: 'Disponibilités',
      href: '/dashboard/coach/availability',
      icon: 'Clock',
      match: 'prefix'
    },
    {
      label: 'Mes Stages',
      href: '/dashboard/coach/stages',
      icon: 'GraduationCap',
      match: 'prefix'
    },
    {
      label: 'NSI Pratique',
      href: '/dashboard/coach/nsi-pratique-2026',
      icon: 'Code2',
      match: 'prefix'
    },
    {
      label: 'Pédagogie',
      href: '/dashboard/coach/npc',
      icon: 'ClipboardCheck',
      match: 'prefix'
    }
  ],
  [UserRole.ASSISTANTE]: [
    {
      label: 'Dashboard',
      href: '/dashboard/assistante',
      icon: 'Home',
      match: 'exact'
    },
    {
      label: 'Étudiants',
      href: '/dashboard/assistante/students',
      icon: 'Users',
      match: 'prefix'
    },
    {
      label: 'Planning',
      href: '/dashboard/assistante/planning',
      icon: 'Calendar',
      match: 'prefix'
    },
    {
      label: 'Assignations',
      href: '/dashboard/assistante/assignments',
      icon: 'ClipboardList',
      match: 'prefix'
    },
    {
      label: 'Coaches',
      href: '/dashboard/assistante/coaches',
      icon: 'UserCheck',
      match: 'prefix'
    },
    {
      label: 'Abonnements',
      href: '/dashboard/assistante/subscriptions',
      icon: 'CreditCard',
      match: 'prefix'
    },
    {
      label: 'Paiements',
      href: '/dashboard/assistante/paiements',
      icon: 'DollarSign',
      match: 'prefix'
    },
    {
      label: 'Facturation',
      href: '/dashboard/assistante/facturation',
      icon: 'Receipt',
      match: 'prefix'
    },
    {
      label: 'Assistant devis',
      href: '/dashboard/assistante/devis',
      icon: 'Calculator',
      match: 'prefix'
    },
    {
      label: 'Stages',
      href: '/dashboard/assistante/stages',
      icon: 'GraduationCap',
      match: 'prefix'
    },
    {
      label: 'Documents',
      href: '/dashboard/assistante/docs',
      icon: 'FolderOpen',
      match: 'prefix'
    }
  ],
  [UserRole.ADMIN]: [
    {
      label: 'Dashboard',
      href: '/dashboard/admin',
      icon: 'Home',
      match: 'exact'
    },
    {
      label: 'Utilisateurs',
      href: '/dashboard/admin/users',
      icon: 'Users',
      match: 'prefix'
    },
    {
      label: 'Analytics',
      href: '/dashboard/admin/analytics',
      icon: 'BarChart',
      match: 'prefix'
    },
    {
      label: 'Abonnements',
      href: '/dashboard/admin/subscriptions',
      icon: 'CreditCard',
      match: 'prefix'
    },
    {
      label: 'Activités',
      href: '/dashboard/admin/activities',
      icon: 'Activity',
      match: 'prefix'
    },
    {
      label: 'Stages',
      href: '/dashboard/admin/stages',
      icon: 'GraduationCap',
      match: 'prefix'
    },
    {
      label: 'Facturation',
      href: '/dashboard/admin/facturation',
      icon: 'Receipt',
      match: 'prefix'
    },
    {
      label: 'Documents',
      href: '/dashboard/admin/documents',
      icon: 'FileText',
      match: 'prefix'
    },
    {
      label: 'Tests Système',
      href: '/dashboard/admin/tests',
      icon: 'TestTube',
      match: 'prefix'
    }
  ]
};
