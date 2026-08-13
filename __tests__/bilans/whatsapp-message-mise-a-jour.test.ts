
describe('Message d’information de mise à jour — cas B option 3', () => {
  const { buildBilanUpdateWhatsAppMessage } = jest.requireActual('@/lib/bilans/staff/whatsapp-message');

  it('registre courtois : affiner, jamais s’excuser ; aucun lien, l’accès reste le même', () => {
    const message = buildBilanUpdateWhatsAppMessage({
      parentDisplayName: 'Alaeddine Ben Rhouma',
      studentFirstName: 'Kamel',
      updatedAtLabel: '14 août 2026',
    });
    expect(message).toContain('affiné');
    expect(message).toContain('même accès');
    expect(message).toContain('14 août 2026');
    expect(message).toContain('Bien cordialement');
    // Non anxiogène : on a affiné le diagnostic, on ne s'était pas « trompé ».
    for (const banned of ['erreur', 'trompé', 'faux', 'excuse', 'anomalie']) {
      expect(message.toLowerCase()).not.toContain(banned);
    }
    // Aucun lien : un lien enregistré ne meurt jamais, rien à retransmettre.
    expect(message).not.toContain('http');
  });
});
