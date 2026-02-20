/**
 * Navigation Role Access Tests
 *
 * Verifies that the navigation config provides correct links based on user roles.
 * Tests ensure proper role-based access control in the navigation system.
 */

import { describe, it, expect } from '@jest/globals';
import { navigationConfig } from '@/components/navigation/navigation-config';
import { UserRole } from '@/types/enums';

describe('Navigation Role Access', () => {
  describe('ELEVE role', () => {
    it('should not have Admin links (Utilisateurs, Analytics, Tests Système)', () => {
      const eleveNavItems = navigationConfig[UserRole.ELEVE];
      
      const adminLinks = [
        '/dashboard/admin/users',
        '/dashboard/admin/analytics',
        '/dashboard/admin/tests',
        '/dashboard/admin/subscriptions',
        '/dashboard/admin/activities'
      ];
      
      const eleveHrefs = eleveNavItems.map(item => item.href);
      
      adminLinks.forEach(adminLink => {
        expect(eleveHrefs).not.toContain(adminLink);
      });
    });

    it('should have correct links for ELEVE role', () => {
      const eleveNavItems = navigationConfig[UserRole.ELEVE];
      const eleveHrefs = eleveNavItems.map(item => item.href);
      
      expect(eleveHrefs).toContain('/dashboard/eleve');
      expect(eleveHrefs).toContain('/dashboard/eleve/mes-sessions');
      expect(eleveHrefs).toContain('/dashboard/eleve/sessions');
      expect(eleveHrefs).toContain('/dashboard/eleve/ressources');
      expect(eleveNavItems).toHaveLength(4);
    });
  });

  describe('ADMIN role', () => {
    it('should have Admin links visible', () => {
      const adminNavItems = navigationConfig[UserRole.ADMIN];
      const adminHrefs = adminNavItems.map(item => item.href);
      
      expect(adminHrefs).toContain('/dashboard/admin/users');
      expect(adminHrefs).toContain('/dashboard/admin/analytics');
      expect(adminHrefs).toContain('/dashboard/admin/tests');
      expect(adminHrefs).toContain('/dashboard/admin/subscriptions');
      expect(adminHrefs).toContain('/dashboard/admin/activities');
    });

    it('should have correct links for ADMIN role', () => {
      const adminNavItems = navigationConfig[UserRole.ADMIN];
      
      expect(adminNavItems).toHaveLength(7);
      expect(adminNavItems[0].href).toBe('/dashboard/admin');
      expect(adminNavItems[1].href).toBe('/dashboard/admin/users');
      expect(adminNavItems[2].href).toBe('/dashboard/admin/analytics');
      expect(adminNavItems[3].href).toBe('/dashboard/admin/subscriptions');
      expect(adminNavItems[4].href).toBe('/dashboard/admin/activities');
      expect(adminNavItems[5].href).toBe('/dashboard/admin/tests');
      expect(adminNavItems[6].href).toBe('/dashboard/admin/documents');
    });
  });

  describe('PARENT role', () => {
    it('should have correct links for PARENT role', () => {
      const parentNavItems = navigationConfig[UserRole.PARENT];
      const parentHrefs = parentNavItems.map(item => item.href);
      
      expect(parentHrefs).toContain('/dashboard/parent');
      expect(parentHrefs).toContain('/dashboard/parent/children');
      expect(parentHrefs).toContain('/dashboard/parent/abonnements');
      expect(parentHrefs).toContain('/dashboard/parent/paiement');
      expect(parentNavItems).toHaveLength(5);
    });

    it('should not have Admin links', () => {
      const parentNavItems = navigationConfig[UserRole.PARENT];
      const parentHrefs = parentNavItems.map(item => item.href);
      
      const adminLinks = [
        '/dashboard/admin/users',
        '/dashboard/admin/analytics',
        '/dashboard/admin/tests'
      ];
      
      adminLinks.forEach(adminLink => {
        expect(parentHrefs).not.toContain(adminLink);
      });
    });
  });

  describe('COACH role', () => {
    it('should have correct links for COACH role', () => {
      const coachNavItems = navigationConfig[UserRole.COACH];
      const coachHrefs = coachNavItems.map(item => item.href);
      
      expect(coachHrefs).toContain('/dashboard/coach');
      expect(coachHrefs).toContain('/dashboard/coach/sessions');
      expect(coachHrefs).toContain('/dashboard/coach/students');
      expect(coachHrefs).toContain('/dashboard/coach/availability');
      expect(coachNavItems).toHaveLength(4);
    });

    it('should not have Admin links', () => {
      const coachNavItems = navigationConfig[UserRole.COACH];
      const coachHrefs = coachNavItems.map(item => item.href);
      
      const adminLinks = [
        '/dashboard/admin/users',
        '/dashboard/admin/analytics',
        '/dashboard/admin/tests'
      ];
      
      adminLinks.forEach(adminLink => {
        expect(coachHrefs).not.toContain(adminLink);
      });
    });
  });

  describe('ASSISTANTE role', () => {
    it('should have correct links for ASSISTANTE role', () => {
      const assistanteNavItems = navigationConfig[UserRole.ASSISTANTE];
      const assistanteHrefs = assistanteNavItems.map(item => item.href);
      
      expect(assistanteHrefs).toContain('/dashboard/assistante');
      expect(assistanteHrefs).toContain('/dashboard/assistante/students');
      expect(assistanteHrefs).toContain('/dashboard/assistante/coaches');
      expect(assistanteHrefs).toContain('/dashboard/assistante/subscriptions');
      expect(assistanteHrefs).toContain('/dashboard/assistante/credit-requests');
      expect(assistanteHrefs).toContain('/dashboard/assistante/paiements');
      expect(assistanteNavItems).toHaveLength(6);
    });

    it('should not have Admin links', () => {
      const assistanteNavItems = navigationConfig[UserRole.ASSISTANTE];
      const assistanteHrefs = assistanteNavItems.map(item => item.href);
      
      const adminLinks = [
        '/dashboard/admin/users',
        '/dashboard/admin/analytics',
        '/dashboard/admin/tests'
      ];
      
      adminLinks.forEach(adminLink => {
        expect(assistanteHrefs).not.toContain(adminLink);
      });
    });
  });

  describe('All roles', () => {
    it('should have navigation config defined for all UserRole values', () => {
      const allRoles = Object.values(UserRole);
      
      allRoles.forEach(role => {
        expect(navigationConfig[role]).toBeDefined();
        expect(Array.isArray(navigationConfig[role])).toBe(true);
        expect(navigationConfig[role].length).toBeGreaterThan(0);
      });
    });

    it('should not have duplicate hrefs within any role config', () => {
      const allRoles = Object.values(UserRole);
      
      allRoles.forEach(role => {
        const navItems = navigationConfig[role];
        const hrefs = navItems.map(item => item.href);
        const uniqueHrefs = new Set(hrefs);
        
        expect(hrefs.length).toBe(uniqueHrefs.size);
      });
    });

    it('should have all navigation items with required fields', () => {
      const allRoles = Object.values(UserRole);
      
      allRoles.forEach(role => {
        const navItems = navigationConfig[role];
        
        navItems.forEach(item => {
          expect(item.label).toBeDefined();
          expect(typeof item.label).toBe('string');
          expect(item.label.length).toBeGreaterThan(0);
          
          expect(item.href).toBeDefined();
          expect(typeof item.href).toBe('string');
          expect(item.href).toMatch(/^\/dashboard\//);
          
          expect(item.icon).toBeDefined();
          expect(typeof item.icon).toBe('string');
        });
      });
    });

    it('should have Dashboard as first item for all roles', () => {
      const allRoles = Object.values(UserRole);
      
      allRoles.forEach(role => {
        const navItems = navigationConfig[role];
        expect(navItems[0].label).toBe('Dashboard');
        expect(navItems[0].href).toMatch(/^\/dashboard\//);
      });
    });
  });
});
