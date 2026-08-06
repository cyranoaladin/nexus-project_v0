import fs from 'node:fs';
import path from 'node:path';

import {
  BILAN_PACK_SUBJECTS,
  bilanPackSubjectLabel,
} from '@/lib/bilans/catalog/subjects';
import {
  BILAN_PACK_LEVELS,
  buildPreRentreeStageLabel,
} from '@/lib/bilans/render/stage-label';

describe('A90.2.0 human stage labels', () => {
  it('builds a deterministic human label for every supported level and subject', () => {
    for (const level of BILAN_PACK_LEVELS) {
      for (const subject of BILAN_PACK_SUBJECTS) {
        const label = buildPreRentreeStageLabel(level, subject);

        expect(label).toContain('Stage de pré-rentrée');
        expect(label).toContain(bilanPackSubjectLabel(subject));
        expect(label).not.toContain('entree-');
        expect(label).not.toContain('-v1');
        expect(buildPreRentreeStageLabel(level, subject)).toBe(label);
      }
    }
  });

  it('keeps technical slugs out of every public mock report', () => {
    const recipeDir = path.join(process.cwd(), 'data', 'bilans', 'recipe');
    const packets = fs.readdirSync(recipeDir)
      .filter((name) => name.endsWith('-mock-review-packet.json'));

    expect(packets.length).toBeGreaterThan(0);

    for (const packetName of packets) {
      const packet = JSON.parse(fs.readFileSync(path.join(recipeDir, packetName), 'utf8')) as {
        reports: Array<{ audience: string; report: { identity: { stageLabel: string } } }>;
      };
      const slug = packetName.replace(/-mock-review-packet\.json$/, '');

      for (const entry of packet.reports.filter(({ audience }) => audience !== 'NEXUS')) {
        const stageLabel = entry.report.identity.stageLabel;
        expect(stageLabel).not.toBe(slug);
        expect(stageLabel).not.toContain(slug);
        expect(stageLabel).toContain('Stage de pré-rentrée');
      }
    }
  });
});
