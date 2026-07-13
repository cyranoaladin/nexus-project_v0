import { getPreRentreeLandingDTO } from '@/lib/campaigns/pre-rentree-2026/getters';

describe('Pré-rentrée programme anchors', () => {
  it('provides every subject CTA with the canonical module id for its entry level', () => {
    const dto = getPreRentreeLandingDTO();

    for (const subject of dto.subjects) {
      const moduleIdsByLevel = (subject as unknown as {
        moduleIdsByLevel?: Record<string, string>;
      }).moduleIdsByLevel;
      expect(moduleIdsByLevel).toBeDefined();
      if (!moduleIdsByLevel) return;

      for (const level of subject.levels) {
        const module = dto.modules.find(
          (candidate) => candidate.level === level && candidate.subjectId === subject.id,
        );
        expect(module).toBeDefined();
        expect(moduleIdsByLevel[level]).toBe(module?.id);
      }
    }
  });
});
