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
      label: 'Mes Sessions',
      href: '/dashboard/eleve/mes-sessions',
      icon: 'Calendar',
      match: 'prefix'
    },
    {
      label: 'Réserver Session',
      href: '/dashboard/eleve/sessions',
      icon: 'Clock',
      match: 'prefix'
    },
    {
      label: 'Ressources',
      href: '/dashboard/eleve/ressources',
      icon: 'BookOpen',
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
      label: 'Mes Enfants',
      href: '/dashboard/parent/children',
      icon: 'Users',
      match: 'prefix'
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
      label: 'Demandes Crédits',
      href: '/dashboard/assistante/credit-requests',
      icon: 'AlertCircle',
      match: 'prefix'
    },
    {
      label: 'Paiements',
      href: '/dashboard/assistante/paiements',
      icon: 'DollarSign',
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
      label: 'Tests Système',
      href: '/dashboard/admin/tests',
      icon: 'TestTube',
      match: 'prefix'
    }
  ]
};
