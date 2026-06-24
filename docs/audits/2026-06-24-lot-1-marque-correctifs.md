# Lot 1 marque - correctifs P1.9 a P2.12

## Date

24 juin 2026

## Contexte

Correctifs demandes sur la branche `fix/lot-1-marque` avant de marquer la PR #49 comme prete. Perimetre limite aux points P1.9, P1.10, P2.9, P2.10, P2.11 et P2.12.

## Problemes observes

- Plusieurs liens internes pointaient vers des ancres inexistantes (`#accompagnement-annuel`, `#candidats-libres`, `#plateforme`, `#les-intensifs`).
- Les composants clients marketing charges uniquement d'afficher les regles d'effectif importaient `getRules()`.
- Plusieurs surfaces paiement/CGV reutilisaient encore des libelles ClicToPay/Banque hors `lib/cgv-policy`.
- La garde anti-fabrication ne couvrait pas encore tout `content/` ni `lib/`.
- Deux anciens fichiers image de gammes n'etaient plus references.
- `LegalAcceptance` re-exportait `CGV_VERSION`, et `CGV_POLICY.refunds.request` n'etait pas auto-portant.

## Decisions prises

- Les ancres publiques d'offres sont centralisees sur `section-annual`, `section-libre`, `section-plateforme`, `section-intensifs`.
- Une garde `link-integrity` verifie les ancres internes litterales et les IDs rendus depuis le catalogue canonique.
- `GROUP_RULES` expose une constante client legere, verifiee par equivalence avec `getRules()`.
- Les surfaces legales, facturation et tests admin consomment `CGV_POLICY`.
- Les routes API ClicToPay restent hors migration UI : ce sont des routes d'integration techniques.

## Fichiers modifies

- `app/offres/page.tsx`
- `components/ui/floating-nav.tsx`
- `components/ui/diagnostic-form.tsx`
- `app/HomePageClient.tsx`
- `app/equipe/page.tsx`
- `components/marketing/acadomia-inspired.tsx`
- `components/premium/MethodSection.tsx`
- `lib/group-rules.ts`
- `lib/cgv-policy.ts`
- surfaces CGV/facturation/admin concernees
- gardes et tests Jest associes

## Tests executes

- `npm run lint`
- `npm run typecheck`
- `npm run test -- --runInBand`
- `npm run build`
- `npm run check:docs-archive`
- `git diff --check`

## Resultats

- Jest complet : 495 suites passees, 1 skipped ; 6270 tests passes, 4 skipped.
- Build Next.js : compilation et generation statique OK.
- Lint : exit 0 avec warnings preexistants.
- Garde docs archive : OK.

## Risques restants

- Des usages clients plus larges de `getRules()` existent encore dans des surfaces qui consomment le catalogue complet (`/offres`, dialogue d'offre). Ils n'ont pas ete changes dans ce lot.
- La CI GitHub reste dependante du deblocage proprietaire deja documente.

## Rollback

Revert du commit de ce lot sur `fix/lot-1-marque`, puis relancer `npm run test -- --runInBand` et `npm run build`.
