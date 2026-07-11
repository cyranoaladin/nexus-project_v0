# ADR 005 — sources de vérité et intégration applicative de la Pré-rentrée 2026

## Statut

**ACCEPTÉ — OWNER-016, OWNER-017, OWNER-018 et OWNER-019, le 11 juillet 2026**

Cette ADR autorise la phase suivante de conception physique, pas une modification Prisma ou une publication dans la phase courante.

## Date

11 juillet 2026

## Contexte

Le dépôt possède aujourd'hui deux représentations concurrentes des stages :

- le calendrier et les produits versionnés du catalogue, utilisés notamment par la landing page `/stages` ;
- les modèles Prisma `Stage`, `StageSession` et `StageReservation`, utilisés par les pages individuelles, les API et les tableaux de bord.

Le modèle historique représente correctement une offre simple, mais pas une édition composée de modules, variantes pédagogiques, cohortes, salles, capacités propres, séances et inscriptions multi-matières. L'étendre en changeant la signification de ses champs ferait courir un risque de réinterprétation des réservations historiques.

La Pré-rentrée 2026 exige en outre une création reproductible du planning socle, sans faire d'un fichier de seed une source opérationnelle concurrente de la base.

## Décision adoptée

L'architecture adoptée est :

1. **Catalogue et règles commerciales** : `data/pricing.canonical.json`, accessible uniquement par `lib/pricing.ts`, reste la source canonique des produits, prix, planchers, acomptes, arrondis et remises.
2. **Définition initiale de campagne** : un template versionné, typé et validé décrit la Pré-rentrée 2026. Il ne contient pas de données personnelles et n'est jamais lu par le frontend.
3. **Matérialisation** : une commande d'upsert transactionnelle et idempotente valide le template, calcule son checksum puis crée ou met à jour l'édition et son planning en base.
4. **Vérité opérationnelle** : après matérialisation, la base est l'unique autorité pour l'édition publiée, les modules actifs, variantes, cohortes, ressources, séances, demandes, inscriptions, paiements, présences, documents, communications et arbitrages.
5. **Composition publique** : un service serveur combine les données opérationnelles publiées, le catalogue commercial et le contenu éditorial typé. Les composants ne lisent aucune de ces sources directement.
6. **Historique** : les stages V1 gardent leur sens. La Pré-rentrée utilise un agrégat V2 distinct. Une édition métier ne peut exister simultanément en V1 et V2.
7. **Dérivation** : nombre de séances, volumes horaires, places, statuts de capacité, charges, total, acompte et solde sont calculés par des fonctions centrales. Les snapshots ne servent qu'à expliquer un engagement historique.

Les prix sont approuvés séparément par OWNER-003 mais restent non publiables avant validation financière. Cette décision ne valide ni le schéma physique futur, ni l'ouverture d'une cohorte.

## Options étudiées

### Option A — fichier versionné lu à l'exécution

Avantages : simple, diffable, facile à restaurer.

Inconvénients : incapable de porter proprement inscriptions et opérations ; risque de divergence avec les dashboards ; publication couplée au déploiement ; concurrence difficile. **Rejetée** comme vérité opérationnelle.

### Option B — configuration entièrement éditée en base

Avantages : administration dynamique et autorité unique après création.

Inconvénients : création manuelle risquée de 60 séances ; audit Git absent ; reproductibilité et revue métier faibles. **Rejetée** pour l'initialisation du planning socle.

### Option C — template versionné, upsert idempotent, base opérationnelle

Avantages : revue et reproductibilité avant publication ; transactions et contraintes en exploitation ; aucun accès frontend au template ; checksum explicable ; rollback applicatif possible.

Inconvénients : nécessite validation, commande d'import, versionnement et règles d'écart après matérialisation. **Option retenue**.

## Frontières architecturales

```text
template versionné --validation/checksum--> upsert transactionnel --> base opérationnelle
catalogue canonique ---------------------> service pricing ---------+
contenu éditorial typé -----------------> composition serveur -----+--> API/UI
base opérationnelle ------------------------------------------------+
```

- Le template peut initialiser la base, jamais servir une requête utilisateur.
- Le catalogue ne porte ni séance, ni enseignant, ni inscription.
- La base ne redéfinit pas silencieusement les règles commerciales du catalogue.
- Le contenu éditorial ne porte pas de capacité, de disponibilité ou de prix.
- Les dashboards et le public utilisent des DTO serveur issus des mêmes services de domaine.

## Agrégat V2 conceptuel

Le schéma exact fera l'objet d'une revue Prisma séparée. Les responsabilités nécessaires sont :

- `StageEdition` : identité, statut de publication, fuseau, fenêtre de dates, version et checksum ;
- `StageModule` : niveau, discipline publique, volume attendu et ordre d'affichage ;
- `PedagogicalVariant` : voie, EDS, option, règles de compatibilité ;
- `Cohort` et sa liaison aux variantes : groupe effectivement ouvert et capacité propre ;
- `Room`, `TeacherAssignment`, `CohortSession` : ressources et calendrier réels ;
- `Application`, `ApplicationChoice`, `Enrollment`, `WaitlistEntry` : demande, choix, admission et inscription ;
- `StudentGuardian` : relation plusieurs-à-plusieurs avec qualité et vérification ;
- `PriceQuote`, références de paiement/facture : engagement commercial explicable ;
- `Attendance`, documents, communications, arbitrages et événements d'audit.

Ces noms sont des concepts de domaine, pas une autorisation de modifier Prisma.

## Identité, autorisations et données personnelles

- Une demande publique existe avant tout compte utilisateur.
- Aucune liaison parent/élève n'est fondée sur un nom, un email ou un téléphone non vérifié seul.
- Un parent peut gérer plusieurs enfants ; un enfant peut avoir plusieurs responsables légaux.
- Les autorisations sont évaluées par ressource : relation légale, affectation de cohorte, rôle admin et académie.
- Un coach ne reçoit ni données financières ni données familiales non nécessaires.
- Les identifiants opaques ne remplacent pas un contrôle d'autorisation ; tous les accès sont testés contre l'IDOR.
- Logs, notifications et analytics excluent les données personnelles des mineurs et les payloads complets.

## Pricing et engagements financiers

- Le client ne fournit jamais un montant fiable.
- Le serveur résout le produit et recalcule total, acompte, remises, plancher et solde.
- Le devis accepté enregistre produit/version, règles appliquées et montants comme snapshot historique.
- Un snapshot n'est pas réinjecté dans le catalogue et n'est pas recalculé rétroactivement.
- `BusinessConfig` ne peut surcharger aucun prix, acompte, remise, date, horaire, durée, capacité, seuil, code produit ou règle académique Pré-rentrée. Tout conflit échoue explicitement ; seuls les flags et paramètres non contractuels allowlistés sont admis.
- Réservation, consommation de capacité et création de l'engagement financier doivent partager une frontière transactionnelle cohérente ; les effets externes utilisent une outbox idempotente.

## Règles d'idempotence et d'unicité

La conception physique devra garantir au minimum :

- une édition unique par académie et code métier ;
- une référence de template/version unique par édition ;
- un module unique par édition et code ;
- une séance unique par cohorte, date et ordre logique ;
- une inscription unique par élève et choix métier compatible ;
- une clé d'idempotence unique par opération sensible ;
- un événement de paiement externe traité une seule fois.

L'upsert entier s'exécute dans une transaction. Une seconde exécution avec le même template doit produire zéro création et zéro divergence. Un changement après publication requiert une nouvelle version et un journal de changement, jamais une mutation silencieuse.

## Gestion du temps

- `Africa/Tunis` est enregistré sur l'édition et obligatoire dans les services.
- Les instants opérationnels sont stockés de façon non ambiguë ; les heures locales sont construites avec une bibliothèque compatible IANA.
- Le navigateur ne choisit jamais le fuseau métier.
- Les dates inclusives, jours d'enseignement et week-ends sont dérivés et testés.

## Compatibilité V1/V2

- Aucun backfill ne transforme automatiquement un ancien stage en module ou cohorte V2.
- Les prix, volumes, statuts et libellés historiques restent lus depuis V1 ou leurs snapshots.
- Une lecture duale transitoire est admise uniquement pour une vue d'historique unifiée, avec DTO discriminé `legacy`/`edition` et date de suppression documentée.
- Les écritures duales sont interdites.
- Le format `intensif-renfort` demeure historique et ne code pas la Pré-rentrée 2026.

## Publication et comportement en erreur

La publication échoue de manière fermée si l'un des éléments suivants manque ou diverge :

- produit canonique validé ;
- checksum/version du template ;
- 12 modules socle et 60 séances cohérentes ;
- enseignant, salle, capacité et équipements requis ;
- absence de conflits ;
- règles pédagogiques et logistiques validées.

Le public n'affiche aucun ancien prix, ancienne date, capacité ou libellé de secours. Une donnée indisponible produit un état non publié ou temporairement indisponible, observable côté admin sans fuite côté client.

## Conséquences

### Positives

- une seule vérité par nature de donnée ;
- planning initial reproductible et exploitation transactionnelle ;
- historique V1 préservé ;
- mêmes règles pour API, frontend et dashboards ;
- déploiement et rollback découplés de la suppression des données.

### Coûts et risques

- nouveau domaine V2 et migration additive ;
- service de composition et contrats DTO à créer ;
- gouvernance des changements de template après publication ;
- résolution explicite du conflit avec `BusinessConfig` ;
- rattrapage nécessaire du modèle de responsables légaux et du flux de confirmation actuel.

## Migration et rollback

La séquence et les contrôles sont définis dans la [stratégie de migration](../specs/pre-rentree-2026-migration-strategy.md). En synthèse :

1. migration additive et drapeaux désactivés ;
2. backfill limité, idempotent et vérifié ;
3. matérialisation en brouillon ;
4. comparaison des invariants ;
5. activation progressive des API, dashboards puis public ;
6. rollback applicatif par feature flags ;
7. données V2 conservées pour audit, aucune suppression automatique ;
8. restauration de sauvegarde uniquement pour un incident de données confirmé.

## Entrées encore attendues avant publication

Les choix d'architecture et de métier sont enregistrés dans le registre owner. Restent des preuves ou données d'activation, pas des décisions implicites :

- coûts directs et marge cible ;
- CGV alignées sur remboursement/report ;
- enseignants, disponibilités, salles et équipements ;
- matrice pédagogique initiale approuvée ;
- conception physique V2 additive ;
- implémentation et tests des identités, capacités, paiements et autorisations ;
- politique de rétention ;
- campagne corrective et preview publique.

## Références

- [contrat détaillé des sources de vérité](../specs/pre-rentree-2026-source-of-truth-contract.md)
- [carte d'impact système](../specs/pre-rentree-2026-system-impact-map.md)
- [décisions métier](../specs/pre-rentree-2026-business-decisions.md)
- [ADR 004 — ressources et cohortes](./004-pre-rentree-modules-cohortes-seances-ressources.md)
- [matrice de tests](../specs/pre-rentree-2026-test-matrix.md)
- [décisions owner](../decisions/pre-rentree-2026-owner-approval.md)
- [gates d'activation](../specs/pre-rentree-2026-activation-gates.md)
- [audit de dérive de main](../audits/2026-07-pre-rentree-main-drift-audit.md)

## Rollback de la décision

Avant toute donnée opérationnelle, cette ADR peut être remplacée par une ADR ultérieure. Après création de données V2, une nouvelle décision peut changer les services de lecture ou le mécanisme de template, mais ne doit ni effacer l'audit, ni réinterpréter V1, ni convertir implicitement les snapshots historiques.
