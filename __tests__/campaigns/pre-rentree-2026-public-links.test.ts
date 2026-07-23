import fs from 'fs';
import path from 'path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Pré-rentrée public access and routing', () => {
  it.each([
    'components/layout/CorporateNavbar.tsx',
    'components/marketing/PreRentreeCampaignSpotlight.tsx',
    'app/stages/Stages2026Page.tsx',
    'app/offres/page.tsx',
  ])('links directly to the canonical campaign from %s', (file) => {
    expect(read(file)).toMatch(
      /\/stages\/pre-rentree-2026|PRE_RENTREE_2026_NAVIGATION\.path|campaign\.(?:path|campaignPath)|preRentree\.(?:campaign\.)?canonicalPath/,
    );
  });

  it('wires the canonical campaign spotlight into the homepage', () => {
    const source = read('app/HomePageClient.tsx');
    expect(source).toContain('<PreRentreeCampaignSpotlight campaign={campaign} />');
  });

  it('uses a permanent short-route redirect', () => {
    const source = read('app/pre-rentree/page.tsx');
    expect(source).toContain('permanentRedirect');
    expect(source).toContain("'/stages/pre-rentree-2026'");
    expect(source).not.toMatch(/\bredirect\(/);
  });

  it('guards the canonical sitemap route behind the publication status', () => {
    const source = read('app/sitemap.ts');
    expect(source).toContain('getPreRentreeReleaseGate().isPublicReady');
    expect(source).toContain('preRentree?.publication.indexable');
    expect(source).toContain('preRentree.canonicalPath');
    expect(source).not.toMatch(/\$\{BASE_URL\}\/pre-rentree[`']/);
  });

  it('removes the historical Pré-rentrée card from the generic stages calendar', () => {
    const source = read('app/stages/Stages2026Page.tsx');
    expect(source).toContain('stage.id !== campaign?.id');
    expect(source).not.toContain('Pré-Rentrée du 24 au 28 août');
  });
});
