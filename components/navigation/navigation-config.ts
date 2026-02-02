import { UserRole } from '@/types/enums';
import {
  Home,
  Calendar,
  Users,
  BookOpen,
  CreditCard,
  DollarSign,
  Clock,
  UserCheck,
  AlertCircle,
  BarChart,
  Activity,
  TestTube,
  type LucideIcon
} from 'lucide-react';

export interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
}

export const navigationConfig: Record<UserRole, NavigationItem[]> = {
  [UserRole.ELEVE]: [
    {
      label: 'Dashboard',
      href: '/dashboard/eleve',
      icon: Home
    },
    {
      label: 'Mes Sessions',
      href: '/dashboard/eleve/mes-sessions',
      icon: Calendar
    },
    {
      label: 'Réserver Session',
      href: '/dashboard/eleve/sessions',
      icon: Clock
    },
    {
      label: 'Ressources',
      href: '/dashboard/eleve/ressources',
      icon: BookOpen
    }
  ],
  [UserRole.PARENT]: [
    {
      label: 'Dashboard',
      href: '/dashboard/parent',
      icon: Home
    },
    {
      label: 'Mes Enfants',
      href: '/dashboard/parent/children',
      icon: Users
    },
    {
      label: 'Abonnements',
      href: '/dashboard/parent/abonnements',
      icon: CreditCard
    },
    {
      label: 'Paiements',
      href: '/dashboard/parent/paiement',
      icon: DollarSign
    }
  ],
  [UserRole.COACH]: [
    {
      label: 'Dashboard',
      href: '/dashboard/coach',
      icon: Home
    },
    {
      label: 'Mes Sessions',
      href: '/dashboard/coach/sessions',
      icon: Calendar
    },
    {
      label: 'Mes Étudiants',
      href: '/dashboard/coach/students',
      icon: Users
    },
    {
      label: 'Disponibilités',
      href: '/dashboard/coach/availability',
      icon: Clock
    }
  ],
  [UserRole.ASSISTANTE]: [
    {
      label: 'Dashboard',
      href: '/dashboard/assistante',
      icon: Home
    },
    {
      label: 'Étudiants',
      href: '/dashboard/assistante/students',
      icon: Users
    },
    {
      label: 'Coaches',
      href: '/dashboard/assistante/coaches',
      icon: UserCheck
    },
    {
      label: 'Abonnements',
      href: '/dashboard/assistante/subscriptions',
      icon: CreditCard
    },
    {
      label: 'Demandes Crédits',
      href: '/dashboard/assistante/credit-requests',
      icon: AlertCircle
    },
    {
      label: 'Paiements',
      href: '/dashboard/assistante/paiements',
      icon: DollarSign
    }
  ],
  [UserRole.ADMIN]: [
    {
      label: 'Dashboard',
      href: '/dashboard/admin',
      icon: Home
    },
    {
      label: 'Utilisateurs',
      href: '/dashboard/admin/users',
      icon: Users
    },
    {
      label: 'Analytics',
      href: '/dashboard/admin/analytics',
      icon: BarChart
    },
    {
      label: 'Abonnements',
      href: '/dashboard/admin/subscriptions',
      icon: CreditCard
    },
    {
      label: 'Activités',
      href: '/dashboard/admin/activities',
      icon: Activity
    },
    {
      label: 'Tests Système',
      href: '/dashboard/admin/tests',
      icon: TestTube
    }
  ]
};
