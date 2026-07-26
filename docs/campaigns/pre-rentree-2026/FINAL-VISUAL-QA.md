# QA visuelle finale — Pré-rentrée 2026

## Date

2026-07-26, Africa/Tunis.

## Contexte

Cette revue couvre le candidat public contrôlé de la page
`/stages/pre-rentree-2026`, les sept PDF publics et les familles sociales
`PUBLIC` et `REVIEW`.

La page a été capturée avec une surcharge `PUBLIC_READY` appliquée uniquement
dans une archive temporaire hors Git. La branche reste fail-closed avec
`releaseStatus=READY_FOR_OWNER_GO`.

- SHA de code et contenu testé :
  `b51a2bfcd48a4bab9d907a4f77149879b16f1898`
- preuve machine :
  `assets/qa/pre-rentree-2026/final-public-candidate/browser-inspection.json`
- statut revue technique : `VALIDATED`
- validation humaine propriétaire : `APPROVED` pour le manifeste
  `93f29e08c6f0294f8ecee443896d12646ba3fa6d598218bebbc0cc22679fa219`
- publication autorisée : `NO`

L'approbation propriétaire est enregistrée dans l'espace owner-controlled et
lie les sept PDF, 59 pages et 27 assets sociaux au SHA produit de la PR #79.
Elle ne vaut pas GO de publication et doit être revalidée si le manifeste ou
le contenu produit change.

## Page publique

| Contrôle | Mobile 390 | Tablette 768 | Desktop 1440 |
|---|---:|---:|---:|
| HTTP | 200 | 200 | 200 |
| débordement horizontal | aucun | aucun | aucun |
| erreurs console | 0 | 0 | 0 |
| axe serious/critical | 0 | 0 | 0 |
| défauts de contraste axe | 0 | 0 | 0 |

Constats visuels :

- un H1 unique et une proposition de valeur lisible ;
- hero, matières, offres, planning, sélecteur, méthode, programmes, sept
  téléchargements, FAQ et CTA final présents ;
- CTA propres à la page limités à l'information, WhatsApp et téléphone ;
- aucune salle numérotée exposée ;
- tableaux et cartes lisibles sur les trois viewports ;
- navigation clavier couverte par les composants natifs et l'analyse axe ;
- aucun grand débordement ou chevauchement observé.

Captures :

- `mobile-390.png` — SHA-256
  `0323543a140bcedc0a521a11041eb53b8d7c230df5d355d1432f2b9b999bd3f8`
- `tablette-768.png` — SHA-256
  `7fdee4d71f07b61c05b87faf3fb3e40e48406984be7bdc2b58dfb782ec30b1e0`
- `desktop-1440.png` — SHA-256
  `502cade8b552e37bc5a3680077fe390f9fbe8ee60891bd5071f01b079ea66da7`
- planche responsive — SHA-256
  `0504f3bfb1cf97e9a1b18ab630881c57216b9c9b8bac8c47cffcb6f1480f641d`

## PDF publics

La planche
`assets/campaigns/pre-rentree-2026/documents-final/visual-review/documents-final-contact-sheet.png`
a été inspectée. Ses 59 pages sont non vides, cohérentes et sans débordement
visuel manifeste. Les contrôles automatisés associés vérifient aussi les
polices, liens, textes interdits, salles, volumes élève et filigranes.

SHA-256 de la planche :
`e34df2d3b4b8c8dc062685ce9171ea30f6708b5b9cff7b11446bac37fe463471`.

## Feed et Story

Les planches `feed.png` et `story.png` de la famille `REVIEW` ont été
inspectées. Leur filigrane est volontaire et absent des homologues `PUBLIC`.

- Feed principal et quatre Feed par niveau : dimensions 1080 × 1350, logo,
  hiérarchie, CTA, dates, Mutuelleville et WhatsApp présents.
- Story principale et quatre Story par niveau : dimensions 1080 × 1920,
  safe zones préservées et CTA lisibles.
- aucune Physique-Chimie en Seconde ;
- aucune promesse de résultat, de paiement ou de réservation ;
- aucune identité d'enseignant.

La Story principale présentait initialement un grand vide central. Un test de
densité reproduisait 21 lignes utiles dans la zone centrale. Le renderer
affiche désormais un panneau méthodologique en trois étapes et le même test
mesure 533 lignes utiles. La régénération complète répétée ne produit aucun
delta Git.

SHA-256 des planches :

- Feed :
  `6585be5b14f96ca56270d435bef89425e29f37e4d87d2000976283a97ebb8818`
- Story :
  `bac77b3fef7fa8b42bf96e7ed531abb1d7471c0c7647dfcfa61b01171da4ce84`

## Inventaire des textes

L'inventaire des titres, H1/H2/H3, liens, libellés et destinations se trouve
dans `browser-inspection.json`. Les sources et rendus sociaux sont couverts par
les tests anti-régression suivants :

- aucun CTA « Pré-inscrire », « Réserver » ou « Payer » ;
- aucun `"date": null` ;
- aucun watermark dans `PUBLIC` ;
- aucune association Seconde / Physique-Chimie ;
- WhatsApp `99 192 829` et Mutuelleville présents.

## Gates de release distincts

- le raw audit npm complet reste visible sur `brace-expansion` transitif ;
- l'exception propriétaire est exacte, temporaire et fail-closed ;
- le runbook privé, le dry-run de rollback et le health pré-déploiement sont
  liés par empreintes hors Git ;
- le GO final reste interdit avant la CI du SHA final.

## Rollback

Aucun déploiement n'a été effectué. Le rollback visuel consiste à revenir au
dernier commit avant les assets de campagne ; la production ne doit cependant
jamais être modifiée avant le GO lié à un SHA et la validation du runbook privé.
