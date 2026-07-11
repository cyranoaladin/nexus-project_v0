# ADR 006 — modèle physique additif Pré-rentrée V2

## Statut

Proposé pour implémentation après validation du plan de migration. Date : 11 juillet 2026.

## Contexte

Le domaine Stage V1 confond campagne, capacité et réservation, utilise des statuts et unités monétaires historiques et suppose un parent principal. OWNER-017/018 imposent template versionné, DB opérationnelle, snapshots immuables, V1 historique et V2 additive.

## Décision

1. Créer des modèles `PreRentree*` séparant édition, module, variante/règle, cohorte, séance/ressource, demande, proposition, inscription, affectation/hold/waitlist, paiement/remboursement, présence/bilan, identité, arbitrage, communication/outbox/audit.
2. Référencer sans dupliquer les identités `User`, `Student`, `ParentProfile`, `CoachProfile`; réutiliser `Invoice` et `UserDocument` par liens explicites.
3. Ne jamais écrire simultanément V1/V2, migrer ou recalculer les anciens stages.
4. Utiliser `String/cuid`, codes métier/slugs distincts, archivage logique, FK `Restrict/SetNull`.
5. Persister dates civiles en `date`, instants en UTC `timestamptz`, zone IANA sur édition.
6. Utiliser `Int` millimes/TND pour tout argent V2 et snapshots immuables.
7. Utiliser une table versionnée de variantes/règles, pas un enum académique fermé.
8. Exposer uniquement des DTO discriminés `LEGACY_STAGE|EDITION_V2`.

Schéma détaillé : [physical-schema-v2](../specs/pre-rentree-2026-physical-schema-v2.md).

## Options rejetées

- Étendre/réinterpréter `Stage` : risque de régression historique et surcharge sémantique.
- Dupliquer les profils coach/élève : double identité et divergence.
- Tout stocker en JSON : contraintes, FKs, requêtes et audit insuffisants.
- Enum unique de variantes : évolution académique coûteuse et règles impossibles à versionner.
- `Float` ou `BigInt` pour argent : imprécision pour le premier, complexité inutile pour le second.

## Conséquences

Positives : agrégats/états explicites, historique intact, autorisation relationnelle, argent exact, migrations additives. Coûts : davantage de tables/services, SQL manuel pour checks/exclusions/partiels et query services V1/V2.

## Invariants

12 modules/60 séances socle ; capacité par cohorte ; relation responsable active/vérifiée ; snapshot immuable ; aucune lecture template par frontend ; aucune cascade destructive ; aucune finance coach/élève.

## Migration et rollback

Lots M0–M10 de [la stratégie additive](../specs/pre-rentree-2026-additive-migration-plan.md). Flags off par défaut ; rollback applicatif et archivage logique, aucune suppression de tables avec données.
