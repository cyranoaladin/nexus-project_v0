import {
  canAccessPlanningStudio,
  isPlanningStudioPath,
  PLANNING_STUDIO_PATH,
} from '@/lib/planning-studio/access';

describe('Planning Studio — chemin protégé', () => {
  it.each(['/planning', '/planning/', '/planning/index.html', '/planning/assets/app.js', '/planning/data/default-data.js'])(
    'reconnaît %s comme chemin de l\'outil',
    (pathname) => {
      expect(isPlanningStudioPath(pathname)).toBe(true);
    },
  );

  it.each(['/', '/planningX', '/dashboard/assistante/stages/planning', '/api/planning', '/offres'])(
    'ne confond pas %s avec l\'outil',
    (pathname) => {
      expect(isPlanningStudioPath(pathname)).toBe(false);
    },
  );

  it('expose le chemin canonique', () => {
    expect(PLANNING_STUDIO_PATH).toBe('/planning');
  });
});

describe('Planning Studio — rôles autorisés', () => {
  it.each(['ADMIN', 'ASSISTANTE', 'COACH'])('%s peut ouvrir le planificateur', (role) => {
    expect(canAccessPlanningStudio(role)).toBe(true);
  });

  it.each(['PARENT', 'ELEVE', '', undefined, null, 42, 'admin'])('%p est refusé', (role) => {
    expect(canAccessPlanningStudio(role)).toBe(false);
  });
});
