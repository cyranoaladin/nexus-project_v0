#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

const files = [
  { file: 'POLITIQUE_CONFIDENTIALITE.md', slug: 'confidentialite' },
  { file: 'CGU.md', slug: 'cgu' },
  { file: 'CGV.md', slug: 'cgv' },
  { file: 'MENTIONS_LEGALES.md', slug: 'mentions-legales' },
  { file: 'A_PROPOS.md', slug: 'a-propos' },
];

async function mdToSafeHtml(md) {
  const { default: DOMPurify } = await import('isomorphic-dompurify');
  const { marked } = await import('marked');
  const raw = marked.parse(md, { mangle: false, headerIds: true });
  return DOMPurify.sanitize(raw, { ALLOWED_TAGS: false, ALLOWED_ATTR: false });
}

import { createHash } from 'node:crypto';
function sha256(input) {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function titleFromMd(md, fallback) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

async function main() {
  let count = 0;
  for (const { file, slug } of files) {
    const p = path.join(process.cwd(), file);
    try {
      const md = await fs.readFile(p, 'utf8');
      const title = titleFromMd(md, slug.toUpperCase());
      const contentHtml = await mdToSafeHtml(md);
      const contentHash = sha256(md);
      const existing = await prisma.legalPage.findUnique({ where: { slug } });
      const version = existing ? existing.version + 1 : 1;
      await prisma.$transaction(async (tx) => {
        const page = await tx.legalPage.upsert({
          where: { slug },
          update: { title, contentMd: md, contentHtml, version, contentHash },
          create: { slug, title, contentMd: md, contentHtml, version: 1, contentHash },
        });
        await tx.legalVersion.create({
          data: {
            pageId: page.id, slug: page.slug, title: page.title,
            contentMd: page.contentMd, contentHtml: page.contentHtml,
            version: page.version, contentHash: page.contentHash,
          }
        });
      });
      count++;
      console.log(`[seed-legal] Upserted ${slug} from ${file}`);
    } catch (e) {
      console.warn(`[seed-legal] Skip ${file}: ${e.message || e}`);
    }
  }
  console.log(`[seed-legal] Done. ${count} pages processed.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
