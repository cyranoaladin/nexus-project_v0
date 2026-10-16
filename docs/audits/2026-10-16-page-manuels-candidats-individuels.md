# Page publique des manuels pour candidats individuels

## Date

2026-10-16

## Contexte

Le propriétaire demande une page où un visiteur choisit ses manuels, voit le
prix et la remise de lot, retient un format (PDF, PDF + papier noir et blanc,
PDF + papier couleur), saisit ses coordonnées et une adresse de livraison, ou
choisit de retirer au centre Nexus.

La page reprend le simulateur produit par la Maison édition Nexus Réussite
(`~/Documents/Nexus_Edition/work/offre/SIMULATEUR_PRIX_20261015.html`), **adapté
au frontend public, sans aucune note interne**.

Le barème appliqué est le **barème v2**, adopté par le propriétaire le
2026-10-15.

## Décisions prises

Trois décisions ont été arbitrées par le propriétaire avant toute écriture :

| question | décision |
|---|---|
| statut de la page | **pré-commande, hors index** — aucune vente ferme tant que le catalogue n'est pas livrable |
| destination d'une commande | **fiche de contact + e-mail**, pas de table dédiée, donc pas de migration |
| livraison | **offerte**, aucun frais affiché ni ajouté |

Décisions techniques qui en découlent :

- **Une seule source de prix.** Le catalogue et le barème sont ajoutés à
  `data/pricing.canonical.json` sous la clé `manuels`, conformément à
  `AGENTS.md` §6. Aucun prix n'est écrit en dur dans un composant.
- **Le bloc `manuels` est engendré**, jamais saisi : `work/offre/exporter_manuels.py`
  lit les `MANIFEST.json` de la zone de publication et les taux de `prix_v2.py`.
  L'insertion dans le socle canonique est textuelle et porte sur la seule clé
  `manuels`, maintenue en dernière position : le fichier est formaté à la main
  et une réécriture complète brasserait des centaines de lignes étrangères à la
  mission.
- **Les identifiants publics sont des limaces URL-sûres** (`pc-t`,
  `maths-eds-1re-eleve`). Le garde-fou T1b du dépôt impose `/^[a-z0-9-]+$/` à
  toute clé `id`. L'identifiant de paquet de publication (`PC/T`) est conservé
  à côté, sous `volumeId`, pour que la trace ne se perde pas.
- **Le prix est recalculé côté serveur.** `/api/manuels/commande` ne lit aucun
  montant venu du navigateur : un total envoyé par le client serait un prix
  choisi par le client.
- **Une sélection partiellement comprise est refusée**, jamais rabotée : un
  identifiant inconnu renvoie `unknown_volume` plutôt qu'un panier amputé.

## Ce qui a été retiré du simulateur interne

Le simulateur est un document de travail. N'ont pas été repris :

- les postes de coût (clic couleur et noir et blanc, location mensuelle,
  feuille, carte de couverture, façonnage par tranche d'épaisseur) ;
- le contrat et le nom de l'imprimeur ;
- les marges, le coût variable par page, le seuil de couverture du loyer ;
- la courbe de coût et les colonnes de coût des tables ;
- les statuts « déclaré / supposé / à trancher » ;
- les réserves de production : absence de BAT, nombre de volumes à source
  d'impression déclarée, absence de licence filigranée, volumes non reliables
  en thermocollé, paquets de publication manquants ;
- la mention « document de travail interne ».

Un test le vérifie à chaque exécution : `__tests__/components/manuels-page.test.tsx`
échoue si l'un de ces termes réapparaît dans le rendu de la page.

## Ce qui a été gardé, parce que c'est dû au visiteur

- le périmètre réel du catalogue : la maison ne publie ni le français et son
  épreuve anticipée, ni les langues vivantes, ni l'EPS, ni le Grand oral, ni
  les options — **une sélection ne constitue pas une préparation complète au
  baccalauréat** ;
- le statut de pré-commande et le fait que la disponibilité, le délai et le
  règlement sont confirmés avant toute fabrication ;
- le PDF compris dans les deux formules papier ;
- les annexes de douze pages et moins, offertes en PDF.

## Fichiers

Créés :

- `app/manuels/page.tsx`, `app/manuels/layout.tsx`, `app/manuels/_components/ManuelsShop.tsx`
- `app/api/manuels/commande/route.ts`
- `lib/manuels/pricing.ts`, `lib/manuels/order.ts`, `lib/manuels/catalogue-client.ts`
- `data/manuels-client.generated.json` (engendré)
- `__tests__/lib/manuels-catalogue.test.ts`, `__tests__/lib/manuels-client-sync.test.ts`,
  `__tests__/lib/manuels-pricing.test.ts`, `__tests__/lib/fixtures/manuels-prix-reference.json`,
  `__tests__/api/manuels.commande.route.test.ts`, `__tests__/components/manuels-page.test.tsx`

Modifiés :

- `data/pricing.canonical.json` — ajout de la clé `manuels` en fin de fichier
- `lib/pricing.ts` — types et accesseurs du catalogue
- `scripts/generate-pricing-client-data.js` — engendre le fichier client des manuels
- `lib/rate-limit/sensitive.ts` — portée `manuels-order`
- `lib/crm/contact-leads.ts` — `getLeadNotificationRecipient` exporté, pour ne pas
  redéfinir le destinataire interne
- `lib/email/templates.ts` — deux gabarits de pré-commande
- `__tests__/lib/pricing-canonical-validator.test.ts` — `family` ajouté aux clés
  techniques du garde-fou T12 (discriminant kebab-case, jamais affiché)

Hors dépôt, côté Maison édition :

- `work/offre/exporter_manuels.py` — engendre le bloc `manuels`
- `work/offre/exporter_banc_essai.py` — engendre le banc d'essai de référence

## Mobile d'abord

Le téléphone est l'outil de commande principal. La page est construite pour lui,
et le grand écran en est l'élargissement, pas l'inverse.

- **Le devis est épinglé en bas de l'écran** (`fixed inset-x-0 bottom-0`), et
  redevient une colonne collante au-delà de `lg`. C'est un seul élément, deux
  mises en page : le total et l'action ne sont jamais rendus deux fois.
- **La zone sûre est respectée** : `pb-[max(0.75rem,env(safe-area-inset-bottom))]`,
  pour les téléphones à encoche. Le formulaire et la page réservent la hauteur
  de la barre afin que rien ne reste dessous.
- **Aucune impasse.** L'action principale porte l'étape suivante : « Choisissez
  vos volumes » (inactive, mais elle dit quoi faire), puis « Compléter » — qui
  fait défiler et met le curseur sur le premier champ manquant —, puis « Envoyer
  ma demande ». Ce qui manque est énoncé sous le bouton, jamais deviné.
- **Les claviers s'ouvrent bons** : `type`/`inputMode`/`autoComplete` sur le nom,
  l'e-mail, le téléphone, l'adresse et la ville ; `enterKeyHint` sur chaque
  champ ; `text-base` pour éviter le zoom automatique d'iOS ; cibles tactiles à
  48–52 px.
- **Le détail du devis se replie** sur mobile et reste déployé sur grand écran.

## Les couvertures

30 couvertures approuvées en service sur 37 manifestes. Les 11 volumes sans
couverture sont les 7 annexes de rôle C — qui portent une page d'identification,
pas une couverture commerciale — et les 4 volumes de mathématiques sans paquet
de publication. Ils reçoivent une vignette typographique à la charte, pas un
visuel cassé : un test vérifie cette partition, volume par volume.

`scripts/manuels/build-covers.mjs` :

- ne fait que **lire** les PDF d'origine, et **vérifie l'empreinte sha256** de
  chacun contre celle que porte son `MANIFEST.json` — une couverture qui ne
  concorde pas est refusée, jamais publiée en silence ;
- ne retient que le statut `APPROUVEE_EN_SERVICE` ;
- prend les identifiants dans le socle canonique plutôt que de les recalculer,
  pour qu'un visuel ne puisse pas porter une limace que le catalogue ignore ;
- produit deux largeurs de carte (220 et 440) et une d'agrandissement (560),
  plus un aperçu de 16 px en ligne.

`next.config.mjs` porte `images: { unoptimized: true }` : Next ne redimensionne
rien à la volée, les tailles sont donc produites à la fabrication et la page
sert un `srcset`.

Mesures : **4,4 Mo sur disque** pour 30 couvertures recto et verso ; carte
**14,8 Ko** en 1x et **43,4 Ko** en 2x en moyenne ; agrandissement 60 Ko au
recto, 33 Ko au verso ; fiche embarquée dans le navigateur **20,2 Ko**. Deux
tests plafonnent ces poids (80 Ko par carte, 140 Ko par agrandissement) : une
régénération plus lourde échouera.

## Tests exécutés

```bash
npm run test -- --runInBand     # 917 suites
npm run typecheck
npx next lint --max-warnings 300 --file <chaque fichier du périmètre>
npm run build
```

## Résultats

| vérification | résultat |
|---|---|
| suites de la mission | **10 suites, 359 tests, toutes au vert** |
| dont banc d'essai du barème | **186 paniers × 3 formats = 558 prix, zéro écart** avec `prix_v2.py` |
| lint du périmètre | **propre** |
| types du périmètre | **aucune erreur** |
| types du dépôt | 253 erreurs, **le même nombre qu'avant la mission**, toutes dans `lib/quotes/*`, `lib/exams/*` et leurs tests |
| `npm run build` | **compilation réussie** ; le contrôle de types s'arrête ensuite sur une erreur préexistante (voir ci-dessous) |
| suite complète | 40 suites en échec, **aucune de la mission** |

Trois garde-fous du dépôt ont été cassés puis réparés en cours de route — la
suite complète les a révélés, les tests isolés ne les voyaient pas :

1. `rate-limit.s3-final-contract` : la liste des portées est exhaustive, la
   nouvelle y est désormais déclarée.
2. `pricing-client-sync` : un composant « use client » tirait `lib/pricing` dans
   le paquet du navigateur, même en import de type. Les types des manuels ont
   été déplacés dans `lib/manuels/types.ts`.
3. `public-lux-charte-guard` : toute page publique doit être classée ; la
   nouvelle page et son îlot le sont.

## Risques restants

- **`npm run build` ne va pas au bout**, pour une cause étrangère à la mission :
  l'arbre de travail (143 fichiers modifiés, chantier d'un autre agent) a
  **supprimé la portée `candidat-individuel-staff`** de
  `lib/rate-limit/sensitive.ts`, alors que trois routes l'appellent encore.
  `git diff` sur ce fichier montre 4 insertions (la mission) et 7 suppressions
  (le chantier). Rétablir cette portée est une ligne, mais relève de ce
  chantier, pas de celui-ci.
- Les 253 erreurs de types et les 40 suites en échec préexistantes ne sont pas
  traitées ici.
- La page reste **hors index** et en pré-commande : aucun volume n'est annoncé
  disponible, la licence nominative filigranée n'existe pas, et aucun des
  volumes ne porte de BAT.
- Les cinq règles commerciales non arbitrées (plafond de parcours, inclusion des
  PDF dans les forfaits, crédit d'inscription, trio −15 %) ne sont pas
  implémentées : la page applique le barème seul.
- Publier les visuels de couverture dans `public/` les diffuse sur Internet et
  les fait entrer dans le dépôt Git. Les originaux ne sont pas touchés.

---

## Mise à jour — finalisation (2026-10-16, second passage)

Sur autorisation explicite du propriétaire, la page est menée à l'état
livrable : professionnelle, pratique, fonctionnelle, utilisable au téléphone.

### Acheter un lot sans friction

- **Une discipline se prend d'un geste** : « Tout prendre » / « Tout retirer »
  dans l'en-tête de chaque discipline dépliée. C'est le geste même que la page
  doit servir, puisque la remise naît du lot.
- **Un volume se retire depuis le devis**, sans remonter le chercher dans le
  catalogue.
- **Reprise après envoi** : « Faire une autre demande » remet la sélection, les
  coordonnées et le format à zéro.

### Accessibilité et robustesse

- Le total est dans une région `aria-live="polite"` : un lecteur d'écran annonce
  le changement de prix au lieu de le taire.
- La case à cocher d'une carte est masquée visuellement, pas fonctionnellement :
  la carte porte un anneau de focus (`peer-focus-visible`), donc la navigation
  au clavier reste lisible.
- Le défilement vers un champ manquant respecte
  `prefers-reduced-motion: reduce`, et l'appel à `scrollIntoView` est défensif.
- **Un refus du serveur s'affiche sur la page** (`role="alert"`), pas seulement
  dans une bulle qui disparaît — sur mobile, une bulle manquée est une commande
  perdue.

### Déblocage du build

La portée `candidat-individuel-staff`, supprimée par le chantier en cours de
l'arbre de travail alors que trois routes l'appellent, a été **rétablie à
l'identique de son état au dernier commit**, sur autorisation du propriétaire.
Erreurs de types : **253 → 251**.

`npm run build` ne passe toujours pas : **251 erreurs de types préexistantes**
subsistent dans `lib/quotes/*`, `lib/exams/*` et leurs tests. Les reprendre
serait s'emparer d'un chantier voisin. La preuve de fonctionnement a donc été
faite autrement.

### Vérification fonctionnelle réelle

Serveur de développement lancé localement (port 3999, racine de stockage NPC
fournie hors du dépôt le temps du lancement, retirée ensuite), puis page
réellement demandée :

| contrôle sur le HTML servi | résultat |
|---|---|
| `GET /manuels` | **HTTP 200**, 105 672 octets |
| `<h1>` | « Vos manuels du baccalauréat, au volume ou en lot » |
| `noindex`, `viewport` | présents |
| pré-commande, « préparation complète » | présents |
| barre de devis, total, action, zone sûre iPhone | présents |
| couvertures rendues | 4 images (les deux disciplines dépliées d'entrée) |
| `srcset` deux largeurs, `loading="lazy"`, dimensions | sur chacune |
| notes internes | **aucune** |
| `GET /manuels/couvertures/pc-t-recto-440.webp` | **HTTP 200**, `image/webp`, 48 216 octets |

`POST /api/manuels/commande` répond **503 `RATE_LIMIT_BACKEND_UNAVAILABLE`** en
local : le service de limitation n'est pas disponible sur cette machine et la
route échoue **fermée**, comme prévu. `POST /api/contact`, déjà en production,
répond exactement la même chose dans le même environnement : c'est
l'environnement, pas la route. La validation et le chiffrage sont couverts par
les tests unitaires, limiteur simulé.

### Résultats du second passage

- **10 suites, 364 tests** au vert sur le périmètre.
- Lint **propre** sur les dix fichiers touchés.
- Types : **aucune erreur** dans le périmètre.

---

## Mise à jour — lot de livraison

### Pourquoi le build ne passait pas, et où il passe

L'arbre de travail du dépôt portait, à l'arrivée de cette mission, **143 fichiers
modifiés non commités** appartenant à un autre chantier. Ce chantier a retiré de
`prisma/schema.prisma` **onze modèles et énumérations** — `ProfilCandidat`,
`PlanningStudioDocument`, `PlanningStudioRevision`, `ShadowComparisonLog`,
`CandidateLevel`, `Modalite`, `ParcoursType`, `BrancheBascule`,
`PlanningStudioAction`, `QuotePaymentPolicy`, `QuoteRegulatoryMaturity` — sans
retirer le code qui les utilise. De là les 251 erreurs de types.

Mesure décisive : un arbre de travail monté sur le dernier commit
(`9267a6853`), avec son propre client Prisma, donne **zéro erreur de type**. Le
dépôt est sain ; c'est le chantier en cours qui ne l'est pas. Trancher s'il faut
rétablir ces modèles ou retirer le code qui les consomme appartient à ce
chantier, pas à celui-ci.

La mission a donc été portée sur cet arbre propre et vérifiée là, puisque c'est
une branche issue du dernier commit — et non l'arbre de travail — qui se
déploie.

### Retrait d'UTICA et de « Back to School »

**56 fichiers retirés** : `app/demo/utica-2026/`, `components/demo/utica-2026/`,
`lib/demo/utica-2026/`, `__tests__/demo/utica-2026/`, `docs/demo/`,
`components/marketing/UticaBackToSchoolBanner.tsx`, `scripts/demo-utica-start.sh`.
Entrées de garde-fous nettoyées en conséquence : charte lux, garde d'adressage,
cartographie du site. **Zéro occurrence restante** dans `app`, `components`,
`lib`, `scripts`, `__tests__`, `docs`, `data`, `content`, `e2e`, `prisma`.

Au dernier commit, la bannière était **branchée sur l'accueil**, juste au-dessus
du héros, et portait le dégagement sous la barre de navigation fixe.

**Réserve, à traiter hors de ce lot.** Deux relevés d'audit non suivis
(`docs/convergence/DOMAIN_OTHERS.md`, `DOMAIN_CANDIDAT.md`) gardent trace
d'UTICA. Ils n'ont pas été modifiés : l'un d'eux est précisément la pièce qui
établit que **la bannière est encore affichée en production**. Retirer le
composant du dépôt ne la retire pas du site en ligne.

### Appel d'accueil vers les manuels

`components/marketing/ManuelsBanner.tsx` prend l'emplacement d'en-tête libéré,
et reprend donc le dégagement sous la barre fixe — sans quoi le héros passerait
dessous. Un commutateur `asHeader` permet de la poser sous une autre bannière
sans doubler cet espace : c'est le cas dans l'arbre du chantier, où le spotlight
de pré-rentrée occupe déjà la tête.

Les deux chiffres affichés — **41 volumes**, **dès 15 DT** — sont des promesses
commerciales : `__tests__/marketing/manuels-banner.test.tsx` les recalcule
depuis le catalogue canonique et échoue s'ils cessent d'être vrais.

`/manuels` n'est plus une page orpheline : sa justification de cartographie a
été retirée. Elle **reste `noindex`**, ce qui n'est pas contradictoire — elle est
atteignable par les visiteurs depuis l'accueil, et tenue hors des moteurs tant
que le catalogue est en pré-commande.

---

## Mise à jour — réservation notifiée sur WhatsApp, et passage à l'index

### Correction de parcours, à consigner

Ce lot a d'abord été écrit sur l'ancienne lignée du dépôt, qui ne possédait
aucune intégration WhatsApp. En le reportant sur `origin/main`, il est apparu
que **la production en possède une complète** : fournisseur Meta
(`lib/whatsapp/meta-provider.ts`), file durable chiffrée, ouvrier, webhook,
anonymisation RGPD des téléphones, et jusqu'au motif `enqueue(tx)` puis
`kick()` après COMMIT — que j'avais reproduit sans le savoir. La première
version introduisait donc un **second jeu d'identifiants Meta**. Elle a été
corrigée : la maison ne configure son compte qu'une fois.

### Ce qui est réutilisé, et ce qui ne l'est pas

Réutilisé : les variables `WHATSAPP_SEND_ENABLED`, `WHATSAPP_META_*`, le
secret `WHATSAPP_OUTBOX_ENCRYPTION_KEY`, le schéma de chiffrement
AES-256-GCM avec la même dérivation de clé, la table `canonical_job_outbox`,
et la convention de nommage des modèles `WHATSAPP_TEMPLATE_*`.

Non réutilisé, et pourquoi : le fournisseur existant est taillé pour un modèle
à bouton d'URL avec un « purpose » d'activation, là où une réservation demande
un modèle à paramètres de corps. Et surtout, **l'ouvrier des invitations
réclame tous les travaux `WHATSAPP_SEND` sans filtrer le type d'agrégat**,
puis rejette ceux qui n'en sont pas : y verser des réservations les ferait
échouer. D'où un type de tâche distinct, `SEND_WHATSAPP_ORDER`, et un ouvrier
propre, volontairement plus simple — la sémantique d'incertitude du SMTP et la
quarantaine des invitations n'ont pas d'objet ici.

### Ce qui ne peut jamais arriver

Une réservation **perdue**, ni une réservation **dont la maison n'est pas
prévenue**. La fiche de contact, les deux intentions d'e-mail et la
notification WhatsApp sont écrites dans **une seule transaction** : ou tout
existe, ou rien. La remise WhatsApp est ensuite sollicitée immédiatement, puis
reprise par un battement périodique avec attente croissante bornée à une heure,
jusqu'à huit tentatives. Un refus de validation de Meta — modèle inconnu,
paramètres qui ne concordent pas — est classé tout de suite : il ne se répare
pas tout seul.

Si le canal n'est pas configuré, **rien n'est inscrit en file** : exiger le
secret de chiffrement à l'intérieur de la transaction ferait échouer la
commande elle-même. La réservation est alors enregistrée et notifiée par
e-mail, et la réponse l'annonce (`whatsapp: "disabled"`).

### À faire avant la mise en service

1. **Créer le modèle** dans Meta Business Manager, catégorie *Utilitaire*,
   langue `fr`, nom `commande_manuels`, corps exactement :

   ```
   Nouvelle réservation de manuels.
   Référence : {{1}}
   Client : {{2}} — {{3}}
   Format : {{4}}
   Panier : {{5}}
   Total : {{6}}
   Remise : {{7}}
   ```

2. **Vérifier la configuration Meta déjà en place** — `WHATSAPP_SEND_ENABLED`,
   `WHATSAPP_META_PHONE_NUMBER_ID`, `WHATSAPP_META_ACCESS_TOKEN`,
   `WHATSAPP_OUTBOX_ENCRYPTION_KEY`. Si les invitations parents fonctionnent
   déjà par ce transport, **il n'y a rien à ajouter**.

3. Deux variables propres aux réservations, toutes deux facultatives :
   `WHATSAPP_TEMPLATE_ORDER` (défaut `commande_manuels`) et
   `WHATSAPP_ORDER_RECIPIENT` (défaut : le numéro public de la maison).

4. **Vérifier que le destinataire n'est pas l'expéditeur.** Le propriétaire a
   retenu le 99 19 28 29, qui est aussi le numéro public. Si c'est le numéro du
   compte Business, Meta refusera — un numéro ne peut pas s'écrire à lui-même.
   Le refus est traduit en clair dans le journal et dans `lastError` du travail.

### Migration

`prisma/migrations/20261016120000_send_whatsapp_job_type` ajoute la valeur
`SEND_WHATSAPP_ORDER` à l'énumération `CanonicalJobType`. Strictement
additive : rien n'est renommé, supprimé ni contraint, aucune ligne existante
n'est touchée.

### Passage à l'index

Sur décision du propriétaire, la page quitte le `noindex` : `robots` passe à
`index: true, follow: true`, et `/manuels` entre au sitemap avec une priorité
de 0,9, au même rang que `/offres`, en reprenant la date de contenu fixe du
plan de site — et non l'heure de la visite, qu'un garde-fou du dépôt interdit.
