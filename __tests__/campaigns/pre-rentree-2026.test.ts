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
      // Modèle fenêtres + week-end (v2) : plus de pause le week-end, les séances
      // SVT/PC de Première couvrent le samedi et le dimanche (22-23 août).
      expect(campaignManifest.noClassDates).toEqual([]);
    });

    it('has exactly 5 levels', () => {
      expect(campaignManifest.levels).toHaveLength(5);
    });

    it('has exactly 7 subject families', () => {
      expect(campaignManifest.subjects).toHaveLength(7);
    });

    it('has exactly 4 time blocks', () => {
      expect(campaignManifest.blocks).toHaveLength(4);
    });

    it('has exactly 3 windows (fenêtre 1, week-end + début fenêtre 2, fenêtre 2)', () => {
      expect(campaignManifest.schedule).toHaveLength(3);
    });
  });

  describe('Modules', () => {
    const modules = (modulesData as any).modules;

    it('has exactly 14 modules (2+2+2+5+3 par niveau, sans Seconde SNT/PC)', () => {
      expect(modules).toHaveLength(14);
    });

    it('each module has exactly 5 sessions', () => {
      for (const mod of modules) {
        expect(mod.sessions).toHaveLength(5);
      }
    });

    it('total sessions = 70', () => {
      const total = modules.reduce((sum: number, m: any) => sum + m.sessions.length, 0);
      expect(total).toBe(70);
    });

    it('keeps the approved number of modules per level', () => {
      const byLevel = { QUATRIEME: 0, TROISIEME: 0, SECONDE: 0, PREMIERE: 0, TERMINALE: 0 };
      for (const mod of modules) {
        byLevel[mod.level as keyof typeof byLevel]++;
      }
      expect(byLevel.QUATRIEME).toBe(2);
      expect(byLevel.TROISIEME).toBe(2);
      expect(byLevel.SECONDE).toBe(2);
      expect(byLevel.PREMIERE).toBe(5);
      // 3 depuis l'arbitrage du 14/08/2026 : Maths expertes, SVT et Philosophie
      // sont fermées en Terminale faute d'effectif. Restent Maths, NSI, PC.
      expect(byLevel.TERMINALE).toBe(3);
    });

    it('never uses "EAF Terminale"', () => {
      for (const mod of modules) {
        if (mod.level === 'TERMINALE') {
          expect(mod.title).not.toContain('EAF');
          expect(mod.subject).not.toContain('EAF');
        }
      }
    });

    it('does not offer NSI or Physique-Chimie module content for Seconde (retiré au profit de Maths+Français uniquement)', () => {
      expect(modules.find((module: any) => module.id === 'seconde-informatique-snt')).toBeUndefined();
      expect(modules.find((module: any) => module.id === 'seconde-physique-chimie')).toBeUndefined();
    });

    it('no longer offers Philosophie, Maths expertes or SVT for Terminale (arbitrage du 2026-08-14, effectif insuffisant)', () => {
      for (const id of ['terminale-philosophie', 'terminale-maths-expertes', 'terminale-svt']) {
        expect(modules.find((module: any) => module.id === id)).toBeUndefined();
      }
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

    it('max 3 rooms per block — salles banalisées et interchangeables (mission consolidée §0.3, 2026-07-27)', () => {
      // §0.3 supersede le modèle SCHEDULE-S5 : salle-3 n'est plus scopée au
      // bloc C, les 3 salles sont permanentes et interchangeables, sans table
      // de compatibilité salle -> matière. La seule contrainte de salle est un
      // comptage : jamais plus de groupes simultanés que de salles physiques.
      for (const week of schedule) {
        const roomsPerBlock: Record<string, Set<string>> = {};
        for (const slot of week.slots) {
          if (!roomsPerBlock[slot.block]) roomsPerBlock[slot.block] = new Set();
          roomsPerBlock[slot.block].add(slot.room);
        }
        for (const [, rooms] of Object.entries(roomsPerBlock)) {
          expect(rooms.size).toBeLessThanOrEqual(3);
        }
      }
    });

    it('no level has more than 4 distinct blocks per day (8h max, ex. Terminale en fenêtre 2)', () => {
      for (const week of schedule) {
        const blocksPerLevel: Record<string, Set<string>> = {};
        for (const slot of week.slots) {
          const set = blocksPerLevel[slot.level] ?? new Set<string>();
          set.add(slot.block);
          blocksPerLevel[slot.level] = set;
        }
        for (const [, blockSet] of Object.entries(blocksPerLevel)) {
          // Par jour : max 4 blocs distincts = 8h (chaque bloc dure 2h). La Terminale en
          // fenêtre 2 atteint 4 blocs/jour (A, B, C, D) — le bloc C porte 2 séances
          // simultanées (NSI en salle 1, SVT en salle 2), d'où l'incompatibilité de choix.
          expect(blockSet.size).toBeLessThanOrEqual(4);
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

    it('each declared teacher role never covers two groups in the same (window, block) — R1, blocking; hourly load is informative only, never a ceiling', () => {
      // maxHoursPerDay n'est plus une règle bloquante (mission consolidée §0.2) :
      // le validateur calcule et rapporte la charge, il n'échoue jamais dessus.
      for (const week of schedule) {
        for (const roleId of Object.keys(campaignManifest.teacherRoles)) {
          const roleBlocks = week.slots.filter((slot) => slot.teacherRole === roleId);
          expect(new Set(roleBlocks.map((slot) => slot.block)).size).toBe(roleBlocks.length);
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
    it('manifest subject labels respect pedagogy rules (NSI réservé à Première/Terminale, pas de Seconde)', () => {
      const nsi = campaignManifest.subjects.find(s => s.id === 'NSI');
      expect(nsi?.levels).toEqual(['PREMIERE', 'TERMINALE']);
    });

    it('Terminale n’offre ni Français, ni Philosophie, ni Maths expertes', () => {
      const fr = campaignManifest.subjects.find(s => s.id === 'FRANCAIS');
      expect(fr?.levels).not.toContain('TERMINALE');
      // Arbitrage du 14/08/2026 : Philosophie et Maths expertes sont fermées
      // faute d'effectif. Elles ne sont plus rattachées à aucun niveau, donc
      // aucune surface publique ne peut les proposer.
      expect(campaignManifest.subjects.find(s => s.id === 'PHILOSOPHIE')?.levels ?? []).toEqual([]);
      expect(campaignManifest.subjects.find(s => s.id === 'MATHS_EXPERTES')?.levels ?? []).toEqual([]);
      expect(campaignManifest.subjects.find(s => s.id === 'SVT')?.levels).toEqual(['PREMIERE']);
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
