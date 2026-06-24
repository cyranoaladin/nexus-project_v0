# Lot 1 marque - correctifs P1.9 a P2.13

## Date

24 juin 2026

## Contexte

Correctifs demandes sur la branche `fix/lot-1-marque` avant merge de la PR #49. Perimetre initial P1.9, P1.10, P2.9, P2.10, P2.11 et P2.12, puis extension P1.11, P1.12 et P2.13 apres validation locale sans CI GitHub.

## Problemes observes

- Plusieurs liens internes pointaient vers des ancres inexistantes (`#accompagnement-annuel`, `#candidats-libres`, `#plateforme`, `#les-intensifs`).
- Les composants clients marketing charges uniquement d'afficher les regles d'effectif importaient `getRules()`.
- Plusieurs surfaces paiement/CGV reutilisaient encore des libelles ClicToPay/Banque hors `lib/cgv-policy`.
- La garde anti-fabrication ne couvrait pas encore tout `content/` ni `lib/`.
- Deux anciens fichiers image de gammes n'etaient plus references.
- `LegalAcceptance` re-exportait `CGV_VERSION`, et `CGV_POLICY.refunds.request` n'etait pas auto-portant.
- `group_min_open.brevet` etait lu a plusieurs endroits alors que la cle canonique est `college`.
- L'id catalogue `boussole-methode` devait rester un slug ASCII sur toutes les references.
- Les coordonnees bancaires etaient dupliquees entre generation de facture et email transactionnel.

## Decisions prises

- Les ancres publiques d'offres sont centralisees sur `section-annual`, `section-libre`, `section-plateforme`, `section-intensifs`.
- Une garde `link-integrity` verifie les ancres internes litterales et les IDs rendus depuis le catalogue canonique.
- `GROUP_RULES` expose une constante client legere, verifiee par equivalence avec `getRules()`.
- Les surfaces legales, facturation et tests admin consomment `CGV_POLICY`.
- Les routes API ClicToPay restent hors migration UI : ce sont des routes d'integration techniques.
- Les seuils Brevet lisent `group_min_open.college`; une garde interdit `group_min_open.brevet` et le rendu `undefined`.
- Les IDs catalogue sont verrouilles par une garde `^[a-z0-9-]+$`.
- Le RIB/IBAN/BIC est centralise dans `LEGAL.billing`; les surfaces publiques n'exposent pas ces coordonnees.

## Fichiers modifies

- `app/offres/page.tsx`
- `components/ui/floating-nav.tsx`
- `components/ui/diagnostic-form.tsx`
- `app/HomePageClient.tsx`
- `app/equipe/page.tsx`
- `components/marketing/acadomia-inspired.tsx`
- `components/premium/MethodSection.tsx`
- `lib/group-rules.ts`
- `lib/legal.ts`
- `lib/cgv-policy.ts`
- `lib/email.ts`
- `components/facturation/NexusInvoiceGenerator.tsx`
- `app/dashboard/parent/paiement/page.tsx`
- `app/conditions-generales/page.tsx`
- `data/pricing.canonical.json`
- surfaces CGV/facturation/admin concernees
- gardes et tests Jest associes
- specs Playwright prix/bulle corrigees pour le modele canonique

## Tests executes

- `npm run lint`
- `npm run typecheck`
- `npm run test -- --runInBand`
- `npm run build`
- `npm run test:e2e`
- `npm run check:docs-archive`
- `git diff --check`
- Preuve SSR standalone sur `localhost:3010`

## Resultats

- Jest complet : 497 suites passees, 1 skipped ; 6275 tests passes, 4 skipped.
- Build Next.js : compilation et generation statique OK.
- Playwright public complet : 184 tests passes.
- Lint : exit 0 avec warnings preexistants.
- Typecheck : exit 0.
- Garde docs archive : OK.
- `git diff --check` : OK.
- SSR standalone : `/`, `/offres`, `/famille`, `/bilan-gratuit`, `/contact`, `/conditions-generales`, les 4 landings SEO en 200, H1 unique, `visible_undefined=False`.
- `/offres` : ancres `section-annual`, `section-libre`, `section-plateforme`, `section-intensifs` presentes.

## Risques restants

- Des usages clients plus larges de `getRules()` existent encore dans des surfaces qui consomment le catalogue complet (`/offres`, dialogue d'offre). Ils n'ont pas ete changes dans ce lot.
- La CI GitHub est indisponible durablement pour raison de facturation ; le signal de validation est le gate local documente ici.

## Rollback

Revert du commit de ce lot sur `fix/lot-1-marque`, puis relancer `npm run test -- --runInBand`, `npm run build` et `npm run test:e2e`.
