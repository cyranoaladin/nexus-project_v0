import { Page } from '@playwright/test';

export async function loginAs(page: Page, role: 'admin'|'assistante'|'coach'|'parent'|'eleve') {
  const roleMap: Record<string, string> = {
    admin: 'ADMIN',
    assistante: 'ASSISTANTE',
    coach: 'COACH',
    parent: 'PARENT',
    eleve: 'ELEVE',
  };
  const mapped = roleMap[role.toLowerCase()];
  if (!mapped) throw new Error(`Unknown role: ${role}`);

  const resp = await page.request.post('/api/test/login', {
    data: { role: mapped },
  });
  if (!resp.ok()) {
    const msg = await resp.text().catch(() => '');
    throw new Error(`Test login failed (${resp.status()}): ${msg}`);
  }
  // Wait for session readiness with small backoff
  const backoffs = [100, 150, 200];
  for (const ms of backoffs) {
    try {
      const r = await page.request.get('/api/auth/session', { headers: { 'Cache-Control': 'no-store' } });
      if (r.ok()) {
        const j = await r.json();
        if (j?.user?.role) return;
      }
    } catch {}
    await page.waitForTimeout(ms);
  }
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    try {
      const r = await page.request.get('/api/auth/session', { headers: { 'Cache-Control': 'no-store' } });
      if (r.ok()) {
        const j = await r.json();
        if (j?.user?.role) break;
      }
    } catch {}
    await page.waitForTimeout(150);
  }
}

