import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';
import BilanAssessmentPage from '@/app/bilan-gratuit/assessment/page';
import {
  ASSESSMENT_FLOW_COOKIE_NAME,
  createAssessmentFlowToken,
  hashAssessmentLeadEmail,
} from '@/lib/assessments/public-token';
import { Subject } from '@/lib/assessments/core/types';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

jest.mock('@/components/layout/CorporateNavbar', () => ({
  CorporateNavbar: () => <nav data-testid="navbar" />,
}));

jest.mock('@/components/layout/CorporateFooter', () => ({
  CorporateFooter: () => <footer data-testid="footer" />,
}));

jest.mock('@/app/bilan-gratuit/assessment/AssessmentClient', () => ({
  AssessmentClient: (props: { assessmentPublicToken: string; email: string }) => (
    <div data-testid="assessment-client" data-token-present={String(Boolean(props.assessmentPublicToken))}>
      {props.email}
    </div>
  ),
}));

describe('/bilan-gratuit/assessment token context', () => {
  const originalSecret = process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET = 'test-assessment-secret';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET;
    } else {
      process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET = originalSecret;
    }
  });

  it('canonicalizes public query params before rendering the assessment page', async () => {
    (cookies as jest.Mock).mockResolvedValue({
      get: jest.fn().mockReturnValue(undefined),
    });

    await expect(BilanAssessmentPage({
      searchParams: Promise.resolve({
        subject: 'MATHEMATIQUES',
        grade: 'terminale',
        email: 'attacker@example.test',
      }),
    })).rejects.toThrow('NEXT_REDIRECT:/bilan-gratuit/assessment');

    expect(redirect).toHaveBeenCalledWith('/bilan-gratuit/assessment');
  });

  it('refuses to generate a token without a signed lead flow cookie', async () => {
    (cookies as jest.Mock).mockResolvedValue({
      get: jest.fn().mockReturnValue(undefined),
    });

    render(await BilanAssessmentPage({
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByText(/accès au diagnostic expiré/i)).toBeInTheDocument();
    expect(screen.queryByTestId('assessment-client')).not.toBeInTheDocument();
  });

  it('renders the assessment only from a signed lead-bound flow cookie', async () => {
    const flowToken = createAssessmentFlowToken({
      subject: Subject.MATHS,
      grade: 'TERMINALE',
      source: 'bilan-gratuit',
      leadEmailHash: hashAssessmentLeadEmail('parent@example.test'),
    });
    (cookies as jest.Mock).mockResolvedValue({
      get: jest.fn((name: string) => (
        name === ASSESSMENT_FLOW_COOKIE_NAME ? { value: flowToken } : undefined
      )),
    });

    render(await BilanAssessmentPage({
      searchParams: Promise.resolve({}),
    }));

    const client = screen.getByTestId('assessment-client');
    expect(client).toHaveAttribute('data-token-present', 'true');
    expect(client.textContent).toMatch(/^assessment\+/);
    expect(client.textContent).not.toContain('attacker@example.test');
  });
});
