# Plan d'implémentation — bilan de pré-rentrée

1. Écrire les tests de contrat des deux CTA publics, de leurs destinations et de leur présence sur les deux pages.
2. Écrire les tests de guidage parent : état vide, consigne exacte, lien copiable et répétabilité multi-enfants.
3. Écrire les tests du retour d'activation élève vers la sélection de matière et de l'accès durable depuis son dashboard.
4. Écrire les tests du fil assistante, de l'état de saisie et du libellé final, tout en conservant les tests d'accès et de provenance.
5. Implémenter les composants et adaptations minimales jusqu'à rendre ces tests verts.
6. Exécuter les tests ciblés, la suite Jest complète sans filtre, lint, typecheck et build avec environnement local neutralisé.
7. Vérifier le rendu réel desktop/mobile avec Playwright, produire les captures, relire le diff, puis publier une PR sans merge ni déploiement.
