import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('merged Parent tombstone administration boundary', () => {
  it('keeps API mutation guards and disables both destructive UI actions', () => {
    const route = readFileSync(resolve(process.cwd(), 'app/api/admin/users/route.ts'), 'utf8');
    const page = readFileSync(resolve(process.cwd(), 'app/dashboard/admin/users/page.tsx'), 'utf8');

    expect(route.match(/existingUser\.mergedIntoUserId/g)).toHaveLength(1);
    expect(route.match(/user\.mergedIntoUserId/g)).toHaveLength(2);
    expect(route).toContain('Merged source accounts are immutable');
    expect(route).toContain('Merged source accounts cannot be deleted');
    expect(page).toContain('mergedIntoUserId: string | null');
    expect(page.match(/disabled=\{Boolean\(user\.mergedIntoUserId\)\}/g)).toHaveLength(2);
    expect(page).toContain('Compte fusionné');
  });
});
