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

// Mock layout components for full-page rendering
jest.mock('@/components/layout/CorporateNavbar', () => ({
  CorporateNavbar: () => <div data-testid="navbar" />,
}));
jest.mock('@/components/layout/CorporateFooter', () => ({
  CorporateFooter: () => <div data-testid="footer" />,
}));
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

import Stages2026Page from '@/app/stages/Stages2026Page';

function buildStagesProps() {
  const calendar = getStageCalendar();
  const rules = getRules();
  const passIntensifs = getPacks().filter((pack) => pack.id.startsWith('pass-intensifs'));
  const formatIds = [...new Set(calendar.map((e) => e.format_id))];
  const formatMap: Record<string, { format: StageFormat; priceValidated: boolean }> = {};
  for (const id of formatIds) {
    const format = getStageFormat(id);
    if (format) {
      formatMap[id] = { format, priceValidated: isFormatPriceValidated(format) };
    }
  }
  return { calendar, rules, passIntensifs, formatMap };
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
  it('all stages show a price (none pending)', () => {
    render(<Stages2026Page {...buildStagesProps()} />);
    const calendar = getStageCalendar();
    for (const stage of calendar) {
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
