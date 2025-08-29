import { renderLatex } from '../../..//apps/web/server/bilan/orchestrator';

describe('renderLatex(view)', () => {
  it('injecte correctement les champs requis', () => {
    const view = {
      student_name: 'Marie Dupont', level: 'Terminale', subjects: 'Spé Maths + NSI', status: 'Scolarisée',
      qcm_total: 60, qcm_max: 80, score_global: 75,
      intro_text: 'Intro', diagnostic_text: 'Diag', profile_text: 'Profil', roadmap_text: 'Roadmap', offers_text: 'Offres', conclusion_text: 'Conclusion',
      table_domain_rows: 'Maths & 12 / 20 & 60% & lacunes \\\\',
      fig_radar_path: 'radar.png', badges_tex: '\\badge{Autonomie}',
    } as any;
    const tex = renderLatex(view);
    expect(tex).toContain('Rapport de Bilan');
    expect(tex).toContain('Marie Dupont');
    expect(tex).toContain('Maths');
    expect(tex).toContain('badges');
  });
});
