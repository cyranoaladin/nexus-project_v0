/**
 * Test the two branches of StagePriceLabel via actual rendering.
 * Branch 1: price = number → displays formatted TND price
 * Branch 2: price = null  → displays "Sur devis"
 */
import { render, screen } from '@testing-library/react';
import { StagePriceLabel } from '@/app/stages/_components/StagePriceLabel';
import {
  getStageCalendar,
  getStageFormat,
  isFormatPriceValidated,
  getRules,
  getPacks,
} from '@/lib/pricing';
import type { StageFormat } from '@/lib/pricing';
import type { ButtonHTMLAttributes } from 'react';
import { getPreRentreeLandingDTO } from '@/lib/campaigns/pre-rentree-2026/getters';

// Mock layout components for full-page rendering
jest.mock('@/components/layout/CorporateNavbar', () => ({
  CorporateNavbar: () => <div data-testid="navbar" />,
}));
jest.mock('@/components/layout/CorporateFooter', () => ({
  CorporateFooter: () => <div data-testid="footer" />,
}));
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, asChild, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) => {
    void asChild;
    return <button {...props}>{children}</button>;
  },
}));

import Stages2026Page from '@/app/stages/Stages2026Page';

function buildStagesProps() {
  const calendar = getStageCalendar();
  const rules = getRules();
  const passIntensifs = getPacks().filter((pack) => pack.id.startsWith('pass-intensifs'));
  const formatIds = [...new Set(calendar.map((entry) => entry.format_id))]
    .filter((id): id is string => typeof id === 'string');
  const formatMap: Record<string, { format: StageFormat; priceValidated: boolean }> = {};
  for (const id of formatIds) {
    const format = getStageFormat(id);
    if (format) {
      formatMap[id] = { format, priceValidated: isFormatPriceValidated(format) };
    }
  }
  const campaignDto = getPreRentreeLandingDTO();
  const campaign = {
    id: campaignDto.campaign.id,
    path: campaignDto.campaign.canonicalPath,
    eyebrow: campaignDto.content.hero.eyebrow,
    subtitle: campaignDto.content.hero.subtitle,
    levels: campaignDto.levels.map((level) => level.label),
    subjects: campaignDto.subjects.map((subject) => subject.label),
    groupMax: campaignDto.capacity.maxPerCohort,
  };
  return { calendar, rules, passIntensifs, formatMap, campaign };
}

// ── Branch test on extracted component ──

describe('StagePriceLabel — rendered branch coverage', () => {
  it('renders formatted price when price is a number', () => {
    render(<StagePriceLabel price={420} />);
    expect(screen.getByText(/420/)).toBeInTheDocument();
    expect(screen.queryByText('Sur devis')).toBeNull();
  });

  it('renders "Sur devis" when price is null', () => {
    render(<StagePriceLabel price={null} />);
    expect(screen.getByText('Sur devis')).toBeInTheDocument();
    expect(screen.queryByText(/\d+\s*TND/)).toBeNull();
  });

  it('renders large price correctly', () => {
    render(<StagePriceLabel price={1450} />);
    expect(screen.getByText(/1\s*450/)).toBeInTheDocument();
  });
});

// ── Full page test with real data ──

describe('Stages page — real prices', () => {
  it('uses dedicated packs for Pré-rentrée and validates all generic stage prices', () => {
    render(<Stages2026Page {...buildStagesProps()} />);
    const calendar = getStageCalendar();
    const preRentree = calendar.find((stage) => stage.id === 'pre-rentree-2026');
    expect(preRentree?.format_id).toBeNull();
    const genericStages = calendar.filter(
      (entry): entry is typeof entry & { format_id: string } => typeof entry.format_id === 'string',
    );
    for (const stage of genericStages) {
      expect(isFormatPriceValidated(stage.format_id)).toBe(true);
    }
    expect(screen.queryByText('Sur devis')).toBeNull();
  });

  it('express-vacances shows 420 TND', () => {
    render(<Stages2026Page {...buildStagesProps()} />);
    expect(screen.getAllByText(/420/).length).toBeGreaterThanOrEqual(1);
  });

  it('intensif-renfort shows 720 TND', () => {
    render(<Stages2026Page {...buildStagesProps()} />);
    const fmt = getStageFormat('intensif-renfort')!;
    expect(screen.getAllByText(new RegExp(`${fmt.price_per_student}`)).length).toBeGreaterThanOrEqual(1);
  });
});
