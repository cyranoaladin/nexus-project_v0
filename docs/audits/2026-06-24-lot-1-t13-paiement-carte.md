# Lot 1 T1.3 - Paiement carte au point de conversion

## Date

2026-06-24

## Contexte

Les mentions legales et les CGV exposent deja la politique de paiement carte via ClicToPay / Banque Zitouna, mais cette information n'etait pas visible dans les points de conversion publics. Le lot T1.3 vise a rendre ce moyen de paiement visible sans creer de nouveau flux transactionnel et sans exposer de RIB/IBAN sur les surfaces marketing.

## Problemes observes

- `/offres` ne signalait pas le paiement par carte avant la demande de bilan.
- Le detail d'offre ne rappelait pas les moyens de paiement.
- `/bilan-gratuit?offer=...` affichait l'offre reperee sans la politique carte associee.

## Decisions prises

- Creer un composant reutilisable `PaymentMethodsNote` alimente par `CGV_POLICY.payment`.
- Afficher ClicToPay / Banque Zitouna, cartes acceptees, absence de frais carte et securisation CVV2 + 3D Secure.
- Ne pas afficher de RIB ni d'IBAN sur les surfaces publiques.
- Ne pas brancher de nouveau paiement en ligne : l'integration ClicToPay reste un sujet operationnel distinct du surfacage marketing.

## Fichiers modifies

- `components/marketing/PaymentMethodsNote.tsx`
- `app/offres/page.tsx`
- `components/marketing/OfferDetailDialog.tsx`
- `app/bilan-gratuit/BilanStrategiqueClient.tsx`
- `__tests__/components/offres-page.test.tsx`
- `__tests__/components/offer-detail-dialog.test.tsx`
- `__tests__/lib/bilan-gratuit-form.test.tsx`
- `e2e/pages-public-offres.spec.ts`

## Tests executes

- `npm run test -- --runInBand __tests__/components/offres-page.test.tsx __tests__/components/offer-detail-dialog.test.tsx __tests__/lib/bilan-gratuit-form.test.tsx`
- `npm run test:e2e -- e2e/pages-public-offres.spec.ts`

## Resultats

- Les tests ciblés Jest passent et prouvent l'affichage ClicToPay sans RIB/IBAN rendu.
- Le spec Playwright `/offres` passe et prouve la visibilite publique de ClicToPay sans RIB/IBAN dans le texte de page.

## Risques restants

- Ce lot ne valide pas la disponibilite technique du terminal ClicToPay ni le parcours transactionnel parent.
- Le paiement par virement reste autorise sur les surfaces non publiques quand le contexte metier le requiert.

## Rollback

- Retirer les rendus `PaymentMethodsNote` des trois points de conversion et supprimer le composant.
