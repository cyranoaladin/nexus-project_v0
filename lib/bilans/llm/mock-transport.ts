import type { BilanGenerationRequest, BilanLlmTransport } from './gateway';

function title(domainId: string): string {
  return domainId.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ');
}

export class MockBilanLlmTransport implements BilanLlmTransport {
  readonly requests: BilanGenerationRequest[] = [];

  async generate(request: BilanGenerationRequest): Promise<unknown> {
    this.requests.push(request);
    const domains = request.factSheet.domains.map(({ id }) => ({ id, title: title(id) }));
    const pointAppuiCount = domains.length === 1 ? 1 : Math.min(3, domains.length - 1);
    const pointsAppui = domains.slice(0, pointAppuiCount);
    const priorities = domains.length === 1 ? domains : domains.slice(pointAppuiCount);
    switch (request.agent.id) {
      case 'preAnalysis':
        return {
          synthese: 'La passation met en évidence des appuis et des priorités de travail.',
          forcesPercues: ['Une démarche engagée'],
          craintes: ['Un besoin de méthode plus stable'],
        };
      case 'eleve':
        return {
          accroche: 'Ton travail montre des appuis utiles pour progresser avec méthode.',
          forces: ['Une démarche engagée.', 'Des acquis mobilisables.', 'Une attention aux consignes.'],
          priorites: domains.map((domain) => ({
            domainId: domain.id,
            titre: domain.title,
            pourquoi: 'Stabiliser les démarches utiles.',
            comment: 'Reprendre les raisonnements puis varier les exercices.',
          })),
          microPlan: [{ action: 'Revoir une démarche puis expliquer son raisonnement.', dureeMin: 20 }],
          motDeFin: 'Le travail peut avancer de façon progressive et structurée.',
        };
      case 'parents':
        return {
          cadre: 'La passation fournit des repères utiles pour organiser la suite du travail.',
          pointsAppui: pointsAppui.map((domain) => ({
            domainId: domain.id,
            texte: `${domain.title} constitue un point d'appui à mobiliser.`,
          })),
          priorites: priorities.map((domain) => ({
            domainId: domain.id,
            titre: domain.title,
            ceQuiSeraFait: 'Les démarches seront reprises avec des exercices progressifs.',
          })),
          etapeSuivante: {
            texte: 'Un échange permettra de préciser le parcours pédagogique.',
            cta: 'Être conseillé',
          },
        };
      case 'nexus':
        return {
          syntheseProfil: 'Profil synthétique fondé sur la FactSheet.',
          diagnosticPedagogique: 'Les priorités sont ordonnées par domaine et par profil observé.',
          planQuatreSemaines: 'Prévoir une reprise guidée, une verbalisation et un entraînement progressif.',
          alertes: [],
          ragReferences: [],
        };
      case 'verifier':
        return { ok: true, violations: [] };
    }
  }
}
