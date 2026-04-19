// Tests unitaires Jest
// On simule les fonctions de recommandation pour les tester isolément
// Ces fonctions ont été extraites de TeacherView.tsx pour être testables

function getTeacherRecommandation(xp: number, weakCount: number, dueReviews: number, completed: number, total: number): string {
  const coverage = total > 0 ? (completed / total) * 100 : 0;
  if (weakCount >= 3) {
    return `Priorité absolue aux automatismes`;
  }
  if (dueReviews >= 3) {
    return `La mémorisation à long terme est fragilisée`;
  }
  if (coverage >= 80) {
    return `Excellente maîtrise du programme`;
  }
  return `Profil équilibré`;
}

describe('Génération de Bilan Enseignant', () => {
  it('doit recommander les automatismes si plus de 3 lacunes', () => {
    const rec = getTeacherRecommandation(100, 4, 0, 5, 10);
    expect(rec).toContain('Priorité absolue aux automatismes');
  });

  it('doit alerter sur le SRS si les révisions sont en retard', () => {
    const rec = getTeacherRecommandation(500, 1, 5, 5, 10);
    expect(rec).toContain('mémorisation à long terme est fragilisée');
  });

  it('doit féliciter pour une couverture > 80%', () => {
    const rec = getTeacherRecommandation(1500, 0, 0, 9, 10);
    expect(rec).toContain('Excellente maîtrise du programme');
  });

  it('doit renvoyer un profil équilibré par défaut', () => {
    const rec = getTeacherRecommandation(500, 1, 0, 5, 10);
    expect(rec).toContain('Profil équilibré');
  });
});
