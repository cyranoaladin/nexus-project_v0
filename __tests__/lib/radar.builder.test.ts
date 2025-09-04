import { buildRadarPng } from '@/server/graphics/radar/buildRadarPng';
import fs from 'fs';

describe('buildRadarPng', () => {
  it('génère un PNG sur disque', async () => {
    const out = '/tmp/radar_test.png';
    if (fs.existsSync(out)) fs.unlinkSync(out);
    await buildRadarPng(['A', 'B', 'C'], [10, 50, 90], out);
    expect(fs.existsSync(out)).toBe(true);
    const size = fs.statSync(out).size;
    expect(size).toBeGreaterThan(1000);
  });
});
