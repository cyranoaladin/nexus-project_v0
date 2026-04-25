import React from 'react';
import { render, screen } from '@testing-library/react';
import { EleveCockpit } from '@/components/dashboard/eleve/EleveCockpit';
import type { EleveDashboardData, EleveAlert, EleveFeuilleDeRouteItem } from '@/components/dashboard/eleve/types';

const makeData = (overrides: Partial<EleveDashboardData> = {}): EleveDashboardData => ({
  student: {
    id: 's1',
    firstName: 'Nour',
    lastName: 'Ben Ali',
    email: 'nour@test.com',
    grade: 'PREMIERE',
    gradeLevel: 'PREMIERE',
    academicTrack: 'EDS_GENERALE',
    specialties: [],
    stmgPathway: null,
    survivalMode: false,
    survivalModeReason: null,
    school: null,
  },
  cockpit: { seanceDuJour: null, feuilleDeRoute: [], alertes: [] },
  trackContent: { specialties: [], stmgModules: [] },
  sessionsCount: 3,
  nextSession: null,
  recentSessions: [],
  lastBilan: null,
  recentBilans: [],
  upcomingStages: [],
  pastStages: [],
  resources: [],
  ariaStats: { messagesToday: 0, totalConversations: 5, canUseAriaMaths: true, canUseAriaNsi: false },
  badges: [],
  trajectory: { id: null, title: null, progress: 0, daysRemaining: 0, milestones: [], nextMilestoneAt: null },
  automatismes: null,
  survivalProgress: null,
  credits: { balance: 3, nonExpiredCount: 3, nextExpiryAt: null },
  ...overrides,
});

const makeAlert = (overrides: Partial<EleveAlert> = {}): EleveAlert => ({
  id: 'a1',
  severity: 'warning',
  title: 'Attention',
  body: 'Votre solde de crédits est faible.',
  ...overrides,
});

const makeRouteItem = (overrides: Partial<EleveFeuilleDeRouteItem> = {}): EleveFeuilleDeRouteItem => ({
  id: 'step-1',
  type: 'EXERCISE',
  title: 'Réviser les dérivées',
  estimatedMinutes: 20,
  priority: 1,
  href: '/programme/maths/derivees',
  done: false,
  ...overrides,
});

describe('EleveCockpit', () => {
  it('renders "Cockpit du jour" heading', () => {
    render(<EleveCockpit data={makeData()} />);
    expect(screen.getByRole('heading', { name: /Cockpit du jour/i })).toBeInTheDocument();
  });

  it('shows session count', () => {
    render(<EleveCockpit data={makeData({ sessionsCount: 7 })} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('shows ARIA conversations count', () => {
    render(<EleveCockpit data={makeData()} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows "Aucune séance programmée" when nextSession is null', () => {
    render(<EleveCockpit data={makeData({ nextSession: null })} />);
    expect(screen.getByText(/Aucune séance programmée/i)).toBeInTheDocument();
  });

  it('shows next session title when present', () => {
    const data = makeData({
      nextSession: {
        id: 'sess-1',
        title: 'Séance Maths',
        subject: 'MATHEMATIQUES',
        scheduledAt: '2026-05-10T14:00:00.000Z',
        duration: 60,
        coach: { firstName: 'Alice', lastName: 'D', pseudonym: 'alice' },
      },
    });
    render(<EleveCockpit data={data} />);
    expect(screen.getByText('Séance Maths')).toBeInTheDocument();
  });

  it('renders alertes section when alertes are present', () => {
    const data = makeData({
      cockpit: {
        seanceDuJour: null,
        feuilleDeRoute: [],
        alertes: [makeAlert({ severity: 'critical', title: 'Crédits épuisés', body: 'Rechargez.' })],
      },
    });
    render(<EleveCockpit data={data} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Crédits épuisés')).toBeInTheDocument();
  });

  it('does not render alertes section when alertes is empty', () => {
    render(<EleveCockpit data={makeData()} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders feuille de route items when present', () => {
    const data = makeData({
      cockpit: {
        seanceDuJour: null,
        feuilleDeRoute: [makeRouteItem()],
        alertes: [],
      },
    });
    render(<EleveCockpit data={data} />);
    expect(screen.getByText(/Feuille de route/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Réviser les dérivées/i });
    expect(link).toHaveAttribute('href', '/programme/maths/derivees');
  });

  it('does not render feuille de route section when empty', () => {
    render(<EleveCockpit data={makeData()} />);
    expect(screen.queryByText(/Feuille de route/i)).not.toBeInTheDocument();
  });

  it('marks done items with line-through class', () => {
    const data = makeData({
      cockpit: {
        seanceDuJour: null,
        feuilleDeRoute: [makeRouteItem({ done: true, title: 'Tâche terminée' })],
        alertes: [],
      },
    });
    render(<EleveCockpit data={data} />);
    const el = screen.getByText('Tâche terminée');
    expect(el.className).toContain('line-through');
  });

  it('hides Réserver button in readOnly mode', () => {
    render(<EleveCockpit data={makeData()} readOnly={true} />);
    expect(screen.queryByRole('button', { name: /Réserver/i })).not.toBeInTheDocument();
  });

  it('does not contain any placeholder text', () => {
    render(<EleveCockpit data={makeData()} />);
    expect(screen.queryByText(/seront enrichies/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/viennent du payload/i)).not.toBeInTheDocument();
  });
});
