/**
 * Pre-Rentrée 2026 Campaign Contract Tests
 *
 * Validates: manifest, schedule, pricing, terminology, collisions, constraints.
 */

import campaignManifest from '@/data/campaigns/pre-rentree-2026.json';
import modulesData from '@/content/pre-rentree-2026/modules.json';
import pricingData from '@/data/pricing.canonical.json';
import { PreRentreeCampaignManifestSchema } from '@/lib/campaigns/pre-rentree-2026/schema';

describe('Pre-Rentrée 2026 Campaign Contract', () => {
  describe('Manifest validation', () => {
    it('validates against Zod schema', () => {
      const result = PreRentreeCampaignManifestSchema.safeParse(campaignManifest);
      if (!result.success) {
        console.error(result.error.issues);
      }
      expect(result.success).toBe(true);
    });

    it('has correct dates', () => {
      expect(campaignManifest.startDate).toBe('2026-08-17');
      expect(campaignManifest.endDate).toBe('2026-08-28');
      expect(campaignManifest.noClassDates).toContain('2026-08-22');
      expect(campaignManifest.noClassDates).toContain('2026-08-23');
    });

    it('has exactly 4 levels', () => {
      expect(campaignManifest.levels).toHaveLength(4);
    });

    it('has exactly 6 subject families', () => {
      expect(campaignManifest.subjects).toHaveLength(6);
    });

    it('has exactly 4 time blocks', () => {
      expect(campaignManifest.blocks).toHaveLength(4);
    });

    it('has exactly 2 weeks', () => {
      expect(campaignManifest.schedule).toHaveLength(2);
    });
  });

  describe('Modules', () => {
    const modules = (modulesData as any).modules;

    it('has exactly 15 modules after excluding SNT in Seconde', () => {
      expect(modules).toHaveLength(15);
    });

    it('each module has exactly 5 sessions', () => {
      for (const mod of modules) {
        expect(mod.sessions).toHaveLength(5);
      }
    });

    it('total sessions = 75', () => {
      const total = modules.reduce((sum: number, m: any) => sum + m.sessions.length, 0);
      expect(total).toBe(75);
    });

    it('keeps the approved number of modules per level', () => {
      const byLevel = { TROISIEME: 0, SECONDE: 0, PREMIERE: 0, TERMINALE: 0 };
      for (const mod of modules) {
        byLevel[mod.level as keyof typeof byLevel]++;
      }
      expect(byLevel.TROISIEME).toBe(2);
      expect(byLevel.SECONDE).toBe(3);
      expect(byLevel.PREMIERE).toBe(5);
      expect(byLevel.TERMINALE).toBe(5);
    });

    it('never uses "EAF Terminale"', () => {
      for (const mod of modules) {
        if (mod.level === 'TERMINALE') {
          expect(mod.title).not.toContain('EAF');
          expect(mod.subject).not.toContain('EAF');
        }
      }
    });

    it('excludes every Seconde SNT or initiation-informatique module', () => {
      const publicSecondeText = JSON.stringify(
        modules.filter((module: any) => module.level === 'SECONDE'),
      );
      expect(publicSecondeText).not.toMatch(/SNT|initiation informatique/i);
      expect(modules.some((module: any) => (
        module.level === 'SECONDE' && module.subjectId === 'NSI'
      ))).toBe(false);
    });
  });

  describe('Schedule constraints', () => {
    const schedule = campaignManifest.schedule;
    const blocks = campaignManifest.blocks;

    it('no room collision within a week', () => {
      for (const week of schedule) {
        const roomBlockPairs = week.slots.map(s => `${s.room}-${s.block}`);
        const unique = new Set(roomBlockPairs);
        expect(unique.size).toBe(roomBlockPairs.length);
      }
    });

    it('max 2 rooms per block', () => {
      for (const week of schedule) {
        const roomsPerBlock: Record<string, Set<string>> = {};
        for (const slot of week.slots) {
          if (!roomsPerBlock[slot.block]) roomsPerBlock[slot.block] = new Set();
          roomsPerBlock[slot.block].add(slot.room);
        }
        for (const [, rooms] of Object.entries(roomsPerBlock)) {
          expect(rooms.size).toBeLessThanOrEqual(2);
        }
      }
    });

    it('no level has more than 3 blocks per day (6h max)', () => {
      for (const week of schedule) {
        const blocksPerLevel: Record<string, number> = {};
        for (const slot of week.slots) {
          blocksPerLevel[slot.level] = (blocksPerLevel[slot.level] || 0) + 1;
        }
        for (const [, count] of Object.entries(blocksPerLevel)) {
          // Per day: max 3 blocks = 6h (each block is 2h) to accommodate the optional SVT evening block
          expect(count).toBeLessThanOrEqual(3);
        }
      }
    });

    it('Maths and NSI never in same block (same teacher)', () => {
      for (const week of schedule) {
        const blockSubjects: Record<string, string[]> = {};
        for (const slot of week.slots) {
          if (!blockSubjects[slot.block]) blockSubjects[slot.block] = [];
          blockSubjects[slot.block].push(slot.subject);
        }
        for (const [, subjects] of Object.entries(blockSubjects)) {
          const hasMaths = subjects.includes('MATHEMATIQUES');
          const hasNSI = subjects.includes('NSI');
          expect(hasMaths && hasNSI).toBe(false);
        }
      }
    });

    it('each declared teacher role stays at or below 6h/day', () => {
      for (const week of schedule) {
        for (const [roleId, role] of Object.entries(campaignManifest.teacherRoles)) {
          const roleBlocks = week.slots.filter((slot) => slot.teacherRole === roleId);
          expect(roleBlocks.length * 2).toBeLessThanOrEqual(role.maxHoursPerDay);
        }
      }
    });
  });

  describe('Pricing', () => {
    const packs = (pricingData as any).pre_rentree_packs;

    it('has exactly 4 pack products', () => {
      expect(packs).toHaveLength(4);
    });

    it('pack IDs match manifest', () => {
      const ids = packs.map((p: any) => p.id);
      expect(ids).toEqual(campaignManifest.packProductIds);
    });

    it('deposit + balance = price for each pack', () => {
      for (const pack of packs) {
        expect(pack.payment.deposit + pack.payment.solde).toBe(pack.price_per_student);
      }
    });

    it('price per hour >= 45 TND floor', () => {
      for (const pack of packs) {
        expect(pack.price_per_student_hour).toBeGreaterThanOrEqual(45);
      }
    });

    it('deposit is exactly 30%', () => {
      for (const pack of packs) {
        const rawDeposit = pack.price_per_student * 0.3;
        expect(pack.payment.deposit).toBe(rawDeposit);
      }
    });

    it('all packs exclude automatic discounts', () => {
      for (const pack of packs) {
        expect(pack.non_cumulable).toBe(true);
        expect(pack.discount_exclusions).toContain('carte_nexus');
      }
    });

    it('no price values in the manifest itself', () => {
      const manifestStr = JSON.stringify(campaignManifest);
      // Should not contain actual TND amounts
      expect(manifestStr).not.toContain('"480"');
      expect(manifestStr).not.toContain('"900"');
      expect(manifestStr).not.toContain('"1350"');
      expect(manifestStr).not.toContain('"1800"');
    });
  });

  describe('Terminology guards', () => {
    it('manifest subject labels respect pedagogy rules', () => {
      const nsi = campaignManifest.subjects.find(s => s.id === 'NSI');
      expect(nsi?.levels).toEqual(['PREMIERE', 'TERMINALE']);
      expect(nsi?.labelByLevel).toBeUndefined();
    });

    it('replaces Terminale French with Philosophy', () => {
      const fr = campaignManifest.subjects.find(s => s.id === 'FRANCAIS');
      expect(fr?.levels).not.toContain('TERMINALE');
      expect(campaignManifest.subjects.find(s => s.id === 'PHILOSOPHIE')?.levels).toEqual(['TERMINALE']);
    });
  });

  describe('No PII in campaign data', () => {
    it('manifest contains no personal emails or phones (only public contact)', () => {
      const str = JSON.stringify(campaignManifest);
      // Only the public contact email is allowed
      const emails = str.match(/[a-z0-9.]+@[a-z]+\.[a-z]+/g) || [];
      expect(emails.every(e => e === 'contact@nexusreussite.academy')).toBe(true);
      // WhatsApp is a generic business number, not personal
      const phones = str.match(/\+216\d{8}/g) || [];
      expect(phones.length).toBeLessThanOrEqual(1); // only business whatsapp
    });

    it('modules contain no personal data', () => {
      const str = JSON.stringify(modulesData);
      expect(str).not.toMatch(/@[a-z]+\.[a-z]+/);
    });
  });
});
