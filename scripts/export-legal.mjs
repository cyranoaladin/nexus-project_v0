#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

const map = {
  'confidentialite': 'POLITIQUE_CONFIDENTIALITE.md',
  'cgu': 'CGU.md',
  'cgv': 'CGV.md',
  'mentions-legales': 'MENTIONS_LEGALES.md',
  'a-propos': 'A_PROPOS.md',
};

async function main() {
  const pages = await prisma.legalPage.findMany();
  const dir = path.join(process.cwd(), 'docs');
  await fs.mkdir(dir, { recursive: true });
  for (const p of pages) {
    const file = map[p.slug];
    if (!file) continue;
    const fm = `---\n` +
      `title: ${p.title}\n` +
      `slug: ${p.slug}\n` +
      `version: ${p.version}\n` +
      `updated_at: ${p.updatedAt.toISOString()}\n` +
      `content_hash: ${p.contentHash}\n` +
      `git_commit: ${p.gitCommit ?? ''}\n` +
      `---\n\n`;
    await fs.writeFile(path.join(dir, file), fm + p.contentMd, 'utf8');
  }
  await fs.writeFile(path.join(dir, 'legal_index.json'), JSON.stringify(pages.map(p => ({ slug: p.slug, title: p.title, version: p.version, updatedAt: p.updatedAt, contentHash: p.contentHash, gitCommit: p.gitCommit })), null, 2));
  console.log(`[export-legal] Exported ${pages.length} pages to /docs`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
