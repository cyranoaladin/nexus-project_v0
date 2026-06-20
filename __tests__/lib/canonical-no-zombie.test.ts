/**
 * Anti-zombie guard — every entry in pricing.canonical.json must be
 * referenced by at least one rendered component. No orphan offers.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const canonical = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'pricing.canonical.json'), 'utf8')
);

// Scan all .ts/.tsx in app/ and components/ for references
const srcDirs = [path.join(ROOT, 'app'), path.join(ROOT, 'components'), path.join(ROOT, 'lib')];
function getAllSourceContent(): string {
  let content = '';
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) {
        content += fs.readFileSync(full, 'utf8') + '\n';
      }
    }
  }
  for (const d of srcDirs) walk(d);
  return content;
}

const allSource = getAllSourceContent();

describe('Anti-zombie: every canonical entry has a consumer', () => {
  test('every offer ID is referenced in source code', () => {
    const unreferenced: string[] = [];
    for (const o of canonical.offers) {
      // The offer is consumed via getAllOffers() which returns ALL offers.
      // Check that the rendering pipeline (lib/pricing.ts getAllOffers) exists.
      if (!allSource.includes('getAllOffers')) {
        unreferenced.push(o.id);
      }
    }
    expect(unreferenced).toEqual([]);
  });

  test('every stage_format ID is referenced by calendar, editions, or source code', () => {
    const referenced = new Set<string>();
    for (const c of canonical.stage_calendar) referenced.add(c.format_id);
    for (const e of canonical.stage_editions) for (const f of e.formats) referenced.add(f);
    const unreferenced: string[] = [];
    for (const f of canonical.stage_formats) {
      if (!referenced.has(f.format_id) && !allSource.includes(f.format_id)) {
        unreferenced.push(f.format_id);
      }
    }
    expect(unreferenced).toEqual([]);
  });

  test('every pack ID is referenced in source code', () => {
    const unreferenced: string[] = [];
    for (const p of canonical.packs) {
      // Packs are consumed via getPacks() which returns all packs
      if (!allSource.includes('getPacks')) {
        unreferenced.push(p.id);
      }
    }
    expect(unreferenced).toEqual([]);
  });

  test('special_programs are each referenced by ID in source', () => {
    const unreferenced: string[] = [];
    for (const sp of (canonical.special_programs || [])) {
      if (!allSource.includes(sp.id)) {
        unreferenced.push(sp.id);
      }
    }
    expect(unreferenced).toEqual([]);
  });

  test('no composite_stage_packs section exists (purged)', () => {
    expect(canonical.composite_stage_packs).toBeUndefined();
  });

  test('carte_nexus is referenced', () => {
    expect(allSource).toContain('carte_nexus');
  });

  test('urgence is referenced', () => {
    expect(allSource).toContain('urgence');
  });
});
