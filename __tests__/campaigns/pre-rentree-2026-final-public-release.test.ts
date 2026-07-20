import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const auditScript = join(root, 'scripts/pre-rentree/final-public-release-audit.mjs');
const manifestPath = join(root, 'data/campaigns/pre-rentree-2026.json');

interface PublicCampaignManifest {
  content: {
    practical: {
      preRegistrationNotice: string;
      noOnlinePaymentNotice: string;
      groupNotOpenedProcedure: string;
    };
    faq: Array<{ question: string; answer: string }>;
  };
}

describe('Pré-rentrée final public release gates', () => {
  it('scans public source files without leaking internal campaign tokens or copied business facts', () => {
    expect(() => execFileSync(process.execPath, [auditScript, '--source'], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    })).not.toThrow();
  });

  it('provides build artifact and rendered payload scan modes', () => {
    const source = readFileSync(auditScript, 'utf8');

    expect(source).toContain('--artifacts');
    expect(source).toContain('--rendered');
    expect(source).toContain('.next/static');
    expect(source).toContain('.next/server');
  });

  it('publishes a non-contractual information-request notice and no unapproved legal clause', () => {
    const manifest = JSON.parse(
      readFileSync(manifestPath, 'utf8'),
    ) as PublicCampaignManifest;
    const rules = manifest.content.practical;
    const publicLegalCopy = [
      ...Object.values(rules),
      ...manifest.content.faq.map((item) => item.answer),
    ].join(' ');

    expect(rules.preRegistrationNotice).toBe(
      'La demande d’information est transmise sans paiement. Elle ne réserve pas une place et ne forme pas un contrat. Après qualification pédagogique, Nexus transmet une proposition de parcours et les conditions applicables.',
    );
    expect(rules.groupNotOpenedProcedure).toBe(
      'Si Nexus Réussite décide de ne pas ouvrir le groupe, la famille est informée. Les conditions applicables sont communiquées avant toute confirmation.',
    );
    expect(publicLegalCopy).toContain(
      'Les modalités d’annulation, d’absence, de report et d’interruption sont communiquées avant toute confirmation.',
    );
    expect(publicLegalCopy).not.toMatch(/force majeure|avoir|rembours|restitu|conditions particulières|validation juridique/iu);
  });
});
