# Plan d'implémentation — dashboards, bilans et finance sans crédits

> Pour les agents : exécuter en TDD, avec revue de conformité puis de qualité. Travail exclusivement dans ce worktree. Aucun commit, merge, déploiement ou mutation d'une base réelle par sous-agent.

## Autorisation et périmètre

Le 6 septembre 2026, l'utilisateur demande de commencer la réalisation, de supprimer la logique de crédit, de centrer élèves/parents sur les bilans et leur visibilité et de conserver uniquement paiement/facture comme logique financière assistante. Cette instruction précise la proposition d'audit précédente et autorise la réalisation de ce périmètre.

Architecture : suppression des opérations de crédit actives ; conservation des colonnes et historiques existants sans migration destructive. Les bilans restent soumis à leurs règles canoniques de consentement/publication. Paiements, factures, abonnements et droits non liés aux crédits restent opérables ; aucun ancien paiement n'est annulé automatiquement.

Stack : Next.js, React, TypeScript, Prisma, PostgreSQL, Jest, Playwright.

## Coordination

- Base : `76d542ebf4600e9ea845ca22cfc603fd4d40b179`.
- Branche : `codex/dashboard-bilans-sans-credits`.
- Worktree : `.worktrees/dashboard-bilans-sans-credits`.
- Dépendances et client Prisma propres à ce worktree ; aucun lien vers le node_modules partagé.
- Les autres branches/worktrees ne sont ni modifiés, ni rebasés, ni nettoyés.
- Ce plan et le rapport final listent les fichiers à intégrer et les conflits à surveiller.

## Lot A — Retirer les opérations de crédit

Fichiers : routes de crédits assistante, `lib/cron-jobs.ts`, `lib/credits.ts`, `lib/session-booking.ts`, `lib/entitlement/engine.ts`, routes abonnement/paiement/séances qui écrivent des crédits.

- [x] Inventorier lecteurs/écrivains et leurs tests.
- [x] Écrire des tests prouvant qu'anciennes requêtes ne créent plus de crédits, qu'allocations/expirations n'écrivent ni n'envoient d'emails et que paiement/activation non crédit fonctionne.
- [x] Exécuter RED et consigner les échecs attendus.
- [x] Supprimer les mutations/dépendances de crédit ; fermer les routes obsolètes avec réponse explicite et autorisation conservée.
- [x] Exécuter GREEN puis les tests existants pertinents, adapter ceux dont le contrat métier est remplacé.

## Lot B — Assistante : paiements et factures

Fichiers : `app/dashboard/assistante/**`, `components/navigation/navigation-config.ts`, `app/api/assistante/dashboard/route.ts` et leurs tests.

- [x] Tests de navigation sans crédit, anciennes URLs redirigées vers paiements, absence de compteur/gestion de crédit.
- [x] Exécuter RED.
- [x] Retirer les écrans, cartes, actions et champs de crédit ; préserver admissions/bilans/planning et les pages paiement/facture.
- [x] Vérifier GREEN, liens et états de chargement/erreur.

## Lot C — Familles : bilans et visibilité

Fichiers : `app/dashboard/parent/**`, `app/dashboard/eleve/**`, composants parent/élève, `app/api/parent/dashboard/route.ts`, `lib/dashboard/student-payload.ts` et tests.

- [x] Tests de dashboard sans crédits et de liens vers les bilans existants ; accès inter-familles interdit et versions non publiées non exposées.
- [x] Exécuter RED.
- [x] Retirer affichages/actions de crédit, améliorer l'accès aux bilans autorisés ; ne pas inventer de nouveau modèle pédagogique.
- [x] Corriger les métriques artificielles si affichées dans ces espaces : préférer donnée indisponible à mesure inventée.
- [x] Vérifier GREEN et contrats de visibilité existants.

## Lot D — Intégration

Fichiers : catalogue produits, composants réservation, moteur prochaine action, surfaces admin/coach résiduelles, tests transversaux.

- [x] Retirer commercialisation et contrôles/compteurs actifs de crédits restants, garder les données historiques.
- [x] Exécuter les tests pertinents, lint, typecheck, build si environnement compatible ; documenter les échecs préexistants.
- [ ] Vérifier navigateur authentifié sur données synthétiques : aucun environnement privé de recette disponible dans ce worktree ; non exécuté.
- [x] Revue indépendante conformité puis qualité ; corriger les remarques avérées.
- [x] Livrer modifications isolées, preuves et instructions d'intégration sans merge automatique sur branche concurrente.

Chaque séquence test RED → correction GREEN → refactor constitue des étapes de 2–5 minutes. Les lots ne sont pas des estimations de durée globale.
