import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import PreRentree2026Page from '@/app/stages/pre-rentree-2026/page';

jest.mock('@/lib/analytics', () => ({
  track: { preRentreePageView: jest.fn() },
}));
jest.mock('@/components/layout/CorporateNavbar', () => ({ CorporateNavbar: () => <nav>Navigation</nav> }));
jest.mock('@/components/layout/CorporateFooter', () => ({ CorporateFooter: () => <footer>Pied de page</footer> }));
jest.mock('@/lib/campaigns/pre-rentree-2026/release-gate', () => ({
  getPreRentreeReleaseGate: () => ({ releaseStatus: 'PUBLIC_READY', isPublicReady: true }),
}));

// Owner hotfix (2026-07-27): governance/operational wording leaked verbatim to
// families on the live page. This scans the actual rendered HTML/text content
// (not just component source) for the exact forbidden expressions the owner
// listed, and separately confirms the intended replacement copy landed.
const FORBIDDEN_PHRASES = [
  'référentiel canonique',
  'matières autorisées',
  'aucun service numérique',
  'non inclus',
  'troisième salle temporaire',
  'bloc c en terminale',
  'promesse de laboratoire',
  'parcours public',
  'conditions contractuelles',
  'rapprochement',
  'proofid',
  'owner',
  'allowlist',
  'publication_authorization',
  'ready_for',
  'public_ready',
  'review',
  'draft',
  'gate',
  'sbom',
  'runtime',
];

const REQUIRED_PHRASES = [
  'Préparez la rentrée avec des bases solides',
  '5 séances de 2 h par matière',
  'Formules et tarifs',
  'Trouvez le planning adapté',
  'Une méthode structurée pour progresser en cinq séances',
  'Découvrez le programme de chaque matière',
  'Construisons le bon parcours pour votre enfant',
];

describe('Pré-rentrée 2026 public page — copy sanitization', () => {
  it('never renders internal governance/operational wording in the visible or serialized HTML', () => {
    const { container } = render(<PreRentree2026Page />);
    // Includes the JSON-LD <script> payload deliberately: a leak serialized
    // into structured data would still ship to every visitor's HTML.
    const fullHtml = container.innerHTML.toLowerCase();

    for (const phrase of FORBIDDEN_PHRASES) {
      expect(fullHtml).not.toContain(phrase.toLowerCase());
    }
  });

  it('renders the approved parent-facing copy for every rebuilt section', () => {
    const { container } = render(<PreRentree2026Page />);
    const text = container.textContent ?? '';

    for (const phrase of REQUIRED_PHRASES) {
      expect(text).toContain(phrase);
    }
  });

  it('does not gate/allowlist reference or SBOM/runtime word leak through any script tag', () => {
    const { container } = render(<PreRentree2026Page />);
    const scripts = Array.from(container.querySelectorAll('script'));
    const scriptText = scripts.map((script) => script.textContent ?? '').join('\n').toLowerCase();

    expect(scriptText).not.toMatch(/gate|allowlist|owner|sbom|runtime|proofid|publication_authorization/);
  });
});
