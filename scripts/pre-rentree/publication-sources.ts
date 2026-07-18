import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { PreRentreeCampaignManifestSchema, PreRentreeModulesSchema } from '@/lib/campaigns/pre-rentree-2026/schema';
import { LEGAL } from '@/lib/legal';
import { getPreRentreePacks } from '@/lib/pricing';

import {
  deriveApprovedPublicClaims,
  derivePacks,
  derivePublicationMode,
  deriveSchedule,
  deriveSubjects,
} from './publication-derivations';
import { PublicationSnapshotSchema, type PublicationSnapshot } from './publication-snapshot-schema';

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

  const campaign = PreRentreeCampaignManifestSchema.parse(JSON.parse(campaignSource.bytes.toString('utf8')));
  const modulesDocument = PreRentreeModulesSchema.parse(JSON.parse(modulesSource.bytes.toString('utf8')));
  const pricingDocument = JSON.parse(pricingSource.bytes.toString('utf8')) as { version: string };
  const packs = getPreRentreePacks(campaign.packProductIds);
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
    generatedAt: commitDate,
    provenance: {
      campaign: { path: 'data/campaigns/pre-rentree-2026.json', version: campaign.version, sha256: campaignSource.sha256 },
      modules: { path: 'content/pre-rentree-2026/modules.json', version: modulesDocument.version, sha256: modulesSource.sha256 },
      pricing: { path: 'data/pricing.canonical.json', version: pricingDocument.version, sha256: pricingSource.sha256 },
      legal: { path: 'lib/legal.ts', version: 'LEGAL', sha256: legalSource.sha256 },
      contact: { path: 'lib/legal.ts', version: 'LEGAL.contact', sha256: legalSource.sha256 },
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
      capacity: { min: campaign.capacity.minPerCohort, max: campaign.capacity.maxPerCohort },
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
      whatsappUrl: `https://wa.me/${LEGAL.contact.whatsappNumber}`,
      canonicalUrl,
      domain: LEGAL.web.domain,
    },
    legal,
    approvedPublicClaims: deriveApprovedPublicClaims(campaign),
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
      version: 'v5-canonical' as const,
      editDate: commitDate.slice(0, 10),
      publicClassification: 'PUBLIC' as const,
      privateClassification: 'PRIVÉ' as const,
      qrTarget: canonicalUrl,
    },
  };

  return PublicationSnapshotSchema.parse(snapshot);
}
