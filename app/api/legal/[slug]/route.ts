import { requireRole } from '@/lib/api/rbac';
import { sha256 } from '@/lib/hash';
import { mdToSafeHtml } from '@/lib/legal/sanitize';
import { LegalSlugEnum, LegalUpdateSchema } from '@/lib/legal/schemas';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { slug: string; }; }) {
  const slug = params.slug;
  const fmt = new URL(_req.url).searchParams.get('format') || 'html';
  if (!LegalSlugEnum.options.includes(slug as any)) {
    return NextResponse.json({ error: 'invalid slug' }, { status: 400 });
  }
  // E2E stub: avoid DB dependency during Playwright runs
  if (process.env.E2E === '1') {
    const title = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const payload: any = {
      slug,
      title: title || 'Legal',
      updatedAt: new Date().toISOString(),
      version: 1,
      contentHash: sha256(slug),
      gitCommit: null,
    };
    if (fmt === 'md') payload.contentMd = `# ${title}\n\nStub content for ${slug}.`;
    else payload.contentHtml = `<h1>${title}</h1><p>Stub content for ${slug}.</p>`;
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-cache' } });
  }
  const page = await prisma.legalPage.findUnique({ where: { slug } });
  if (!page) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const payload: any = {
    slug: page.slug,
    title: page.title,
    updatedAt: page.updatedAt,
    version: page.version,
    contentHash: page.contentHash,
    gitCommit: page.gitCommit,
  };
  if (fmt === 'md') payload.contentMd = page.contentMd;
  else payload.contentHtml = page.contentHtml ?? mdToSafeHtml(page.contentMd);
  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-cache' } });
}

export async function PUT(req: NextRequest, { params }: { params: { slug: string; }; }) {
  const slug = params.slug;
  const guard = await requireRole(req, ['ADMIN', 'ASSISTANTE']);
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });

  const body = await req.json();
  const parsed = LegalUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation', details: parsed.error.flatten() }, { status: 400 });
  }
  const { title, contentMd, placeholders } = parsed.data;
  const contentHtml = String(mdToSafeHtml(contentMd));
  const contentHash = sha256(contentMd);

  let gitCommit: string | null = process.env.GIT_COMMIT || null;
  if (!gitCommit) {
    try {
      const { execSync } = await import('node:child_process');
      gitCommit = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8').trim();
    } catch {}
  }

  const existing = await prisma.legalPage.findUnique({ where: { slug } });
  const nextVersion = (existing?.version ?? 0) + 1;
  const updated = await prisma.$transaction(async (tx) => {
    const page = await tx.legalPage.upsert({
      where: { slug },
      update: { title, contentMd, contentHtml, placeholders: placeholders as any, version: nextVersion, contentHash, gitCommit, updatedBy: (guard as any).role },
      create: { slug, title, contentMd, contentHtml, placeholders: placeholders as any, version: 1, contentHash, gitCommit, updatedBy: (guard as any).role },
    });
    await tx.legalVersion.create({
      data: {
        pageId: page.id,
        slug: page.slug,
        title: page.title,
        contentMd: page.contentMd,
        contentHtml: page.contentHtml,
        version: page.version,
        contentHash: page.contentHash,
        gitCommit: page.gitCommit ?? undefined,
        editorId: (guard as any).role,
      },
    });
    await tx.auditLog.create({ data: { actor: (guard as any).role, action: 'legal:update', diff: { slug, versionFrom: existing?.version ?? 0, versionTo: page.version, contentHash } as any } });
    return page;
  });

  try {
    revalidateTag('legal');
    revalidateTag(`legal:${slug}`);
  } catch {}

  // Export dans /docs/
  try {
    const dir = path.join(process.cwd(), 'docs');
    await fs.mkdir(dir, { recursive: true });
    const map: Record<string, string> = {
      'confidentialite': 'POLITIQUE_CONFIDENTIALITE.md',
      'cgu': 'CGU.md',
      'cgv': 'CGV.md',
      'mentions-legales': 'MENTIONS_LEGALES.md',
      'a-propos': 'A_PROPOS.md',
    };
    const filename = map[slug];
    if (filename) {
      const fm = `---\n` +
        `title: ${updated.title}\n` +
        `slug: ${updated.slug}\n` +
        `version: ${updated.version}\n` +
        `updated_at: ${updated.updatedAt.toISOString()}\n` +
        `content_hash: ${updated.contentHash}\n` +
        `git_commit: ${updated.gitCommit ?? ''}\n` +
        `---\n\n`;
      await fs.writeFile(path.join(dir, filename), fm + updated.contentMd, 'utf8');
    }
  } catch {}

  return NextResponse.json({ ok: true, slug, version: updated.version, contentHash, gitCommit: updated.gitCommit ?? null });
}
