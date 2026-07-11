# Pré-rentrée 2026 — template et matérialisation

## Source et frontière

- Emplacement futur : `data/stages/pre-rentree-2026.template.ts` ou JSON strict si le dépôt retient un générateur ; décision physique : données sérialisables, aucune fonction métier dans le template.
- Schéma : `lib/stages/v2/template-schema.ts`, Zod strict et versionné.
- Le template initialise une édition ; il n'est jamais lu par une page, un composant, une API publique ou un dashboard.
- Après `apply`, PostgreSQL est la source opérationnelle. Les changements utilisent les services et transitions V2, pas une relecture implicite du fichier.

Le chemin exact appartient au futur lot M4, mais l'ownership est : `data/stages/` déclaratif, `lib/stages/v2/` validation/commandes. Aucun contenu dans `BusinessConfig`, hormis les valeurs des trois feature flags référencés par leurs clés.

## Enveloppe versionnée

```ts
type PreRentreeTemplateV1 = {
  schemaVersion: "pre-rentree-template/v1";
  templateVersion: string;
  edition: {
    code: "PRE_RENTREE_2026";
    slug: "pre-rentree-2026";
    labelKey: string;
    timeZone: "Africa/Tunis";
    startDate: "2026-08-17";
    endDate: "2026-08-28";
    groupDecisionLocal: "2026-08-10T18:00:00";
    pricingCatalogVersion: string;
    featureFlagKeys: { public: string; api: string; dashboards: string };
  };
  blocks: Array<{ code: string; localStart: string; localEnd: string }>;
  site: { code: string; roomCodes: string[] };
  variants: VariantDefinition[];
  compatibilityRules: CompatibilityRuleDefinition[];
  modules: ModuleDefinition[];
  cohortReservations: CohortSeedDefinition[];
  sessions: SessionSeedDefinition[];
};
```

Les définitions utilisent uniquement des codes stables. Aucun `User.id`, `CoachProfile.id`, `PreRentreeRoom.id` ou identifiant de cohorte généré n'est codé dans le template. Les rôles logistiques « salle 1/salle 2 » et « enseignant Mathématiques–NSI » sont des exigences du plan, pas des ressources déclarées disponibles. Si aucun code d'inventaire réel approuvé ne peut être résolu à l'apply, `session.roomId`/`teacherId` restent nuls et la cohorte reste DRAFT/FORMING. L'affectation de ressources réelles intervient en DB avant confirmation ; le template ne crée jamais un coach ou une salle fictive.

## Validation Zod et sémantique

Le schéma strict refuse clés inconnues, dates/heures invalides, fuseau non IANA, doublons, capacité hors 3–5, durée non positive, module sans variante ou séance sans module. La validation sémantique vérifie ensuite :

- 3 niveaux × 4 matières = 12 modules ;
- 5 séances/module = 60 séances ;
- 120 minutes/séance, 600 minutes/module, 7 200 minutes-cours ;
- jours 17–21 et 24–28 août uniquement ; aucun 22/23 août ;
- planning canonique, deux salles max, charges enseignant/élève et pauses ;
- terminologie : aucune NSI EDS Seconde, aucun EAF Terminale, spécialités et option maths séparées ;
- règles de compatibilité par défaut incompatibles ;
- codes produit `PRE2026_PACK_1..4` présents dans la version catalogue déclarée, lus via le service pricing ;
- aucun montant dans le template.

## Checksum

1. Parser et valider l'objet.
2. Normaliser Unicode en NFC.
3. Construire une représentation canonique JSON RFC 8785/JCS : clés triées, nombres sûrs, aucune valeur `undefined`, aucun commentaire.
4. Ne pas trier les listes dont l'ordre est sémantique (`displayOrder`, séances) ; trier par code les ensembles explicitement non ordonnés avant JCS.
5. Encoder UTF-8 sans BOM.
6. Calculer SHA-256 hex minuscule sur les octets canoniques.

Le checksum enregistré est celui de l'objet complet validé, y compris versions de règles, mais hors métadonnées d'exécution (`runId`, auteur, date).

## Commandes futures

| Commande | Écriture | Résultat |
|---|---|---|
| `validate` | aucune | erreurs syntaxiques/sémantiques, checksum, calculs 12/60/120 h |
| `plan` | journal `PLANNED` optionnel seulement en mode admin explicite ; dry-run par défaut sans DB | créations/no-op/conflits/mutations incompatibles |
| `apply` | transaction unique de matérialisation | édition DRAFT, modules, variantes, cohortes réservées, séances, audit/outbox interne |
| `verify` | aucune donnée métier ; résultat de run | comparaison template attendu/DB matérialisée, invariants et checksum |
| `rollback` | logique uniquement | édition/cohortes DRAFT archivées si inutilisées ; jamais suppression d'engagement |

Ces commandes ne sont pas implémentées dans cette phase.

## Plan et idempotence

Clés naturelles d'upsert : édition `code`; module `(editionId,code)`; variante `code`; module-variante paire ; cohorte `(moduleId,code)`; séance `(cohortId,sessionNumber)`; règle `(rulesVersion,leftVariantId,rightVariantId)`.

`apply` :

1. créer un `PreRentreeMaterializationRun` avec `(editionCode,checksum,APPLY)` unique ;
2. acquérir un advisory lock PostgreSQL dérivé de `editionCode` ;
3. relire édition et usages dans une transaction `SERIALIZABLE` ;
4. édition absente : créer tout en DRAFT ;
5. même checksum : vérifier, créer uniquement les éléments manquants autorisés ; résultat final attendu `no-op` après premier succès ;
6. checksum différent et édition inutilisée/DRAFT : produire un plan, mais exiger `--accept-checksum <old>→<new>` et audit ;
7. checksum différent et proposition émise, inscription, paiement, présence ou publication : refuser `TEMPLATE_IMMUTABLE_AFTER_USE` ; une nouvelle version/édition est requise ;
8. commit atomique, puis statut run `APPLIED`; `verify` séparé passe à `VERIFIED`.

Un échec rollback la transaction métier ; le run peut être finalisé `FAILED` dans une transaction séparée avec un code d'erreur minimisé.

## Refus des mutations incompatibles

Après publication/usage, sont interdites : date/fuseau, module ou variante supprimés, séances déplacées par template, capacité réduite, codes changés, version catalogue réinterprétée. Une correction opérationnelle utilise `editionService`, `schedulingService` ou `cohortService` avec audit et communication ; le template original reste la provenance initiale.

## Rollback logique

Autorisé seulement si édition `DRAFT`, aucune proposition `ISSUED`, inscription, paiement, communication externe, présence ou document. Passer les éléments à `ARCHIVED`, run à `LOGICALLY_ROLLED_BACK`, conserver checksum et audit. Sinon : désactiver flags, dépublier, appliquer des transitions d'annulation explicites.

## Tests

Checksum stable entre environnements ; ordre de clés sans effet ; ordre de séances conservé ; deuxième apply zéro création ; apply concurrent unique ; checksum divergent refusé après usage ; transaction interrompue sans édition partielle ; dates/terminologie/prix invalides ; verify détectant ligne manquante ou modifiée ; rollback logique permis/interdit.
