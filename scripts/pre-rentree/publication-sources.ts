import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';

import { PreRentreeCampaignManifestSchema, PreRentreeModulesSchema } from '@/lib/campaigns/pre-rentree-2026/schema';
import { LEGAL } from '@/lib/legal';
import type { PreRentreePack } from '@/lib/pricing';
import { buildWhatsAppContactUrl } from '@/lib/whatsapp';

import {
  deriveApprovedPublicClaims,
  derivePacks,
  derivePublicationMode,
  deriveSchedule,
  deriveSubjects,
} from './publication-derivations';
import {
  ParentGuideContentSchema,
  PublicationSnapshotSchema,
  type PublicationSnapshot,
} from './publication-snapshot-schema';

type CompileOptions = { repoRoot: string; sourceRepoSha: string };

function readSource(repoRoot: string, path: string) {
  const absolutePath = resolve(repoRoot, path);
  const bytes = readFileSync(absolutePath);
  return {
    absolutePath,
    bytes,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function pointerExists(value: unknown, pointer: string): boolean {
  if (pointer === '') return true;
  if (!pointer.startsWith('/')) return false;
  let current: unknown = value;
  for (const encodedPart of pointer.slice(1).split('/')) {
    const part = encodedPart.replaceAll('~1', '/').replaceAll('~0', '~');
    if (Array.isArray(current)) {
      const index = Number(part);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return false;
      current = current[index];
      continue;
    }
    if (!current || typeof current !== 'object' || !(part in current)) return false;
    current = (current as Record<string, unknown>)[part];
  }
  return true;
}

function validateParentGuideEvidence(snapshot: Record<string, unknown>) {
  const parentGuide = snapshot.parentGuide as z.infer<typeof ParentGuideContentSchema>;
  const references = parentGuide.sections.flatMap((section) => section.blocks.flatMap((block) => {
    if (block.kind === 'EVIDENCED_TEXT') return block.evidenceRefs;
    if (block.kind === 'EVIDENCED_PROCEDURE') return block.steps.flatMap((step) => step.evidenceRefs);
    return [block.sourceRef];
  }));
  const invalid = references.filter((reference) => !pointerExists(snapshot, reference));
  if (invalid.length > 0) {
    throw new Error(`Invalid parent-guide evidence reference: ${invalid.join(', ')}`);
  }
}
function parseApprovedTerms(path: string, content: string) {
  const field = (name: string) => content.match(new RegExp(`^${name}:\\s*(.+)$`, 'mi'))?.[1]?.trim() ?? null;
  const status = field('STATUS');
  const termsVersion = field('TERMS_VERSION');
  const effectiveDate = field('EFFECTIVE_DATE');
  const ownerApprovalReference = field('OWNER_APPROVAL_REFERENCE');
  const legalApprovalReference = field('LEGAL_APPROVAL_REFERENCE');
  const approved = status === 'APPROVED' && Boolean(
    termsVersion && effectiveDate && ownerApprovalReference && legalApprovalReference,
  );
  return {
    status: approved ? 'APPROVED' as const : 'UNAPPROVED_COMMERCIAL_TERMS' as const,
    commercialTermsPath: path,
    contractualDossierPublicationBlocked: !approved,
    termsVersion: approved ? termsVersion : null,
    effectiveDate: approved ? effectiveDate : null,
    ownerApprovalReference: approved ? ownerApprovalReference : null,
    legalApprovalReference: approved ? legalApprovalReference : null,
    privacyNoticeComplete: false,
  };
}

export function compileCanonicalPublication(options: CompileOptions): PublicationSnapshot {
  const repoRoot = resolve(options.repoRoot);
  const campaignSource = readSource(repoRoot, 'data/campaigns/pre-rentree-2026.json');
  const modulesSource = readSource(repoRoot, 'content/pre-rentree-2026/modules.json');
  const pricingSource = readSource(repoRoot, 'data/pricing.canonical.json');
  const legalSource = readSource(repoRoot, 'lib/legal.ts');
  const parentGuideSource = readSource(repoRoot, 'content/pre-rentree-2026/parent-guide.fr.json');

  const campaign = PreRentreeCampaignManifestSchema.parse(JSON.parse(campaignSource.bytes.toString('utf8')));
  const modulesDocument = PreRentreeModulesSchema.parse(JSON.parse(modulesSource.bytes.toString('utf8')));
  const pricingDocument = JSON.parse(pricingSource.bytes.toString('utf8')) as {
    version: string;
    pre_rentree_packs: PreRentreePack[];
  };
  const parentGuide = ParentGuideContentSchema.parse(
    JSON.parse(parentGuideSource.bytes.toString('utf8')),
  );
  const packById = new Map(pricingDocument.pre_rentree_packs.map((pack) => [pack.id, pack]));
  const packs = campaign.packProductIds.map((id) => {
    const pack = packById.get(id);
    if (!pack) throw new Error(`Unknown Pré-rentrée pricing product: ${id}`);
    return pack;
  });
  const commercialTermsPath = campaign.legalRefs.commercialTerms;
  const commercialTermsAbsolutePath = resolve(repoRoot, commercialTermsPath);
  const legal = existsSync(commercialTermsAbsolutePath)
    ? parseApprovedTerms(commercialTermsPath, readFileSync(commercialTermsAbsolutePath, 'utf8'))
    : {
        status: 'MISSING_APPROVED_COMMERCIAL_TERMS' as const,
        commercialTermsPath,
        contractualDossierPublicationBlocked: true,
        termsVersion: null,
        effectiveDate: null,
        ownerApprovalReference: null,
        legalApprovalReference: null,
        privacyNoticeComplete: false,
      };
  const commitDate = execFileSync('git', ['show', '-s', '--format=%cI', options.sourceRepoSha], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
  const canonicalUrl = `${LEGAL.web.url}${campaign.canonicalPath}`;
  const asset = (id: string, path: string) => {
    const source = readSource(repoRoot, path);
    return { id, path, sha256: source.sha256 };
  };

  const snapshot = {
    schemaVersion: '1.0.0' as const,
    sourceRepoSha: options.sourceRepoSha,
    sourceCommitDate: commitDate,
    snapshotBuiltAt: parentGuide.snapshotBuiltAt,
    provenance: {
      campaign: { path: 'data/campaigns/pre-rentree-2026.json', version: campaign.version, sha256: campaignSource.sha256 },
      modules: { path: 'content/pre-rentree-2026/modules.json', version: modulesDocument.version, sha256: modulesSource.sha256 },
      pricing: { path: 'data/pricing.canonical.json', version: pricingDocument.version, sha256: pricingSource.sha256 },
      legal: { path: 'lib/legal.ts', version: 'LEGAL', sha256: legalSource.sha256 },
      contact: { path: 'lib/legal.ts', version: 'LEGAL.contact', sha256: legalSource.sha256 },
      parentGuide: {
        path: 'content/pre-rentree-2026/parent-guide.fr.json',
        version: parentGuide.contentVersion,
        sha256: parentGuideSource.sha256,
      },
    },
    campaign: {
      id: campaign.campaignId,
      version: campaign.version,
      schoolYear: campaign.entryLevelSemantics.schoolYear,
      timezone: campaign.timezone,
      publicationMode: derivePublicationMode(campaign),
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      noClassDates: campaign.noClassDates,
      decisionDeadline: campaign.decisionDeadline,
      venue: {
        name: `${LEGAL.entity.tradeName} — ${LEGAL.addresses.pedagogique.neighborhood}`,
        neighborhood: LEGAL.addresses.pedagogique.neighborhood,
        city: LEGAL.addresses.pedagogique.city,
      },
      capacityByOffer: {
        FONDATIONS: {
          min: campaign.capacityByOffer.FONDATIONS.minPerCohort,
          max: campaign.capacityByOffer.FONDATIONS.maxPerCohort,
        },
        PREMIUM: {
          min: campaign.capacityByOffer.PREMIUM.minPerCohort,
          max: campaign.capacityByOffer.PREMIUM.maxPerCohort,
        },
      },
    },
    levels: campaign.levels,
    subjects: deriveSubjects(campaign),
    blocks: campaign.blocks,
    schedule: deriveSchedule(campaign),
    academicProfiles: campaign.academicProfiles,
    packs: derivePacks(packs),
    modules: modulesDocument.modules,
    content: {
      hero: campaign.content.hero,
      method: campaign.content.method,
      practical: campaign.content.practical,
      faq: campaign.content.faq,
      adaptationNotice: 'Le programme et le niveau des exercices sont adaptés au profil déclaré et à la composition pédagogique du groupe.',
      recordingConsentNotice: 'Tout enregistrement pédagogique est facultatif et soumis à un consentement séparé.',
    },
    labels: { deposit: 'Acompte' as const, balance: 'Solde' as const, price: 'Prix' as const },
    cta: {
      primary: 'Se pré-inscrire ou demander un conseil' as const,
      whatsapp: campaign.cta.whatsapp.label,
      bilanLabel: campaign.cta.bilanGratuit.label,
      bilanPath: campaign.cta.bilanGratuit.path,
    },
    contact: {
      phone: LEGAL.contact.phone,
      phoneRaw: LEGAL.contact.phoneRaw,
      email: LEGAL.contact.email,
      addressLabel: LEGAL.addresses.pedagogique.label,
      address: LEGAL.addresses.pedagogique.full,
      whatsappUrl: buildWhatsAppContactUrl(LEGAL.contact.whatsappNumber),
      canonicalUrl,
      domain: LEGAL.web.domain,
    },
    legal,
    approvedPublicClaims: deriveApprovedPublicClaims(campaign),
    parentGuide,
    assets: {
      logos: [
        asset('logo-slogan', 'public/logo_slogan_nexus.png'),
        asset('logo-compact', 'public/images/logo_nexus_reussite.png'),
      ],
      fonts: [
        asset('DM Sans Variable', 'app/fonts/DMSans-Variable.woff2'),
        asset('Fraunces Variable', 'app/fonts/Fraunces-Variable.woff2'),
        asset('IBM Plex Mono Regular', 'app/fonts/IBMPlexMono-Regular.woff2'),
      ],
    },
    document: {
      documentPackageVersion: parentGuide.documentPackageVersion,
      documentEditionDate: parentGuide.documentEditionDate,
      publicClassification: 'PUBLIC' as const,
      qrTarget: canonicalUrl,
      outputs: {
        publicPdf: {
          parentGuide: 'NexusReussite_PreRentree2026_GuideParents_COMPLET_PUBLIC.pdf',
          essential: 'NexusReussite_PreRentree2026_Essentiel_PUBLIC.pdf',
          planning: 'NexusReussite_PreRentree2026_Planning_PUBLIC.pdf',
          programSeconde: 'NexusReussite_PreRentree2026_Programme_Seconde_PUBLIC.pdf',
          programPremiere: 'NexusReussite_PreRentree2026_Programme_Premiere_PUBLIC.pdf',
          programTerminale: 'NexusReussite_PreRentree2026_Programme_Terminale_PUBLIC.pdf',
          pricing: 'NexusReussite_PreRentree2026_Tarifs_PUBLIC.pdf',
        },
        publicHtml: {
          parentGuide: 'NexusReussite_PreRentree2026_GuideParents_COMPLET_PUBLIC.html',
          essential: 'NexusReussite_PreRentree2026_Essentiel_PUBLIC.html',
          planning: 'NexusReussite_PreRentree2026_Planning_PUBLIC.html',
          programSeconde: 'NexusReussite_PreRentree2026_Programme_Seconde_PUBLIC.html',
          programPremiere: 'NexusReussite_PreRentree2026_Programme_Premiere_PUBLIC.html',
          programTerminale: 'NexusReussite_PreRentree2026_Programme_Terminale_PUBLIC.html',
          pricing: 'NexusReussite_PreRentree2026_Tarifs_PUBLIC.html',
        },
        social: {
          feed: 'NexusReussite_PreRentree2026_Feed_1080x1350_PUBLIC.png',
          story: 'NexusReussite_PreRentree2026_Story_1080x1920_PUBLIC.png',
          monochrome: 'NexusReussite_PreRentree2026_Flyer_NB_1080x1350_PUBLIC.png',
          altText: 'NexusReussite_PreRentree2026_VisuelsSociaux_AltText_PUBLIC.json',
        },
      },
    },
    reviews: {
      ownerReviewedAt: null,
      legalReviewedAt: null,
      privacyReviewedAt: null,
    },
  };

  validateParentGuideEvidence(snapshot);
  return PublicationSnapshotSchema.parse(snapshot);
}
