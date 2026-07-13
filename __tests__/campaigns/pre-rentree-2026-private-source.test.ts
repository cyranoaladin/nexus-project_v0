import fs from 'node:fs';
import path from 'node:path';

describe('Pré-rentrée public source hygiene', () => {
  it('does not retain the unused internal teacher-cost model in the public stages source tree', () => {
    const internalCostModule = path.join(process.cwd(), 'app/stages/_lib/business-config.ts');

    expect(fs.existsSync(internalCostModule)).toBe(false);
  });
});
