import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';

import { PreRentreeCampaignManifestSchema, PreRentreeModulesSchema } from '@/lib/campaigns/pre-rentree-2026/schema';
import { LEGAL } from '@/lib/legal';
import type { PreRentreeFoundationsProduct, PreRentreePack } from '@/lib/pricing';
import { buildWhatsAppContactUrl } from '@/lib/whatsapp';

import {
  deriveApprovedPublicClaims,
  derivePedagogyArtifacts,
  derivePacks,
  derivePublicationMode,
  deriveSchedule,
  deriveSubjects,
} from './publication-derivations';
import {
  PreRentreeCapabilitiesSchema,
  PreRentreeCommunicationSchema,
  PreRentreeManualsRegistrySchema,
  PreRentreeOffersSchema,
  PreRentreeOperationsSchema,
  PreRentreePedagogyFrameworkSchema,
  PreRentreeWhatsAppSchema,
} from '@/lib/campaigns/pre-rentree-2026/content-schema';
import {
  ParentGuideContentSchema,
  PublicationSnapshotSchema,
  type PublicationSnapshot,
} from './publication-snapshot-schema';

type CompileOptions = { repoRoot: string; repositoryCommitSha: string };

const SourceAnchorDocumentSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  campaignId: z.literal('pre-rentree-2026'),
  sourceAnchorSha: z.string().regex(/^[a-f0-9]{40}$/),
  declaredByRole: z.literal('PROJECT_OWNER'),
  declaredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  purpose: z.string().min(1),
}).strict();

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
  const sourceAnchorSource = readSource(repoRoot, 'content/pre-rentree-2026/source-anchor.owner.json');
  const campaignSource = readSource(repoRoot, 'data/campaigns/pre-rentree-2026.json');
  const modulesSource = readSource(repoRoot, 'content/pre-rentree-2026/modules.json');
  const pricingSource = readSource(repoRoot, 'data/pricing.canonical.json');
  const legalSource = readSource(repoRoot, 'lib/legal.ts');
  const parentGuideSource = readSource(repoRoot, 'content/pre-rentree-2026/parent-guide.fr.json');
  const pedagogyFrameworkSource = readSource(repoRoot, 'content/pre-rentree-2026/pedagogy-framework.fr.json');
  const offersSource = readSource(repoRoot, 'content/pre-rentree-2026/offers.json');
  const capabilitiesSource = readSource(repoRoot, 'content/pre-rentree-2026/capabilities.json');
  const manualsSource = readSource(repoRoot, 'content/pre-rentree-2026/manuals.registry.json');
  const communicationSource = readSource(repoRoot, 'content/pre-rentree-2026/communication.fr.json');
  const whatsappSource = readSource(repoRoot, 'content/pre-rentree-2026/whatsapp.fr.json');
  const operationsSource = readSource(repoRoot, 'content/pre-rentree-2026/operations.fr.json');

  const sourceAnchor = SourceAnchorDocumentSchema.parse(
    JSON.parse(sourceAnchorSource.bytes.toString('utf8')),
  );
  const campaign = PreRentreeCampaignManifestSchema.parse(JSON.parse(campaignSource.bytes.toString('utf8')));
  const modulesDocument = PreRentreeModulesSchema.parse(JSON.parse(modulesSource.bytes.toString('utf8')));
  const pricingDocument = JSON.parse(pricingSource.bytes.toString('utf8')) as {
    version: string;
    pre_rentree_packs: PreRentreePack[];
    pre_rentree_foundations: PreRentreeFoundationsProduct[];
  };
  const parentGuide = ParentGuideContentSchema.parse(
    JSON.parse(parentGuideSource.bytes.toString('utf8')),
  );
  const pedagogyFramework = PreRentreePedagogyFrameworkSchema.parse(
    JSON.parse(pedagogyFrameworkSource.bytes.toString('utf8')),
  );
  const offers = PreRentreeOffersSchema.parse(JSON.parse(offersSource.bytes.toString('utf8')));
  const capabilities = PreRentreeCapabilitiesSchema.parse(
    JSON.parse(capabilitiesSource.bytes.toString('utf8')),
  );
  const manuals = PreRentreeManualsRegistrySchema.parse(
    JSON.parse(manualsSource.bytes.toString('utf8')),
  );
  const communication = PreRentreeCommunicationSchema.parse(
    JSON.parse(communicationSource.bytes.toString('utf8')),
  );
  const whatsapp = PreRentreeWhatsAppSchema.parse(
    JSON.parse(whatsappSource.bytes.toString('utf8')),
  );
  const operations = PreRentreeOperationsSchema.parse(
    JSON.parse(operationsSource.bytes.toString('utf8')),
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
  execFileSync('git', ['cat-file', '-e', `${options.repositoryCommitSha}^{commit}`], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  execFileSync('git', [
    'merge-base',
    '--is-ancestor',
    sourceAnchor.sourceAnchorSha,
    options.repositoryCommitSha,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const repositoryCommitDate = execFileSync('git', [
    'show',
    '-s',
    '--format=%cI',
    options.repositoryCommitSha,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
  const canonicalUrl = `${LEGAL.web.url}${campaign.canonicalPath}`;
  const asset = (id: string, path: string) => {
    const source = readSource(repoRoot, path);
    return { id, path, sha256: source.sha256 };
  };
  const sourceSetSha256 = createHash('sha256').update(JSON.stringify([
    ['content/pre-rentree-2026/source-anchor.owner.json', sourceAnchorSource.sha256],
    ['content/pre-rentree-2026/capabilities.json', capabilitiesSource.sha256],
    ['content/pre-rentree-2026/communication.fr.json', communicationSource.sha256],
    ['content/pre-rentree-2026/manuals.registry.json', manualsSource.sha256],
    ['content/pre-rentree-2026/modules.json', modulesSource.sha256],
    ['content/pre-rentree-2026/offers.json', offersSource.sha256],
    ['content/pre-rentree-2026/operations.fr.json', operationsSource.sha256],
    ['content/pre-rentree-2026/parent-guide.fr.json', parentGuideSource.sha256],
    ['content/pre-rentree-2026/pedagogy-framework.fr.json', pedagogyFrameworkSource.sha256],
    ['content/pre-rentree-2026/whatsapp.fr.json', whatsappSource.sha256],
    ['data/campaigns/pre-rentree-2026.json', campaignSource.sha256],
    ['data/pricing.canonical.json', pricingSource.sha256],
    ['lib/legal.ts', legalSource.sha256],
  ])).digest('hex');
  const foundationProductByLevel = new Map(
    pricingDocument.pre_rentree_foundations.map((product) => [product.level, product]),
  );
  const offerPricing = offers.levels.flatMap((offer) => {
    if (offer.range === 'FONDATIONS') {
      if (offer.level !== 'TROISIEME' && offer.level !== 'SECONDE') {
        throw new Error(`Fondations offer cannot target ${offer.level}`);
      }
      const product = foundationProductByLevel.get(offer.level);
      if (!product) throw new Error(`Missing Fondations pricing for ${offer.level}`);
      return Array.from({ length: offer.pricing.maximumSubjects }, (_, index) => {
        const subjectCount = index + 1;
        return {
          level: offer.level,
          range: offer.range,
          subjectCount,
          totalHours: subjectCount * product.hours_per_subject,
          price: subjectCount * product.price_per_student,
          deposit: subjectCount * product.payment.deposit,
          balance: subjectCount * product.payment.solde,
          pricePerHour: product.price_per_student_hour,
        };
      });
    }
    return packs.map((pack) => ({
      level: offer.level,
      range: offer.range,
      subjectCount: pack.subjects_count,
      totalHours: pack.total_hours,
      price: pack.price_per_student,
      deposit: pack.payment.deposit,
      balance: pack.payment.solde,
      pricePerHour: pack.price_per_student_hour,
    }));
  });

  const snapshot = {
    schemaVersion: '1.0.0' as const,
    sourceSetSha256,
    sourceAnchorSha: sourceAnchor.sourceAnchorSha,
    repositoryCommitSha: options.repositoryCommitSha,
    repositoryCommitDate,
    snapshotBuiltAt: parentGuide.snapshotBuiltAt,
    provenance: {
      sourceAnchor: {
        path: 'content/pre-rentree-2026/source-anchor.owner.json',
        version: sourceAnchor.schemaVersion,
        sha256: sourceAnchorSource.sha256,
      },
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
      pedagogyFramework: {
        path: 'content/pre-rentree-2026/pedagogy-framework.fr.json',
        version: pedagogyFramework.version,
        sha256: pedagogyFrameworkSource.sha256,
      },
      offers: {
        path: 'content/pre-rentree-2026/offers.json',
        version: offers.version,
        sha256: offersSource.sha256,
      },
      capabilities: {
        path: 'content/pre-rentree-2026/capabilities.json',
        version: capabilities.version,
        sha256: capabilitiesSource.sha256,
      },
      manuals: {
        path: 'content/pre-rentree-2026/manuals.registry.json',
        version: manuals.version,
        sha256: manualsSource.sha256,
      },
      communication: {
        path: 'content/pre-rentree-2026/communication.fr.json',
        version: communication.version,
        sha256: communicationSource.sha256,
      },
      whatsapp: {
        path: 'content/pre-rentree-2026/whatsapp.fr.json',
        version: whatsapp.version,
        sha256: whatsappSource.sha256,
      },
      operations: {
        path: 'content/pre-rentree-2026/operations.fr.json',
        version: operations.version,
        sha256: operationsSource.sha256,
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
      operationalGates: campaign.operationalGates,
    },
    levels: campaign.levels,
    subjects: deriveSubjects(campaign),
    blocks: campaign.blocks,
    schedule: deriveSchedule(campaign),
    academicProfiles: campaign.academicProfiles,
    packs: derivePacks(packs),
    modules: modulesDocument.modules,
    pedagogy: derivePedagogyArtifacts(modulesDocument.modules, pedagogyFramework),
    offers,
    offerPricing,
    capabilities,
    manuals,
    communication,
    whatsapp,
    operations,
    content: {
      hero: campaign.content.hero,
      method: campaign.content.method,
      practical: campaign.content.practical,
      faq: campaign.content.faq,
      adaptationNotice: campaign.content.practical.adaptationNotice,
      recordingConsentNotice: campaign.content.practical.recordingConsentNotice,
    },
    labels: { deposit: 'Acompte' as const, balance: 'Solde' as const, price: 'Prix' as const },
    cta: {
      primary: campaign.cta.primary.label,
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
          parentGuide: 'NexusReussite_PreRentree2026_GuideParents_COMPLET.pdf',
          brochureParents: 'NexusReussite_PreRentree2026_BrochureParents.pdf',
          essential: 'NexusReussite_PreRentree2026_Essentiel.pdf',
          comparison: 'NexusReussite_PreRentree2026_Fondations_vs_Premium.pdf',
          pricingReservation: 'NexusReussite_PreRentree2026_Tarifs_Reservation.pdf',
          programTroisieme: 'Programme_Entree_3e.pdf',
          programSeconde: 'Programme_Entree_Seconde.pdf',
          programPremiere: 'Programme_Entree_Premiere.pdf',
          programTerminale: 'Programme_Entree_Terminale.pdf',
          planning: 'Planning_PreRentree2026.pdf',
          faq: 'FAQ_Parents_PreRentree2026.pdf',
        },
        publicHtml: {
          parentGuide: 'NexusReussite_PreRentree2026_GuideParents_COMPLET.html',
          brochureParents: 'NexusReussite_PreRentree2026_BrochureParents.html',
          essential: 'NexusReussite_PreRentree2026_Essentiel.html',
          comparison: 'NexusReussite_PreRentree2026_Fondations_vs_Premium.html',
          pricingReservation: 'NexusReussite_PreRentree2026_Tarifs_Reservation.html',
          programTroisieme: 'Programme_Entree_3e.html',
          programSeconde: 'Programme_Entree_Seconde.html',
          programPremiere: 'Programme_Entree_Premiere.html',
          programTerminale: 'Programme_Entree_Terminale.html',
          planning: 'Planning_PreRentree2026.html',
          faq: 'FAQ_Parents_PreRentree2026.html',
        },
        social: {
          feed: 'NexusReussite_PreRentree2026_Feed_1080x1350.png',
          story: 'NexusReussite_PreRentree2026_Story_1080x1920.png',
          monochrome: 'NexusReussite_PreRentree2026_Flyer_NB_1080x1350.png',
          altText: 'NexusReussite_PreRentree2026_VisuelsSociaux_AltText.json',
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
