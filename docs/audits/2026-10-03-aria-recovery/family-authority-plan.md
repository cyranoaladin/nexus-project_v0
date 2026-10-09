# Autorité familiale interstores — plan d’implémentation

**Objectif :** empêcher une relation parent/élève historique V1 de maintenir un accès révoqué dans Core, sans transformer le consentement bilan en autorisation familiale.

**Architecture :** un contrat de lecture Core prend un instantané cohérent du parent, du membership et des identités élèves. Une seule façade hors ARIA choisit l’autorité selon le mode explicite et compare les deux identifiants élève. Les mutations V1 d’identités Core sont refusées avant effet tant qu’une coordination atomique n’est pas qualifiée.

**Contraintes approuvées par le mandat :** co-visibilité du foyer, membership VERIFIED avec provenance complète et sans révocation ; pas de fallback lors d’une panne ; pas de self-HTTP ; pas d’import Core dans `lib/aria/**` ; aucun backfill d’ownership ambigu. Les autres worktrees et tous les sous-agents restent en lecture seule.

## Lot 1 — garde central et contrat

- [x] Reproduire sur `requireParentOwnsStudent` l’accès encore accordé malgré membership Core révoqué, absent ou incohérent.
- [x] Ajouter `lib/core-v2/queries/family-authority.ts` : lecture transactionnelle répétable, identité parent et élèves, membership complet, résultat minimal sans PII.
- [x] Ajouter `lib/families/student-access-authority.ts` : sélection V1_ONLY/HYBRID/V2_ONLY, refus constant et distinction indisponibilité ; opérations lecture, filtrage bulk et refus de mutation.
- [x] Porter le garde central sur la façade ; conserver une erreur contrôlée 403/503.
- [x] Ajouter une exception architecturale étroite pour cette seule façade et ce seul contrat ; conserver les sabotages d’imports directs.
- [x] Tester les modes, parent V1/élève Core, mismatch id et userId, révocation, membership incomplet, panne et absence de fallback ; tests PostgreSQL réels.
- [ ] Typecheck, lint ciblé, scans secrets, diff check et commit atomique après réussite.

## Lot 2 — lectures et mutations publiques

- [ ] Filtrer les listes et agrégats avant chargement sensible et sérialisation ; aucun résultat d’un enfant refusé.
- [ ] Porter les helpers bilans/évaluations, documents, parent dashboards et ARIA par composition externe ; conserver le consentement bilan comme contrôle supplémentaire.
- [ ] Porter paiements enfant, abonnements, réservations, uploads, activation et inscription ; refuser les écritures V1 sur parent ou élève Core avant toute mutation/envoi/job.
- [ ] Tests directs négatifs de chaque API et bulk, avec relation V1 encore présente après révocation Core.
- [ ] Revue readonly, tests ciblés/réels, contrôles statiques et commit(s) par tranche cohérente.

## Qualification

- [ ] Renouveler suites complètes et E2E par rôle sur le SHA contenant chaque tranche.
- [ ] Mettre à jour la matrice fonctionnelle et la provenance ; ne déclarer aucune qualification production avant les gates opérationnelles et le déploiement vérifié.

Ce plan n’est pas une preuve d’implémentation. Le défaut interstores reste ouvert jusqu’aux tests et au portage exhaustif des points d’entrée.

## Portage effectivement couvert par cette tranche

Le garde parent canonique, les helpers RBAC/API, les routes candidat libre et le chargement des scores utilisés par les devis portent maintenant une intention explicite lecture/mutation. La création d’un devis ne peut utiliser ni studentId ni diagnosticId pour convertir une lecture Core autorisée en écriture V1. Une erreur d’autorisation du diagnostic est retournée avant persistance ; un diagnostic d’un autre élève est refusé. Les routes planning-studio déclarent leur intention pour rester compatibles avec le contrat requis.

Preuves privées : family-expanded-targeted.log (19 suites, 267 tests), family-expanded-typecheck-2.log (succès), family-expanded-lint.log (succès avec avertissements existants). Les tests du garde ont initialement reproduit quatre refus manquants ; deux tests de route ont reproduit séparément les contournements studentId et diagnosticId. Les tests PostgreSQL de famille/vérification utilisent exclusivement la base Core jetable dédiée. Une première commande a nommé à tort un fichier de test dans services/ au lieu de queries/ ; cet échec de lancement est conservé et corrigé sans modifier le test.

## Risques ouverts — cette tranche ne qualifie pas tout le domaine

Le portage des accès directs listés au lot 2 reste à faire. Le chargement complet d’un diagnostic précède encore son autorisation et doit être séparé de la projection minimale d’identité. Les mutations V1-only concurrentes à une migration active nécessitent une coordination de writers non encore implémentée. L’attachement studentId par un élève dans la route devis est traité par une tranche distincte documentée dans quotes-student-ownership.md ; la coordination V1/Core reste ouverte. Aucun de ces points n’est déclaré résolu par les tests ci-dessus. Aucun schéma ni migration de production modifiés.
