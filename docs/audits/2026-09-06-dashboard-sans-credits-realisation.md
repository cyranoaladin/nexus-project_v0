# Dashboards centrés sur les bilans, finance sans crédits

## Date et état initial

6 septembre 2026. Base `76d542ebf4600e9ea845ca22cfc603fd4d40b179`, branche isolée `codex/dashboard-bilans-sans-credits`, worktree `.worktrees/dashboard-bilans-sans-credits`. Le dépôt principal et les autres branches de travail n’ont pas été modifiés. Dépendances et client Prisma propres à ce worktree.

## Demande et décisions réalisées

L’utilisateur a demandé de commencer le retrait des crédits, avec priorité aux bilans et à leur visibilité pour les familles, et aux paiements/factures pour l’assistante.

- Élève : suppression du solde et des alertes de crédit ; accès explicite aux bilans, y compris après plusieurs clics successifs.
- Parent : suppression des informations de crédit et des indicateurs artificiels (score déduit des XP, métriques SSN/UAI fabriquées). Les mesures disponibles restent affichées, les données absentes ne sont pas inventées.
- Assistante : navigation, listes, fiches élèves et abonnements sans crédit. Les anciennes URLs redirigent vers les paiements. Paiements/factures, admissions, bilans et planning restent accessibles. Liste élèves sur l’API paginée existante.
- Admin/coach : suppression des compteurs, activités, projections et modèles de vente de crédits. La configuration héritée n’est plus exposée ni modifiable par la configuration active.
- Finance : montant des paiements complétés utilisé sans additionner une seconde fois les abonnements. Les packs pédagogiques non crédit sont classés SPECIAL_PACK.
- Backend : aucune allocation, dépense, restitution, expiration ou relance de crédit. Anciennes routes protégées puis réponse 410. Les anciens jobs restent appelables et inertes. Création de paiements CREDIT_PACK refusée ; recherche idempotente des paiements historiques préservée.
- Réservation : contrôles d’identité, de rattachement familial, disponibilité, conflits et règles d’annulation conservés ; plus de condition sur un solde.
- Les bilans restent soumis aux contrôles existants de propriétaire, consentement et publication. Aucune refonte des comptes/authentifications hors périmètre n’est introduite.

## Sources de vérité et conservation

Les coûts/allocations opérationnels sont neutralisés dans `data/pricing.canonical.json`, puis la projection client est régénérée. Aucune modification des tarifs monétaires. Le registre des produits conserve les identifiants et libellés nécessaires aux factures historiques, sans octroyer de nouveaux crédits.

Aucune migration Prisma, suppression de colonne/table, mutation d’une base réelle, annulation de facture ou réécriture de paiement historique. Les colonnes obligatoires héritées reçoivent zéro pour les nouvelles opérations. Les gardes empêchant la suppression de comptes porteurs d’historique sont conservés. Les anciens contrats commerciaux ne sont pas réécrits.

Les huit suites consacrées exclusivement aux mutations de crédits ont été remplacées par des tests de retrait, conservation et autorisation. Les contrôles d’annulation, famille, conflits et idempotence demeurent testés.

## Vérifications

- TDD observé sur les lots backend, assistante, familles, catalogue, projections coach et configuration admin : échec attendu, correction, succès.
- Exécution consolidée finale des 63 suites consolidées (modifiées/nouvelles et régression activation parent) : 806 tests réussis, `NEXTAUTH_URL=http://localhost:3000 npm test -- --runInBand --runTestsByPath …`.
- IDOR : 9 tests réussis avec la configuration Jest d’intégration, sans base réelle.
- Activation parent : 9 tests réussis avec une origine locale synthétique ; l’échec initial sans NEXTAUTH_URL concerne un graphe inchangé.
- Lint global : succès avec avertissements existants. Lint ciblé des fichiers de production revus réussi. Les tests admin config comportent deux require() préexistants que le lint direct du fichier de test refuse ; aucun ajout de ces constructions.
- Revue croisée conformité/qualité : lien bilans répété corrigé, derniers champs coach et configuration héritée retirés.
- Résultats globaux typecheck/build/suite complète : voir complément ci-dessous.

## Limites et préparation de l’intégration

- Pas de recette navigateur authentifiée ni de test sur base réelle : aucun environnement privé de recette avec données synthétiques prêt à l’emploi n’a été établi ici. Les tests API/composants ne remplacent pas cette recette.
- Les CGV publiques existantes contiennent encore des clauses historiques de consommation/restitution de crédits (`app/conditions-generales/page.tsx`). Leur version applicable aux futurs contrats doit être alignée avant mise en production, en distinguant les droits des contrats existants ; aucun engagement contractuel passé n’est supprimé par ce travail.
- L’indicateur financier mensuel reste basé sur `Payment.createdAt` et le statut COMPLETED, pas sur une nouvelle date de rapprochement comptable.
- Aucun quota de remplacement ni nouveau modèle commercial de réservation n’a été inventé. Les règles actuelles de planning s’appliquent.
- Les noms/types hérités maintenus pour compatibilité ne constituent plus un mécanisme économique actif.

## Intégration et rollback

Aucun merge ni déploiement automatique. Examiner les changements depuis la base ci-dessus, avec attention aux fichiers partagés : catalogue canonique/projection générée, navigation, routes dashboards, paiements, entitlements et configuration.

Intégrer sur une branche de coordination en conservant les travaux concurrents, résoudre les conflits par domaine métier puis rejouer les vérifications. Le schéma de base reste compatible ; un retour de version applicative ne nécessite aucune migration inverse, mais réactiverait la logique de crédit de l’ancienne version et doit donc être une décision explicite.

## Résultats finaux des contrôles globaux

- `npm run typecheck -- --incremental false` : code sortie 0.
- `npm run lint` : code sortie 0, avertissements existants.
- `git diff --check` : code sortie 0.
- Première suite complète `npm run test -- --runInBand` : 912 suites, 902 réussies, 10 échouées ; 9 999 tests réussis, 21 échoués. Ne pas présenter cette exécution comme verte : elle a traversé les dernières éditions. Les neuf suites affectées par les contrats remplacés ont été corrigées ; la dixième échouait faute de NEXTAUTH_URL. Les dix figurent dans la relance consolidée finale : 63 suites et 806 tests réussis avec origine locale synthétique. Pas de seconde exécution complète des 912 suites.
- `npm run build` : code sortie 1 au contrôle `scripts/validate-next-traces.js .next`, après compilation réussie, vérification des types et génération des 95 pages. Le validateur classe les chemins absolus contenant `.worktrees` comme interdits, y compris les fichiers internes à cet artefact isolé. Le contrôle reste intact ; artefact non déclaré prêt au déploiement. Les contrôles de publication suivants ne sont donc pas validés. Avertissements Edge Runtime provenant de jose/next-auth également observés.
- Recette navigateur privée et smoke de production après changement : non exécutés ; rien n’est déployé.

Les logs de travail sont dans `/tmp/nexus-no-credits-{verified-tests,typecheck-verified,lint-final,build,full-tests}.log`. Le journal de build peut être volumineux : il liste les chemins rejetés. Liste des changements : `2026-09-06-dashboard-sans-credits-fichiers.txt`.

## Livraison

Modifications laissées dans le worktree isolé, sans commit, merge ou déploiement. Le document généré par un test shadow a été remis à son contenu initial dans ce seul worktree après vérification de son unique différence de date. Aucun fichier concurrent n’a été restauré.
