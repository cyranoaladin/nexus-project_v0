# Pré-rentrée 2026 — argent et snapshots tarifaires

## Choix canonique : `Int` en millimes

Tous les montants V2 utilisent un entier signé Prisma `Int` représentant des millimes : `1 TND = 1 000 millimes`. `currency` vaut `TND`. `Float` est interdit.

| Option | Précision | Compatibilité | Coût/risque | Décision |
|---|---|---|---|---|
| `Int` millimes | exacte, ±2 147 483 647 millimes | identique à `Invoice`/`InvoiceItem` | plafond ≈2,1 M TND par champ, très supérieur aux packs | **retenu** |
| `BigInt` millimes | exacte, plafond massif | sérialisation JSON spéciale, factures `Int` | complexité sans bénéfice présent | rejeté |
| `Decimal` TND | exacte si échelle fixée | `Stage.priceAmount` utilise Decimal | conversion requise vers factures, risque échelle/arrondi | rejeté pour V2 |

Montants approuvés : 480 000, 900 000, 1 350 000 et 1 800 000 millimes. Acompte 30 % calculé par le getter pricing canonique selon `round(total TND × 30 % / 10) × 10`, soit actuellement 140 000, 270 000, 410 000 et 540 000 millimes ; ces résultats restent des cas de test dérivés, jamais des constantes du template ou du frontend.

## Adaptateurs V1

- `Stage.priceAmount Decimal(10,2)` : lecture historique vers DTO legacy, jamais source V2.
- `StageReservation.price`, `Payment.amount`, `ClicToPayTransaction.amount` en `Float` : aucun cast implicite. L'adaptateur accepte une chaîne décimale validée du fournisseur/catalogue, multiplie par 1 000 et exige un entier exact selon la règle canonique.
- `Invoice` et `InvoiceItem` : passage direct d'entiers millimes après vérification `currency=TND`.
- Toute conversion fournit `{sourceUnit,targetUnit,roundingRule,input,output}` à l'audit technique sans PII.

## Source tarifaire et calcul

`data/pricing.canonical.json` reste la source commerciale ; seul `lib/pricing.ts` et ses services serveur lisent le catalogue. Le client envoie codes produit/modules, jamais un prix fiable. Le serveur :

1. charge une version identifiable du catalogue ;
2. choisit `PRE2026_PACK_1..4` selon le nombre de modules validés ;
3. applique règles de remise non cumulables/plancher ;
4. calcule total, acompte, solde avec le getter/règle d'arrondi unique ;
5. construit et checksum le snapshot ;
6. compare toute valeur client uniquement à titre d'affichage/diagnostic, sans la persister comme montant contractuel.

## Snapshot immuable de proposition

Champs explicites :

- `productCode`, `catalogVersion`, `currency` ;
- `totalMillimes`, `depositMillimes`, `balanceMillimes` ;
- `roundingRuleCode`, `subjectCount`, `totalDurationMinutes` ;
- items `{moduleId,moduleCode,variantId,variantCode,durationMinutes}` ;
- `termsVersion`, `refundPolicyVersion` ;
- remises : codes, montants/règles, non-cumulabilité, plancher et justification ;
- dérogation éventuelle : permission, motif, auteur dans audit, jamais seulement un champ libre ;
- `calculatedAt`, `snapshotPayload`, `snapshotChecksum`.

Invariant : `totalMillimes = depositMillimes + balanceMillimes`, montants ≥0, `subjectCount` 1..4, items cohérents. Les soldes dérivés actuels sont 340 000, 630 000, 940 000 et 1 260 000 millimes. Un changement futur de règle produit un nouveau `roundingRuleCode`/snapshot et ne réinterprète aucun contrat.

Le snapshot utilise la même canonicalisation JCS/SHA-256 que le template. Après `ISSUED`, aucune modification. Une nouvelle offre crée une nouvelle proposition ; l'ancienne est annulée/expirée et conservée.

## Engagement contractuel

L'inscription référence exactement une proposition `ACCEPTED` et conserve `contractChecksum`, versions CGV et remboursement acceptées. La proposition est le snapshot commercial de l'engagement ; elle n'est jamais consultée pour tarifer une future inscription. Une facture est générée depuis ce snapshot, puis devient son propre document légal historique.

## Paiement et solde

- `PreRentreePayment.expectedMillimes` provient du snapshot ; `receivedMillimes` provient du fournisseur réconcilié.
- Paiement net = somme paiements `SUCCEEDED` − somme remboursements `SUCCEEDED`.
- Solde restant = `totalMillimes − paiement net`, dérivé, borné pour signaler surpaiement.
- Preuve de paiement liée au paiement et à l'inscription, jamais à une adresse email.
- Statut navigateur ignoré ; webhook signé ou réconciliation financière nécessaire.

## Remboursements

Le montant cumulé réussi ne dépasse jamais le paiement réussi correspondant. Sous seuil de trois, remboursement intégral par défaut ; report uniquement sur accord écrit et audité. Le remboursement partiel n'est permis que si la `refundPolicyVersion` l'autorise pour le motif donné ; sinon `REFUND_AMOUNT_POLICY_VIOLATION`.

Le délai recommandé de cinq jours ouvrés reste `APPROVED_PENDING_LEGAL_TEXT_ALIGNMENT`. Les durées légales/opérationnelles non alignées ne sont pas inventées.

## Erreurs fail-closed

| Situation | Résultat |
|---|---|
| produit/version absent | `PRICING_CATALOG_ENTRY_MISSING`, aucune proposition |
| devise autre que TND | `UNSUPPORTED_CURRENCY` |
| conversion non entière | `MONEY_UNIT_CONVERSION_ERROR` |
| total ≠ acompte + solde | `PRICING_INVARIANT_VIOLATION` |
| checksum divergent | `SNAPSHOT_INTEGRITY_ERROR` |
| montant fournisseur différent | `RECONCILIATION_REQUIRED`, aucune place confirmée |
| prix client différent | ignorer le prix ; retourner calcul serveur et audit anti-fraude si pertinent |

## Tests

1–4 matières, plancher, règle d'arrondi, remises non cumulables, overflow/valeurs négatives, conversion Decimal/Float explicitement contrôlée, facture égale au snapshot, webhook dupliqué, sous/surpaiement, remboursement total/partiel, checksum, mutation snapshot interdite, catalogue courant modifié sans effet sur contrat passé.
